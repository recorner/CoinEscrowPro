const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { EscrowService } = require('./escrow/escrowService');
const { WalletService } = require('./wallet/walletService');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient();

function setupCronJobs() {
  // Check for payments every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await checkPendingPayments();
  });

  // Check for expired deals every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await checkExpiredDeals();
  });

  // Update statistics daily at midnight
  cron.schedule('0 0 * * *', async () => {
    await updateDailyStats();
  });

  // Clean up old logs weekly
  cron.schedule('0 2 * * 0', async () => {
    await cleanupOldLogs();
  });

  // Send reminders for pending deals every hour
  cron.schedule('0 * * * *', async () => {
    await sendDealReminders();
  });

  logger.info('Cron jobs scheduled successfully');
}

async function checkPendingPayments() {
  try {
    const pendingDeals = await prisma.deal.findMany({
      where: {
        status: 'WAITING_PAYMENT',
        escrowAddress: { not: null },
      },
      select: {
        id: true,
        dealNumber: true,
        escrowAddress: true,
        cryptocurrency: true,
        amount: true,
        confirmationsReq: true,
        confirmationsRec: true,
        groupId: true,
      },
    });

    logger.info(`Checking ${pendingDeals.length} pending payments...`);

    for (const deal of pendingDeals) {
      try {
        const paymentResult = await EscrowService.checkPayment(deal.id);
        
        if (paymentResult.success && paymentResult.funded) {
          logger.info(`Payment confirmed for deal ${deal.dealNumber}`);
          
          // Notify group about payment confirmation
          if (deal.groupId) {
            await notifyPaymentConfirmed(deal);
          }
        } else if (paymentResult.pending) {
          logger.info(`Payment pending for deal ${deal.dealNumber}: ${paymentResult.amount} ${deal.cryptocurrency}`);
          
          // Update confirmations if needed
          if (paymentResult.confirmations !== deal.confirmationsRec) {
            await prisma.deal.update({
              where: { id: deal.id },
              data: { confirmationsRec: paymentResult.confirmations },
            });
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`Error checking payment for deal ${deal.dealNumber}:`, error);
      }
    }
    
  } catch (error) {
    logger.error('Error in checkPendingPayments:', error);
  }
}

async function checkExpiredDeals() {
  try {
    const expirableDeals = await prisma.deal.findMany({
      where: {
        status: 'WAITING_PAYMENT',
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        dealNumber: true,
        expiresAt: true,
        groupId: true,
      },
    });

    logger.info(`Checking ${expirableDeals.length} potentially expired deals...`);

    for (const deal of expirableDeals) {
      try {
        const expireResult = await EscrowService.expireDeal(deal.id);
        
        if (expireResult.success) {
          logger.info(`Deal ${deal.dealNumber} expired`);
          
          // Notify group about expiration
          if (deal.groupId) {
            await notifyDealExpired(deal);
          }
        }
        
      } catch (error) {
        logger.error(`Error expiring deal ${deal.dealNumber}:`, error);
      }
    }
    
  } catch (error) {
    logger.error('Error in checkExpiredDeals:', error);
  }
}

async function updateDailyStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get statistics for yesterday
    const [
      totalUsers,
      newUsers,
      totalDeals,
      newDeals,
      successfulDeals,
      totalVolumeBTC,
      totalVolumeLTC,
      totalFees,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      prisma.deal.count(),
      prisma.deal.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      prisma.deal.count({ 
        where: { 
          status: 'RELEASED',
          releasedAt: { gte: yesterday, lt: today }
        }
      }),
      prisma.deal.aggregate({
        _sum: { amount: true },
        where: { 
          cryptocurrency: 'BTC',
          status: 'RELEASED',
          releasedAt: { gte: yesterday, lt: today }
        },
      }),
      prisma.deal.aggregate({
        _sum: { amount: true },
        where: { 
          cryptocurrency: 'LTC',
          status: 'RELEASED',
          releasedAt: { gte: yesterday, lt: today }
        },
      }),
      prisma.deal.aggregate({
        _sum: { feeAmount: true },
        where: { 
          status: 'RELEASED',
          releasedAt: { gte: yesterday, lt: today }
        },
      }),
    ]);

    // Update or create stats record
    await prisma.botStats.upsert({
      where: { date: yesterday },
      update: {
        totalUsers: totalUsers,
        totalDeals: totalDeals,
        successfulDeals: await prisma.deal.count({ where: { status: 'RELEASED' } }),
        totalVolumeBtc: await getTotalVolume('BTC'),
        totalVolumeLtc: await getTotalVolume('LTC'),
        totalFees: await getTotalFees(),
      },
      create: {
        date: yesterday,
        totalUsers: totalUsers,
        totalDeals: totalDeals,
        successfulDeals: await prisma.deal.count({ where: { status: 'RELEASED' } }),
        totalVolumeBtc: await getTotalVolume('BTC'),
        totalVolumeLtc: await getTotalVolume('LTC'),
        totalFees: await getTotalFees(),
      },
    });

    logger.info(`Daily stats updated for ${yesterday.toDateString()}`);
    
  } catch (error) {
    logger.error('Error updating daily stats:', error);
  }
}

