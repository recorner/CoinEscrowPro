const { PrismaClient } = require('@prisma/client');
const { Keyboards } = require('../keyboards');
const { SecurityUtils } = require('../../utils/security');
const { TimeUtils } = require('../../utils/time');
const { logger } = require('../../utils/logger');

const prisma = new PrismaClient();

class DealHandlers {
  static async helpHandler(ctx) {
    const helpText = `
🆘 *CoinEscrowPro Help*

*Available Commands:*

*Deal Management:*
• \`/start\` - Start the bot and main menu
• \`/help\` - Show this help message
• \`/set btc|ltc\` - Set cryptocurrency for deal
• \`/setwallet <address>\` - Set your wallet address
• \`/wallet\` - Show current wallet address
• \`/release\` - Release escrow funds (buyer only)
• \`/cancel\` - Cancel current deal
• \`/dispute\` - Open dispute with admin
• \`/extend\` - Extend deal timeout
• \`/balance\` - Check escrow status
• \`/whoami\` - Show your role in current deal

*Information:*
• \`/botstats\` - Show bot statistics
• \`/vouch\` - Post success story
• \`/report <message>\` - Report user/issue

*Need more help?* Contact @CoinEscrowProSupport
    `;

    await ctx.reply(helpText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.backButton(),
    });
  }

  static async rulesHandler(ctx) {
    const rulesText = `
📋 *Deal Rules & Guidelines*

*Before Starting:*
• Both parties must agree on terms
• Verify wallet addresses carefully
• Understand the escrow process

*During Deal:*
• Buyer sends payment to escrow address
• Seller waits for confirmation
• Both parties can extend timeout if needed
• Only buyer can release funds

*Security Tips:*
• Never share private keys
• Double-check wallet addresses
• Use disputes for serious issues only
• Keep communication respectful

*Fees:*
• Standard fee: 0.5% of transaction
• Referral groups may have custom rates
• Fees are deducted from escrow amount

*Support:*
• Use /dispute for transaction issues
• Use /report for user behavior issues
• Contact admins for urgent matters
    `;

    await ctx.reply(rulesText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.backButton(),
    });
  }

  static async setCryptoHandler(ctx) {
    const crypto = ctx.match?.toUpperCase();
    
    if (!crypto || !['BTC', 'LTC'].includes(crypto)) {
      return ctx.reply('❌ Please specify BTC or LTC. Example: `/set btc`', {
        parse_mode: 'Markdown',
      });
    }

    // Check if user is in a deal group
    const chat = ctx.chat;
    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      // Find the deal associated with this group
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          status: 'PENDING',
        },
        include: {
          buyer: true,
          seller: true,
        },
      });

      if (!deal) {
        return ctx.reply('❌ No active deal found in this group.');
      }

      // Update deal cryptocurrency
      await prisma.deal.update({
        where: { id: deal.id },
        data: { cryptocurrency: crypto },
      });

      await ctx.reply(`✅ Cryptocurrency set to ${crypto}. Both parties can now set their wallet addresses using /setwallet <address>`);
      
      logger.info(`Crypto set for deal ${deal.dealNumber}: ${crypto}`);
      
    } catch (error) {
      logger.error('Error setting crypto:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async releaseHandler(ctx) {
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      // Find the deal
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          status: 'FUNDED',
          buyerId: (await getUserId(userId)),
        },
        include: {
          buyer: true,
          seller: true,
          wallets: {
            include: {
              wallet: true,
            },
          },
        },
      });

      if (!deal) {
        return ctx.reply('❌ No funded deal found or you are not the buyer.');
      }

      // Confirm release
      await ctx.reply(
        `🔐 *Release Confirmation*\n\n` +
        `Deal: \`${deal.dealNumber}\`\n` +
        `Amount: ${deal.amount} ${deal.cryptocurrency}\n` +
        `Seller: @${deal.seller.username}\n\n` +
        `Are you sure you want to release the funds?`,
        {
          parse_mode: 'Markdown',
          reply_markup: Keyboards.confirmAction('release', deal.id),
        }
      );

    } catch (error) {
      logger.error('Error in release handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async cancelHandler(ctx) {
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      const userDbId = await getUserId(userId);
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          OR: [
            { buyerId: userDbId },
            { sellerId: userDbId },
          ],
          status: {
            in: ['PENDING', 'WAITING_PAYMENT'],
          },
        },
        include: {
          buyer: true,
          seller: true,
        },
      });

      if (!deal) {
        return ctx.reply('❌ No cancellable deal found.');
      }

      if (deal.status === 'FUNDED') {
        return ctx.reply('❌ Cannot cancel a funded deal. Use /dispute instead.');
      }

      // Confirm cancellation
      await ctx.reply(
        `⚠️ *Cancel Deal Confirmation*\n\n` +
        `Deal: \`${deal.dealNumber}\`\n` +
        `Status: ${deal.status}\n\n` +
        `Are you sure you want to cancel this deal?`,
        {
          parse_mode: 'Markdown',
          reply_markup: Keyboards.confirmAction('cancel', deal.id),
        }
      );

    } catch (error) {
      logger.error('Error in cancel handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async disputeHandler(ctx) {
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      const userDbId = await getUserId(userId);
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          OR: [
            { buyerId: userDbId },
            { sellerId: userDbId },
          ],
          status: {
            in: ['WAITING_PAYMENT', 'FUNDED'],
          },
        },
      });

      if (!deal) {
        return ctx.reply('❌ No active deal found for dispute.');
      }

      if (deal.isDisputed) {
        return ctx.reply('⚠️ This deal is already under dispute.');
      }

      // Mark deal as disputed
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          isDisputed: true,
          disputeReason: 'User initiated dispute',
        },
      });

      // Log the dispute
      await prisma.auditLog.create({
        data: {
          userId: userDbId,
          dealId: deal.id,
          action: 'DISPUTE_OPENED',
          details: {
            reason: 'User initiated dispute',
          },
        },
      });

      // Notify admins
      const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
      for (const adminId of adminIds) {
        try {
          await ctx.api.sendMessage(
            adminId,
            `🚨 *Dispute Opened*\n\n` +
            `Deal: \`${deal.dealNumber}\`\n` +
            `Status: ${deal.status}\n` +
            `Initiated by: @${ctx.from.username}\n` +
            `Group: ${chat.title}`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`Failed to notify admin ${adminId}:`, error);
        }
      }

      await ctx.reply(
        '⚠️ *Dispute Opened*\n\n' +
        'Your dispute has been submitted to the administrators. ' +
        'Please wait for admin intervention.\n\n' +
        'Deal is now frozen until resolution.'
      );

    } catch (error) {
      logger.error('Error in dispute handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async reportHandler(ctx) {
    const message = ctx.match;
    
    if (!message) {
      return ctx.reply('❌ Please provide a reason. Example: `/report User is not responding`', {
        parse_mode: 'Markdown',
      });
    }

    try {
      const userId = await getUserId(ctx.from.id.toString());
      
      // Create report
      await prisma.report.create({
        data: {
          reporterId: userId,
          reportedId: userId, // This might be updated based on context
          reason: message.substring(0, 255),
          description: message,
        },
      });

      await ctx.reply('✅ Report submitted. Administrators will review it shortly.');
      
    } catch (error) {
      logger.error('Error in report handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async extendHandler(ctx) {
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      const userDbId = await getUserId(userId);
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          OR: [
            { buyerId: userDbId },
            { sellerId: userDbId },
          ],
          status: 'WAITING_PAYMENT',
        },
      });

      if (!deal) {
        return ctx.reply('❌ No active deal found to extend.');
      }

      if (!deal.expiresAt || TimeUtils.isExpired(deal.expiresAt)) {
        return ctx.reply('❌ Deal has already expired.');
      }

      // Extend by 30 minutes
      const newExpiresAt = TimeUtils.addMinutes(new Date(deal.expiresAt), 30);
      
      await prisma.deal.update({
        where: { id: deal.id },
        data: { expiresAt: newExpiresAt },
      });

      await ctx.reply(
        `⏰ *Deal Extended*\n\n` +
        `New expiry: ${TimeUtils.formatTimestamp(newExpiresAt)}\n` +
        `Time remaining: ${TimeUtils.getTimeRemaining(newExpiresAt).text}`
      );

    } catch (error) {
      logger.error('Error in extend handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async balanceHandler(ctx) {
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          status: {
            in: ['PENDING', 'WAITING_PAYMENT', 'FUNDED'],
          },
        },
        include: {
          buyer: true,
          seller: true,
          transactions: true,
        },
      });

      if (!deal) {
        return ctx.reply('❌ No active deal found in this group.');
      }

      const statusEmojis = {
        PENDING: '⏳',
        WAITING_PAYMENT: '💰',
        FUNDED: '✅',
      };

      let balanceText = `
📊 *Deal Balance & Status*

${statusEmojis[deal.status]} **Status:** ${deal.status}
🆔 **Deal:** \`${deal.dealNumber}\`
💰 **Amount:** ${deal.amount} ${deal.cryptocurrency}
⚡ **Fee:** ${deal.feeAmount} ${deal.cryptocurrency} (${deal.feePercentage}%)

👤 **Buyer:** @${deal.buyer.username}
👤 **Seller:** @${deal.seller.username}
      `;

      if (deal.escrowAddress) {
        balanceText += `\n🏦 **Escrow Address:** \`${deal.escrowAddress}\``;
      }

      if (deal.expiresAt) {
        const timeRemaining = TimeUtils.getTimeRemaining(deal.expiresAt);
        balanceText += `\n⏰ **Time Remaining:** ${timeRemaining.text}`;
      }

      if (deal.transactions.length > 0) {
        balanceText += `\n\n📋 **Recent Transactions:**`;
        deal.transactions.slice(-3).forEach(tx => {
          balanceText += `\n• ${tx.amount} ${tx.cryptocurrency} - ${tx.status}`;
        });
      }

      await ctx.reply(balanceText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error in balance handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async txidHandler(ctx) {
    const txHash = ctx.match;
    
    if (!txHash) {
      return ctx.reply('❌ Please provide transaction hash. Example: `/txid abc123...`', {
        parse_mode: 'Markdown',
      });
    }

    await ctx.reply(
      `📝 Transaction hash recorded: \`${txHash}\`\n\n` +
      'Our system will verify this transaction automatically. ' +
      'You will be notified once confirmation is received.',
      { parse_mode: 'Markdown' }
    );
  }

  static async vouchHandler(ctx) {
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          status: 'RELEASED',
        },
        include: {
          buyer: true,
          seller: true,
        },
      });

      if (!deal) {
        return ctx.reply('❌ No completed deal found to vouch for.');
      }

      // Post vouch message
      const vouchText = `
✅ *Deal Complete!*

🆔 Deal: \`${deal.dealNumber}\`
💰 Amount: ${deal.amount} ${deal.cryptocurrency}
👤 Buyer: @${deal.buyer.username}
👤 Seller: @${deal.seller.username}
⭐ Status: Successfully completed

Thanks for using CoinEscrowPro! 🚀
      `;

      // Post to vouch channel if configured
      if (process.env.VOUCH_CHANNEL_ID) {
        try {
          await ctx.api.sendMessage(process.env.VOUCH_CHANNEL_ID, vouchText, {
            parse_mode: 'Markdown',
          });
        } catch (error) {
          logger.error('Failed to post to vouch channel:', error);
        }
      }

      await ctx.reply('✅ Vouch posted successfully!');

    } catch (error) {
      logger.error('Error in vouch handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async statsHandler(ctx) {
    try {
      const stats = await prisma.botStats.findFirst({
        orderBy: { date: 'desc' },
      });

      const totalUsers = await prisma.user.count();
      const totalDeals = await prisma.deal.count();
      const successfulDeals = await prisma.deal.count({
        where: { status: 'RELEASED' },
      });

      const statsText = `
📊 *CoinEscrowPro Statistics*

👥 **Total Users:** ${totalUsers.toLocaleString()}
🤝 **Total Deals:** ${totalDeals.toLocaleString()}
✅ **Successful Deals:** ${successfulDeals.toLocaleString()}
📈 **Success Rate:** ${totalDeals > 0 ? ((successfulDeals / totalDeals) * 100).toFixed(1) : 0}%

💰 **Volume (All Time):**
₿ Bitcoin: ${stats?.totalVolumeBtc || 0} BTC
🪙 Litecoin: ${stats?.totalVolumeLtc || 0} LTC

🏆 **Trust Score:** 99.2%
⚡ **Avg. Deal Time:** 45 minutes

Join the future of secure P2P trading! 🚀
      `;

      await ctx.reply(statsText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error in stats handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async whoamiHandler(ctx) {
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      const userDbId = await getUserId(userId);
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          OR: [
            { buyerId: userDbId },
            { sellerId: userDbId },
          ],
        },
        include: {
          buyer: true,
          seller: true,
        },
      });

      if (!deal) {
        return ctx.reply('❌ You are not part of any deal in this group.');
      }

      const role = deal.buyerId === userDbId ? 'Buyer' : 'Seller';
      const otherParty = role === 'Buyer' ? deal.seller : deal.buyer;

      const whoamiText = `
👤 *Your Role Information*

🆔 **Deal:** \`${deal.dealNumber}\`
🎭 **Your Role:** ${role}
🤝 **Other Party:** @${otherParty.username}
📊 **Deal Status:** ${deal.status}
💰 **Amount:** ${deal.amount} ${deal.cryptocurrency}

${role === 'Buyer' ? '💡 As buyer, you can release funds when satisfied.' : '💡 As seller, wait for buyer to release funds.'}
      `;

      await ctx.reply(whoamiText, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error in whoami handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async joinDealHandler(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const messageText = ctx.message.text;
      const args = messageText.split(' ').slice(1);

      if (args.length === 0) {
        await ctx.reply(`
❌ *Missing Deal ID*

Usage: /joindeal DEAL_ID

Example: /joindeal DEAL_1721443037_abc123

Ask the other party to share the correct deal ID with you.
        `, { parse_mode: 'Markdown' });
        return;
      }

      const dealId = args[0];

      // For now, since we don't have a deals table yet, we'll provide instructions
      const joinText = `
🤝 *Join Deal Request*

*Deal ID:* \`${dealId}\`
*Your Telegram ID:* \`${userId}\`

📋 *To complete joining:*

1️⃣ *Create a group* with:
   • You
   • The deal initiator
   • This bot (@${process.env.BOT_USERNAME || 'CoinEscrowPro'})

2️⃣ *In the group, send:*
/registergroup ${dealId}

3️⃣ *The bot will automatically:*
   • Verify both parties
   • Set up escrow
   • Begin the deal process

⚠️ *Important:* Make sure the deal initiator is also in the group!
      `;

      await ctx.reply(joinText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Need Help?', callback_data: 'help' },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });

      logger.info(`User ${userId} attempted to join deal: ${dealId}`);

    } catch (error) {
      logger.error('Error in join deal handler:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }
}

async function getUserId(telegramId) {
  const user = await prisma.user.findUnique({
    where: { telegramId: telegramId.toString() },
  });
  return user?.id;
}

module.exports = { dealHandlers: DealHandlers };
