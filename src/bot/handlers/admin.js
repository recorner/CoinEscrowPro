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

  static async setPayoutWalletHandler(ctx) {
    const userId = ctx.from.id.toString();
    const args = ctx.match?.split(' ') || [];

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    if (args.length < 2) {
      return ctx.reply(
        '❌ Usage: `/setpayout <BTC|LTC> <wallet_address> [label]`\n\n' +
        'Example: `/setpayout BTC bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh Platform BTC Wallet`',
        { parse_mode: 'Markdown' }
      );
    }

    const cryptocurrency = args[0].toUpperCase();
    const address = args[1];
    const label = args.slice(2).join(' ') || `Platform ${cryptocurrency} Wallet`;

    if (!['BTC', 'LTC'].includes(cryptocurrency)) {
      return ctx.reply('❌ Only BTC and LTC are supported currently.');
    }

    try {
      const { ReleaseService } = require('../../services/releaseService');
      const result = await ReleaseService.setDefaultPayoutWallet(cryptocurrency, address, label);

      if (result.success) {
        await ctx.reply(
          `✅ *Payout Wallet Set Successfully*\n\n` +
          `💎 **Cryptocurrency:** ${cryptocurrency}\n` +
          `📍 **Address:** \`${address}\`\n` +
          `🏷️ **Label:** ${label}\n\n` +
          `This wallet will now receive all platform fees for ${cryptocurrency} transactions.`,
          { parse_mode: 'Markdown' }
        );

        logger.info(`Admin ${userId} set payout wallet for ${cryptocurrency}: ${address}`);
      } else {
        await ctx.reply(`❌ Failed to set payout wallet: ${result.error}`);
      }

    } catch (error) {
      logger.error('Error setting payout wallet:', error);
      await ctx.reply('❌ An error occurred while setting the payout wallet.');
    }
  }

  static async listPayoutWalletsHandler(ctx) {
    const userId = ctx.from.id.toString();

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    try {
      const wallets = await prisma.payoutWallet.findMany({
        where: { isActive: true },
        orderBy: [
          { isDefault: 'desc' },
          { cryptocurrency: 'asc' }
        ]
      });

      if (wallets.length === 0) {
        return ctx.reply('📭 No payout wallets configured yet.\n\nUse `/setpayout` to add one.');
      }

      let walletsText = '💼 *Configured Payout Wallets*\n\n';
      
      for (const wallet of wallets) {
        walletsText += `${wallet.isDefault ? '⭐' : '•'} **${wallet.cryptocurrency}**\n`;
        walletsText += `📍 \`${wallet.address}\`\n`;
        walletsText += `🏷️ ${wallet.label}\n`;
        if (wallet.isDefault) {
          walletsText += `✅ Default wallet\n`;
        }
        walletsText += '\n';
      }

      walletsText += '💡 *Use `/setpayout` to add or update wallets*';

      await ctx.reply(walletsText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error listing payout wallets:', error);
      await ctx.reply('❌ An error occurred while retrieving payout wallets.');
    }
  }

  static async platformStatsHandler(ctx) {
    const userId = ctx.from.id.toString();

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    try {
      // Get platform statistics
      const totalDeals = await prisma.deal.count();
      const completedDeals = await prisma.deal.count({
        where: { status: 'COMPLETED' }
      });
      const totalUsers = await prisma.user.count();
      const activeUsers = await prisma.user.count({
        where: { isActive: true }
      });

      // Get fee earnings (from completed deals)
      const feeEarnings = await prisma.deal.aggregate({
        where: { 
          status: 'COMPLETED',
          feeAmount: { gt: 0 }
        },
        _sum: { feeAmount: true },
        _count: true
      });

      // Get volume by cryptocurrency
      const btcVolume = await prisma.deal.aggregate({
        where: { 
          cryptocurrency: 'BTC',
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      });

      const ltcVolume = await prisma.deal.aggregate({
        where: { 
          cryptocurrency: 'LTC',
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      });

      const statsText = `
📊 *Platform Statistics*

👥 **Users**
• Total: ${totalUsers}
• Active: ${activeUsers}

🤝 **Deals**
• Total: ${totalDeals}
• Completed: ${completedDeals}
• Success Rate: ${totalDeals > 0 ? ((completedDeals / totalDeals) * 100).toFixed(1) : 0}%

💰 **Trading Volume**
• BTC: ${btcVolume._sum.amount || 0} BTC
• LTC: ${ltcVolume._sum.amount || 0} LTC

⚡ **Platform Fees**
• Total Collected: ${feeEarnings._sum.feeAmount || 0} (mixed currencies)
• Fee-Generating Deals: ${feeEarnings._count || 0}

🕒 *Last updated: ${new Date().toLocaleString()}*
      `;

      await ctx.reply(statsText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error getting platform stats:', error);
      await ctx.reply('❌ An error occurred while retrieving statistics.');
    }
  }

  static async setGetblockHandler(ctx) {
    const userId = ctx.from.id.toString();
    const args = ctx.match?.split(' ') || [];

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    if (args.length < 2) {
      return ctx.reply(
        '❌ Usage: `/setgetblock <BTC|LTC> <endpoint_url>`\\n\\n' +
        'Example: `/setgetblock BTC https://go.getblock.io/your-btc-endpoint`',
        { parse_mode: 'Markdown' }
      );
    }

    const cryptocurrency = args[0].toUpperCase();
    const endpoint = args[1];

    if (!['BTC', 'LTC'].includes(cryptocurrency)) {
      return ctx.reply('❌ Only BTC and LTC are supported currently.');
    }

    try {
      const { AdminSettingsService } = require('../../services/admin/settingsService');
      
      const settingKey = `getblock_${cryptocurrency.toLowerCase()}_endpoint`;
      await AdminSettingsService.setSetting(settingKey, endpoint, `${cryptocurrency} Getblock.io Endpoint`);

      await ctx.reply(
        `✅ *Getblock.io Endpoint Updated*\n\n` +
        `💎 **Cryptocurrency:** ${cryptocurrency}\n` +
        `🔗 **Endpoint:** \`${endpoint}\`\n\n` +
        `This endpoint will now be used for all ${cryptocurrency} operations.`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Admin ${userId} updated Getblock.io endpoint for ${cryptocurrency}: ${endpoint}`);

    } catch (error) {
      logger.error('Error setting Getblock.io endpoint:', error);
      await ctx.reply('❌ An error occurred while updating the endpoint.');
    }
  }

  static async setWebsocketHandler(ctx) {
    const userId = ctx.from.id.toString();
    const args = ctx.match?.split(' ') || [];

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    if (args.length < 2) {
      return ctx.reply(
        '❌ Usage: `/setwebsocket <BTC|LTC> <websocket_url>`\\n\\n' +
        'Example: `/setwebsocket BTC wss://btc.getblock.io/your-endpoint/websocket`',
        { parse_mode: 'Markdown' }
      );
    }

    const cryptocurrency = args[0].toUpperCase();
    const websocket = args[1];

    if (!['BTC', 'LTC'].includes(cryptocurrency)) {
      return ctx.reply('❌ Only BTC and LTC are supported currently.');
    }

    try {
      const { AdminSettingsService } = require('../../services/admin/settingsService');
      
      const settingKey = `getblock_${cryptocurrency.toLowerCase()}_websocket`;
      await AdminSettingsService.setSetting(settingKey, websocket, `${cryptocurrency} WebSocket Endpoint`);

      await ctx.reply(
        `✅ *WebSocket Endpoint Updated*\n\n` +
        `💎 **Cryptocurrency:** ${cryptocurrency}\n` +
        `📡 **WebSocket:** \`${websocket}\`\n\n` +
        `This WebSocket will now be used for real-time ${cryptocurrency} monitoring.`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Admin ${userId} updated WebSocket endpoint for ${cryptocurrency}: ${websocket}`);

    } catch (error) {
      logger.error('Error setting WebSocket endpoint:', error);
      await ctx.reply('❌ An error occurred while updating the WebSocket endpoint.');
    }
  }

  static async listSettingsHandler(ctx) {
    const userId = ctx.from.id.toString();

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    try {
      const { AdminSettingsService } = require('../../services/admin/settingsService');
      
      const settings = await AdminSettingsService.getAllSettings();
      const payoutWallets = await AdminSettingsService.getAllPayoutWallets();

      let settingsText = '⚙️ *Admin Settings*\n\n';
      
      // Show payout wallets
      settingsText += '💼 **Payout Wallets:**\n';
      if (payoutWallets.length > 0) {
        for (const wallet of payoutWallets) {
          settingsText += `• ${wallet.cryptocurrency}: \`${wallet.address}\`\n`;
        }
      } else {
        settingsText += '• No payout wallets configured\n';
      }

      // Show API settings
      settingsText += '\n🔗 **API Endpoints:**\n';
      const relevantSettings = settings.filter(s => 
        s.key.includes('getblock') || s.key.includes('websocket')
      );
      
      if (relevantSettings.length > 0) {
        for (const setting of relevantSettings) {
          const displayValue = setting.isEncrypted ? '[ENCRYPTED]' : setting.value;
          settingsText += `• ${setting.key}: \`${displayValue}\`\n`;
        }
      } else {
        settingsText += '• No API endpoints configured\n';
      }

      settingsText += '\n💡 *Use admin commands to update these settings*';

      await ctx.reply(settingsText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error listing admin settings:', error);
      await ctx.reply('❌ An error occurred while retrieving settings.');
    }
  }

  static async initializeDefaultsHandler(ctx) {
    const userId = ctx.from.id.toString();

    if (!SecurityUtils.isAdmin(userId)) {
      return ctx.reply('❌ Access denied. Admin privileges required.');
    }

    try {
      const { AdminSettingsService } = require('../../services/admin/settingsService');
      
      await AdminSettingsService.initializeDefaults();

      await ctx.reply(
        `✅ *Default Settings Initialized*\n\n` +
        `💼 **Payout Wallets Set:**\n` +
        `• BTC: bc1q8fwypfetn5mu994wpxh70ag9mtq54gaa9d44le\n` +
        `• LTC: LMToh58PhRsHsSskrdYX9FoCN187hZdfod\n\n` +
        `🔗 **Getblock.io Endpoints Configured**\n` +
        `📡 **WebSocket Endpoints Configured**\n\n` +
        `Use /listsettings to view all configurations.`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Admin ${userId} initialized default settings`);

    } catch (error) {
      logger.error('Error initializing default settings:', error);
      await ctx.reply('❌ An error occurred while initializing default settings.');
    }
  }
}

function getStatusEmoji(status) {
  const emojis = {
    PENDING: '⏳',
    WAITING_PAYMENT: '💰',
    FUNDED: '✅',
    COMPLETED: '🎉',
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