async function getTotalVolume(cryptocurrency) {
  const result = await prisma.deal.aggregate({
    _sum: { amount: true },
    where: { 
      cryptocurrency: cryptocurrency,
      status: 'RELEASED'
    },
  });
  
  return result._sum.amount || 0;
}

async function getTotalFees() {
  const result = await prisma.deal.aggregate({
    _sum: { feeAmount: true },
    where: { status: 'RELEASED' },
  });
  
  return result._sum.feeAmount || 0;
}

async function cleanupOldLogs() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Clean up old audit logs (keep only last 30 days)
    const deletedLogs = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // Clean up old bot stats (keep only last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const deletedStats = await prisma.botStats.deleteMany({
      where: {
        date: { lt: ninetyDaysAgo },
      },
    });

    logger.info(`Cleaned up ${deletedLogs.count} old audit logs and ${deletedStats.count} old stats`);
    
  } catch (error) {
    logger.error('Error cleaning up old logs:', error);
  }
}

async function sendDealReminders() {
  try {
    const { Bot } = require('grammy');
    const bot = new Bot(process.env.BOT_TOKEN);
    
    // Find deals that need reminders
    const reminderTime = new Date();
    reminderTime.setMinutes(reminderTime.getMinutes() + 30); // 30 minutes before expiry
    
    const dealsNeedingReminder = await prisma.deal.findMany({
      where: {
        status: 'WAITING_PAYMENT',
        expiresAt: { lte: reminderTime, gt: new Date() },
        // Add a field to track if reminder was sent to avoid spam
      },
      include: {
        buyer: true,
        seller: true,
      },
    });

    for (const deal of dealsNeedingReminder) {
      try {
        const timeRemaining = Math.floor((new Date(deal.expiresAt) - new Date()) / (1000 * 60));
        
        const reminderMessage = `
⏰ *Deal Reminder*

Deal: \`${deal.dealNumber}\`
Time Remaining: ${timeRemaining} minutes

💰 **Payment needed:** ${deal.amount} ${deal.cryptocurrency}
📍 **Escrow Address:** \`${deal.escrowAddress}\`

⚠️ *Deal will expire soon! Please complete payment.*
        `;

        // Send reminder to buyer
        await bot.api.sendMessage(deal.buyer.telegramId, reminderMessage, {
          parse_mode: 'Markdown',
        });

        // Send to group if exists
        if (deal.groupId) {
          await bot.api.sendMessage(deal.groupId, reminderMessage, {
            parse_mode: 'Markdown',
          });
        }

        logger.info(`Reminder sent for deal ${deal.dealNumber}`);
        
      } catch (error) {
        logger.error(`Error sending reminder for deal ${deal.dealNumber}:`, error);
      }
    }
    
  } catch (error) {
    logger.error('Error in sendDealReminders:', error);
  }
}

async function notifyPaymentConfirmed(deal) {
  try {
    const { Bot } = require('grammy');
    const bot = new Bot(process.env.BOT_TOKEN);
    
    const confirmationMessage = `
✅ *Payment Confirmed!*

Deal: \`${deal.dealNumber}\`
Amount: ${deal.amount} ${deal.cryptocurrency}

🎉 **Next Steps:**
• Seller: Provide goods/services
• Buyer: Verify receipt and use /release when satisfied

Deal is now fully funded and secure! 🔒
    `;

    await bot.api.sendMessage(deal.groupId, confirmationMessage, {
      parse_mode: 'Markdown',
    });
    
  } catch (error) {
    logger.error('Error notifying payment confirmation:', error);
  }
}

async function notifyDealExpired(deal) {
  try {
    const { Bot } = require('grammy');
    const bot = new Bot(process.env.BOT_TOKEN);
    
    const expirationMessage = `
⏰ *Deal Expired*

Deal: \`${deal.dealNumber}\`
Expired: ${deal.expiresAt.toLocaleString()}

❌ **Status:** Deal has been cancelled due to timeout
💡 **Next Steps:** Create a new deal if still needed

Contact support if payment was made but not detected.
    `;

    await bot.api.sendMessage(deal.groupId, expirationMessage, {
      parse_mode: 'Markdown',
    });
    
  } catch (error) {
    logger.error('Error notifying deal expiration:', error);
  }
}

module.exports = { 
  setupCronJobs,
  checkPendingPayments,
  checkExpiredDeals,
  updateDailyStats,
  cleanupOldLogs,
};
