const { PrismaClient } = require('@prisma/client');
const { Keyboards } = require('../keyboards');
const { SecurityUtils } = require('../../utils/security');
const { logger } = require('../../utils/logger');

const prisma = new PrismaClient();

async function startHandler(ctx) {
  try {
    const user = ctx.from;
    
    // Extract referral code from start parameter
    const startParam = ctx.match;
    let referralCode = null;
    
    if (startParam && startParam.startsWith('ref_')) {
      referralCode = startParam.substring(4);
    }

    // Create or update user in database
    const userData = {
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
      isActive: true,
    };

    // Generate referral code for new user
    if (!referralCode) {
      userData.referralCode = SecurityUtils.generateReferralCode();
    }

    const dbUser = await prisma.user.upsert({
      where: { telegramId: user.id.toString() },
      update: {
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        languageCode: userData.languageCode,
        isActive: true,
      },
      create: {
        ...userData,
        referralCode: userData.referralCode || SecurityUtils.generateReferralCode(),
        referredBy: referralCode ? await findReferrer(referralCode) : null,
      },
    });

    // Log user activity
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'USER_START',
        details: {
          referralCode: referralCode,
          userAgent: ctx.from.language_code,
        },
      },
    });

    // Update bot stats
    await updateBotStats('new_user');

    // Welcome message
    const welcomeText = `
🎉 *Welcome to CoinEscrowPro!*

Your trusted partner for secure peer-to-peer cryptocurrency transactions.

✅ *What we offer:*
• Secure Bitcoin & Litecoin escrow
• Automated deal management
• Real-time transaction monitoring
• Dispute resolution system
• Reputation tracking

🚀 *Getting Started:*
1. Click "🤝 Start Deal" to create your first escrow
2. Invite buyer/seller to the deal group
3. Set your wallet addresses
4. Let our bot handle the rest!

💡 *Need help?* Click "🆘 Help" for guides and support.

Your referral code: \`${dbUser.referralCode}\`
Share it to earn rewards! 💰
    `;

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.mainMenu(),
    });

    logger.info(`User started bot: ${user.username} (${user.id})`);
    
  } catch (error) {
    logger.error('Error in start handler:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
}

async function findReferrer(referralCode) {
  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });
    return referrer?.id || null;
  } catch (error) {
    logger.error('Error finding referrer:', error);
    return null;
  }
}

async function updateBotStats(type) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await prisma.botStats.upsert({
      where: { date: today },
      update: {
        totalUsers: type === 'new_user' ? { increment: 1 } : undefined,
        totalDeals: type === 'new_deal' ? { increment: 1 } : undefined,
        successfulDeals: type === 'deal_success' ? { increment: 1 } : undefined,
      },
      create: {
        date: today,
        totalUsers: type === 'new_user' ? 1 : 0,
        totalDeals: type === 'new_deal' ? 1 : 0,
        successfulDeals: type === 'deal_success' ? 1 : 0,
      },
    });

    logger.info(`Updated bot stats: ${type}`);
  } catch (error) {
    logger.error('Error updating bot stats:', error);
  }
}

module.exports = { startHandler };
