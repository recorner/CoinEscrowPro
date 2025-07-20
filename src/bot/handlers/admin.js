const { PrismaClient } = require('@prisma/client');
const { Keyboards } = require('../keyboards');
const { SecurityUtils } = require('../../utils/security');
const { logger } = require('../../utils/logger');

const prisma = new PrismaClient();

class AdminHandlers {
  static async adminPanelHandler(ctx) {
    const userId = ctx.from.id.toString();

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    const adminText = `
🛡️ *Admin Control Panel*

Welcome to the CoinEscrowPro Admin Panel. 
Select an option below to manage the bot.

⚠️ *Use admin powers responsibly*
    `;

    await ctx.reply(adminText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.adminPanel(),
    });
  }

  static async broadcastHandler(ctx) {
    const userId = ctx.from.id.toString();
    const message = ctx.match;

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    if (!message) {
      return ctx.reply(
        '❌ Please provide broadcast message. Example: `/broadcast Important announcement!`',
        { parse_mode: 'Markdown' }
      );
    }

    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { telegramId: true, username: true },
      });

      let successCount = 0;
      let failCount = 0;

      const broadcastMessage = `
📢 *CoinEscrowPro Announcement*

${message}

---
_This is an official announcement from CoinEscrowPro_
      `;

      // Send to all users (in batches to avoid rate limits)
      const batchSize = 30;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const promises = batch.map(async (user) => {
          try {
            await ctx.api.sendMessage(user.telegramId, broadcastMessage, {
              parse_mode: 'Markdown',
            });
            successCount++;
          } catch (error) {
            failCount++;
            logger.warn(`Failed to send broadcast to ${user.telegramId}:`, error.message);
          }
        });

        await Promise.allSettled(promises);
        
        // Wait between batches to respect rate limits
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Log broadcast
      await prisma.auditLog.create({
        data: {
          userId: await getUserId(userId),
          action: 'BROADCAST_SENT',
          details: {
            message: message,
            totalUsers: users.length,
            successCount: successCount,
            failCount: failCount,
          },
        },
      });

      await ctx.reply(
        `✅ *Broadcast Complete*\n\n` +
        `📊 **Statistics:**\n` +
        `• Total users: ${users.length}\n` +
        `• Successful: ${successCount}\n` +
        `• Failed: ${failCount}\n` +
        `• Success rate: ${((successCount / users.length) * 100).toFixed(1)}%`
      );

    } catch (error) {
      logger.error('Error in broadcast:', error);
      await ctx.reply('❌ An error occurred during broadcast.');
    }
  }

  static async registerGroupHandler(ctx) {
    const chat = ctx.chat;
    const userId = ctx.from.id.toString();

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a group.');
    }

    try {
      // Check if user is admin of the group
      const member = await ctx.api.getChatMember(chat.id, ctx.from.id);
      if (member.status !== 'administrator' && member.status !== 'creator') {
        return ctx.reply('❌ Only group administrators can register groups.');
      }

      const userDbId = await getUserId(userId);
      if (!userDbId) {
        return ctx.reply('❌ Please start the bot first with /start in private message.');
      }

      // Register or update referral group
      const referralGroup = await prisma.referralGroup.upsert({
        where: { telegramId: chat.id.toString() },
        update: {
          title: chat.title,
          adminUserId: userDbId,
          isActive: true,
        },
        create: {
          telegramId: chat.id.toString(),
          title: chat.title || 'Unknown Group',
          adminUserId: userDbId,
          feePercentage: 1.0, // Default 1% referral fee
          isActive: true,
        },
      });

      // Log registration
      await prisma.auditLog.create({
        data: {
          userId: userDbId,
          action: 'GROUP_REGISTERED',
          details: {
            groupId: chat.id.toString(),
            groupTitle: chat.title,
          },
        },
      });

      const registrationText = `
✅ *Group Registered Successfully*

🏷️ **Group:** ${chat.title}
🆔 **Group ID:** \`${chat.id}\`
👤 **Admin:** @${ctx.from.username}
💰 **Referral Fee:** ${referralGroup.feePercentage}%

🎯 **What this means:**
• Deals started from this group earn you referral fees
• Your group stats will be tracked
• Success stories will be posted here automatically

📈 **Start earning:**
• Share the bot in this group
• Help members create deals
• Earn ${referralGroup.feePercentage}% of all escrow fees

💡 Use /groupstats to see your earnings!
      `;

      await ctx.reply(registrationText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error registering group:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async getDashboardStats(ctx) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalUsers,
        totalDeals,
        activeDeals,
        completedDeals,
        disputedDeals,
        todayUsers,
        todayDeals,
        totalVolume,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.deal.count(),
        prisma.deal.count({ where: { status: { in: ['PENDING', 'WAITING_PAYMENT', 'FUNDED'] } } }),
        prisma.deal.count({ where: { status: 'RELEASED' } }),
        prisma.deal.count({ where: { isDisputed: true } }),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.deal.count({ where: { createdAt: { gte: today } } }),
        prisma.deal.aggregate({
          _sum: { amount: true },
          where: { status: 'RELEASED' },
        }),
      ]);

      const dashboardText = `
📊 *Admin Dashboard*

👥 **Users:**
• Total: ${totalUsers.toLocaleString()}
• Today: +${todayUsers}

🤝 **Deals:**
• Total: ${totalDeals.toLocaleString()}
• Active: ${activeDeals}
• Completed: ${completedDeals}
• Disputed: ${disputedDeals}
• Today: +${todayDeals}

💰 **Volume:**
• Total: ${totalVolume._sum.amount || 0} (all cryptocurrencies)
• Success Rate: ${totalDeals > 0 ? ((completedDeals / totalDeals) * 100).toFixed(1) : 0}%

🔄 **Status:**
• System: ✅ Online
• Database: ✅ Connected
• APIs: ✅ Operational
      `;

      return dashboardText;

    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      return '❌ Error loading dashboard data.';
    }
  }

  static async getUserManagement(ctx, page = 1) {
    try {
      const limit = 10;
      const offset = (page - 1) * limit;

      const [users, totalUsers] = await Promise.all([
        prisma.user.findMany({
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count(),
      ]);

      const totalPages = Math.ceil(totalUsers / limit);

      let userText = `👥 *User Management* (Page ${page}/${totalPages})\n\n`;

      users.forEach((user, index) => {
        const userNumber = offset + index + 1;
        userText += `${userNumber}. @${user.username || 'No username'}\n`;
        userText += `   ID: \`${user.telegramId}\`\n`;
        userText += `   Deals: ${user.successfulDeals}\n`;
        userText += `   Status: ${user.isActive ? '✅' : '❌'}\n\n`;
      });

      return {
        text: userText,
        keyboard: Keyboards.pagination(page, totalPages, 'admin_users'),
      };

    } catch (error) {
      logger.error('Error getting user management:', error);
      return {
        text: '❌ Error loading user data.',
        keyboard: Keyboards.backButton('admin_panel'),
      };
    }
  }

  static async getRecentDeals(ctx, page = 1) {
    try {
      const limit = 10;
      const offset = (page - 1) * limit;

      const [deals, totalDeals] = await Promise.all([
        prisma.deal.findMany({
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          include: {
            buyer: { select: { username: true } },
            seller: { select: { username: true } },
          },
        }),
        prisma.deal.count(),
      ]);

      const totalPages = Math.ceil(totalDeals / limit);

      let dealText = `🤝 *Deal Management* (Page ${page}/${totalPages})\n\n`;

      deals.forEach((deal, index) => {
        const dealNumber = offset + index + 1;
        const statusEmoji = getStatusEmoji(deal.status);
        
        dealText += `${dealNumber}. ${statusEmoji} \`${deal.dealNumber}\`\n`;
        dealText += `   Amount: ${deal.amount} ${deal.cryptocurrency}\n`;
        dealText += `   Buyer: @${deal.buyer.username || 'Unknown'}\n`;
        dealText += `   Seller: @${deal.seller.username || 'Unknown'}\n`;
        dealText += `   Status: ${deal.status}\n\n`;
      });

      return {
        text: dealText,
        keyboard: Keyboards.pagination(page, totalPages, 'admin_deals'),
      };

    } catch (error) {
      logger.error('Error getting recent deals:', error);
      return {
        text: '❌ Error loading deal data.',
        keyboard: Keyboards.backButton('admin_panel'),
      };
    }
  }
}

function getStatusEmoji(status) {
  const emojis = {
    PENDING: '⏳',
    WAITING_PAYMENT: '💰',
    FUNDED: '✅',
    RELEASED: '🎉',
    CANCELLED: '❌',
    DISPUTED: '⚠️',
    EXPIRED: '⏰',
  };
  return emojis[status] || '❓';
}

async function getUserId(telegramId) {
  const user = await prisma.user.findUnique({
    where: { telegramId: telegramId.toString() },
  });
  return user?.id;
}

module.exports = { adminHandlers: AdminHandlers };
