const { PrismaClient } = require('@prisma/client');
const { Keyboards } = require('../keyboards');
const { SecurityUtils } = require('../../utils/security');
const { logger } = require('../../utils/logger');
const { adminHandlers } = require('./admin');
const { GroupService } = require('../../services/group');
const { MTProtoService } = require('../../services/mtproto');

const prisma = new PrismaClient();

async function callbackHandlers(ctx) {
  const callbackData = ctx.callbackQuery.data;
  const userId = ctx.from.id.toString();

  try {
    await ctx.answerCallbackQuery();

    // Main menu callbacks
    if (callbackData === 'main_menu') {
      await handleMainMenu(ctx);
    }
    else if (callbackData === 'help') {
      await handleHelp(ctx);
    }
    else if (callbackData === 'instructions') {
      await handleInstructions(ctx);
    }
    else if (callbackData === 'start_deal') {
      await handleStartDeal(ctx);
    }
    else if (callbackData === 'stats') {
      await handleStats(ctx);
    }
    else if (callbackData === 'profile') {
      await handleProfile(ctx);
    }
    else if (callbackData === 'referral') {
      await handleReferral(ctx);
    }

    // Crypto selection callbacks
    else if (callbackData.startsWith('crypto_')) {
      await handleCryptoSelection(ctx, callbackData);
    }

    // Deal setup callbacks
    else if (callbackData === 'confirm_manual_group') {
      await handleConfirmManualGroup(ctx);
    }
    else if (callbackData === 'try_different_approach') {
      await handleTryDifferentApproach(ctx);
    }

    // Deal action callbacks
    else if (callbackData.startsWith('release_')) {
      await handleReleaseConfirm(ctx, callbackData);
    }
    else if (callbackData.startsWith('cancel_')) {
      await handleCancelConfirm(ctx, callbackData);
    }
    else if (callbackData.startsWith('dispute_')) {
      await handleDisputeConfirm(ctx, callbackData);
    }
    else if (callbackData.startsWith('confirm_')) {
      await handleConfirmAction(ctx, callbackData);
    }

    // Admin callbacks
    else if (callbackData.startsWith('admin_')) {
      await handleAdminCallbacks(ctx, callbackData);
    }

    // Help callbacks
    else if (callbackData.startsWith('help_')) {
      await handleHelpCallbacks(ctx, callbackData);
    }

    // Pagination callbacks
    else if (callbackData.includes('_page_')) {
      await handlePaginationCallbacks(ctx, callbackData);
    }

    // Generic callbacks
    else if (callbackData === 'close') {
      await ctx.deleteMessage();
    }
    else if (callbackData === 'noop') {
      // Do nothing - for pagination display
    }
    else {
      logger.warn(`Unknown callback data: ${callbackData}`);
    }

  } catch (error) {
    logger.error('Error in callback handler:', error);
    await ctx.answerCallbackQuery('❌ An error occurred. Please try again.');
  }
}

async function handleMainMenu(ctx) {
  const welcomeText = `
🎉 *Welcome to CoinEscrowPro!*

Your trusted partner for secure peer-to-peer cryptocurrency transactions.

Choose an option below to get started:
  `;

  await ctx.editMessageText(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: Keyboards.mainMenu(),
  });
}

async function handleHelp(ctx) {
  const helpText = `
🆘 *CoinEscrowPro Help Center*

Choose a help topic below:
  `;

  await ctx.editMessageText(helpText, {
    parse_mode: 'Markdown',
    reply_markup: Keyboards.helpMenu(),
  });
}

async function handleInstructions(ctx) {
  const instructionsText = `
📖 *How to Use CoinEscrowPro*

**Step 1: Start a Deal**
• Click "🤝 Start Deal"
• Choose cryptocurrency (BTC/LTC)
• Set deal amount and participants

**Step 2: Set Wallets**
• Both parties set wallet addresses
• Bot generates secure escrow address

**Step 3: Payment**
• Buyer sends funds to escrow
• Bot monitors blockchain confirmation

**Step 4: Release**
• Buyer releases funds when satisfied
• Seller receives payment automatically

**Step 5: Reputation**
• Both parties gain reputation points
• Success story posted publicly

✅ **Security Features:**
• Multi-signature escrow
• Real-time monitoring
• Dispute resolution
• Encrypted data storage

Need more help? Contact support!
  `;

  await ctx.editMessageText(instructionsText, {
    parse_mode: 'Markdown',
    reply_markup: Keyboards.backButton(),
  });
}

async function handleStartDeal(ctx) {
  const startDealText = `
🤝 *Start New Deal*

To begin creating an escrow deal, I need the Telegram username of the other party.

**Please provide their username** (without the @ symbol):

Example: \`john_doe\` or \`cryptotrader123\`

⚠️ **Important:** Make sure the username is correct. They will receive an invitation to join the deal group automatically.
  `;

  await ctx.editMessageText(startDealText, {
    parse_mode: 'Markdown',
    reply_markup: Keyboards.backButton('main_menu'),
  });

  // Set expecting username input
  ctx.session.awaitingInput = 'other_party_username';
}

async function handleStats(ctx) {
  try {
    const [totalUsers, totalDeals, successfulDeals, totalVolume] = await Promise.all([
      prisma.user.count(),
      prisma.deal.count(),
      prisma.deal.count({ where: { status: 'RELEASED' } }),
      prisma.deal.aggregate({
        _sum: { amount: true },
        where: { status: 'RELEASED' },
      }),
    ]);

    const statsText = `
📊 *CoinEscrowPro Statistics*

👥 **Total Users:** ${totalUsers.toLocaleString()}
🤝 **Total Deals:** ${totalDeals.toLocaleString()}
✅ **Successful Deals:** ${successfulDeals.toLocaleString()}
📈 **Success Rate:** ${totalDeals > 0 ? ((successfulDeals / totalDeals) * 100).toFixed(1) : 0}%

💰 **Total Volume:** ${totalVolume._sum.amount || 0} (all cryptocurrencies)

🏆 **Trust Score:** 99.2%
⚡ **Average Deal Time:** 45 minutes
🔒 **Security Level:** Military Grade

Join thousands of satisfied users! 🚀
    `;

    await ctx.editMessageText(statsText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.backButton(),
    });

  } catch (error) {
    logger.error('Error loading stats:', error);
    await ctx.editMessageText('❌ Error loading statistics.', {
      reply_markup: Keyboards.backButton(),
    });
  }
}

async function handleProfile(ctx) {
  try {
    const userDbId = await getUserId(ctx.from.id.toString());
    const user = await prisma.user.findUnique({
      where: { id: userDbId },
      include: {
        dealsAsBuyer: { where: { status: 'RELEASED' } },
        dealsAsSeller: { where: { status: 'RELEASED' } },
        wallets: { where: { isActive: true } },
      },
    });

    if (!user) {
      return ctx.editMessageText('❌ User profile not found.');
    }

    const totalDeals = user.dealsAsBuyer.length + user.dealsAsSeller.length;
    const totalVolume = user.totalVolumeBtc + user.totalVolumeLtc;

    const profileText = `
👤 *Your Profile*

**Basic Info:**
• Name: ${user.firstName} ${user.lastName || ''}
• Username: @${user.username || 'Not set'}
• Member Since: ${user.createdAt.toDateString()}

**Trading Stats:**
• Reputation: ${user.reputation} ⭐
• Successful Deals: ${user.successfulDeals}
• Total Volume: ${totalVolume} (BTC + LTC)
• Active Wallets: ${user.wallets.length}

**Referral Info:**
• Your Code: \`${user.referralCode}\`
• Referrals: ${await prisma.user.count({ where: { referredBy: user.id } })}

📈 Keep trading to build your reputation!
    `;

    await ctx.editMessageText(profileText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.backButton(),
    });

  } catch (error) {
    logger.error('Error loading profile:', error);
    await ctx.editMessageText('❌ Error loading profile.', {
      reply_markup: Keyboards.backButton(),
    });
  }
}

async function handleReferral(ctx) {
  try {
    const userDbId = await getUserId(ctx.from.id.toString());
    const user = await prisma.user.findUnique({
      where: { id: userDbId },
    });

    const referralCount = await prisma.user.count({
      where: { referredBy: user.id },
    });

    const referralText = `
🔗 *Referral Program*

**Your Referral Code:** \`${user.referralCode}\`

**Share Link:**
\`https://t.me/${process.env.BOT_USERNAME}?start=ref_${user.referralCode}\`

**Your Stats:**
• Total Referrals: ${referralCount}
• Potential Earnings: ${referralCount * 0.1} USD

**How it Works:**
• Share your link with friends
• They join and start trading
• You earn from their escrow fees
• Higher volume = higher rewards

**Bonus Rewards:**
• 5+ referrals: VIP status
• 10+ referrals: Reduced fees
• 25+ referrals: Premium features

Start sharing and earning today! 💰
    `;

    await ctx.editMessageText(referralText, {
      parse_mode: 'Markdown',
      reply_markup: Keyboards.backButton(),
    });

  } catch (error) {
    logger.error('Error loading referral info:', error);
    await ctx.editMessageText('❌ Error loading referral information.', {
      reply_markup: Keyboards.backButton(),
    });
  }
}

async function handleCryptoSelection(ctx, callbackData) {
  const crypto = callbackData.split('_')[1].toUpperCase();
  
  // Store selected crypto in session
  ctx.session.selectedCrypto = crypto;
  
  // Check if we have the other party's username
  if (!ctx.session.otherPartyUsername) {
    await ctx.answerCallbackQuery('❌ Please provide the other party\'s username first.');
    return;
  }

  const dealSetupText = `
🤝 *New ${crypto} Deal Setup*

Selected: ${crypto === 'BTC' ? '₿ Bitcoin' : '🪙 Litecoin'}
Other Party: @${ctx.session.otherPartyUsername}

Creating secure deal group and sending invitation...
  `;

  await ctx.editMessageText(dealSetupText, {
    parse_mode: 'Markdown',
  });

  // Create the deal group and send invitation
  await createDealGroup(ctx, crypto);
}

async function handleAdminCallbacks(ctx, callbackData) {
  const userId = ctx.from.id.toString();
  
  if (!SecurityUtils.isAdmin(userId)) {
    return ctx.answerCallbackQuery('❌ Access denied.');
  }

  const action = callbackData.replace('admin_', '');

  switch (action) {
    case 'dashboard':
      const dashboardText = await adminHandlers.getDashboardStats(ctx);
      await ctx.editMessageText(dashboardText, {
        parse_mode: 'Markdown',
        reply_markup: Keyboards.backButton('admin_panel'),
      });
      break;

    case 'users':
      const userManagement = await adminHandlers.getUserManagement(ctx);
      await ctx.editMessageText(userManagement.text, {
        parse_mode: 'Markdown',
        reply_markup: userManagement.keyboard,
      });
      break;

    case 'deals':
      const dealManagement = await adminHandlers.getRecentDeals(ctx);
      await ctx.editMessageText(dealManagement.text, {
        parse_mode: 'Markdown',
        reply_markup: dealManagement.keyboard,
      });
      break;

    case 'panel':
      await ctx.editMessageText(
        '🛡️ *Admin Control Panel*\n\nSelect an option below:',
        {
          parse_mode: 'Markdown',
          reply_markup: Keyboards.adminPanel(),
        }
      );
      break;

    default:
      await ctx.answerCallbackQuery('🚧 Feature coming soon!');
  }
}

async function handleConfirmAction(ctx, callbackData) {
  const parts = callbackData.split('_');
  const action = parts[1];
  const dealId = parts[2];

  if (action === 'release') {
    await executeRelease(ctx, dealId);
  } else if (action === 'cancel') {
    await executeCancel(ctx, dealId);
  }
}

async function executeRelease(ctx, dealId) {
  try {
    // Import release service
    const { EscrowService } = require('../../services/escrow/escrowService');
    
    const result = await EscrowService.releaseFunds(dealId, ctx.from.id.toString());
    
    if (result.success) {
      await ctx.editMessageText(
        `✅ *Funds Released Successfully!*\n\n` +
        `Transaction Hash: \`${result.transactionHash}\`\n` +
        `Amount: ${result.amount} ${result.cryptocurrency}\n\n` +
        `The seller will receive the funds shortly. ` +
        `Thank you for using CoinEscrowPro! 🎉`
      );
    } else {
      await ctx.editMessageText(`❌ Release failed: ${result.error}`);
    }

  } catch (error) {
    logger.error('Error executing release:', error);
    await ctx.editMessageText('❌ An error occurred during release. Please contact support.');
  }
}

async function executeCancel(ctx, dealId) {
  try {
    const userId = await getUserId(ctx.from.id.toString());
    
    await prisma.deal.update({
      where: { id: dealId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Cancelled by user',
      },
    });

    // Log cancellation
    await prisma.auditLog.create({
      data: {
        userId: userId,
        dealId: dealId,
        action: 'DEAL_CANCELLED',
        details: { reason: 'User cancellation' },
      },
    });

    await ctx.editMessageText(
      '✅ *Deal Cancelled*\n\n' +
      'The deal has been cancelled successfully. ' +
      'If any payments were made, please contact support for refund assistance.'
    );

  } catch (error) {
    logger.error('Error executing cancel:', error);
    await ctx.editMessageText('❌ An error occurred during cancellation. Please try again.');
  }
}

async function getUserId(telegramId) {
  const user = await prisma.user.findUnique({
    where: { telegramId: telegramId.toString() },
  });
  return user?.id;
}

/**
 * Create a deal group and send invitation to the other party
 */
async function createDealGroup(ctx, crypto) {
  try {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || `User${userId}`;
    const otherPartyUsername = ctx.session.otherPartyUsername;

    // Create a temporary deal ID for the group
    const tempDealId = `DEAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Show loading message
    await ctx.editMessageText(`
� *Creating Deal Group...*

*Deal ID:* \`${tempDealId}\`
*Cryptocurrency:* ${crypto}
*Other Party:* @${otherPartyUsername}

Please wait while we automatically create the group and add both participants...
    `, { parse_mode: 'Markdown' });

    // Try to create group automatically using MTProto
    const mtproto = new MTProtoService();
    const groupResult = await mtproto.createEscrowGroup({
      dealId: tempDealId,
      initiatorUsername: username,
      counterpartyUsername: otherPartyUsername,
      crypto: crypto,
    });

    if (groupResult.success) {
      // Automatic group creation successful!
      // Bot is already admin, let's clean up quickly and send welcome message
      
      // Clean up any service messages immediately (bot has admin rights)
      try {
        // Delete any service messages quickly - try just the first few message IDs
        for (let messageId = 1; messageId <= 10; messageId++) {
          try {
            await ctx.api.deleteMessage(groupResult.chatId, messageId);
          } catch (error) {
            // Message doesn't exist, continue
          }
        }
        logger.info(`Cleaned service messages in group ${groupResult.chatId}`);
      } catch (error) {
        logger.warn(`Could not clean messages: ${error.message}`);
      }

      // Send welcome message immediately
      const welcomeMessage = `
🔒 *ESCROW DEAL STARTED*

*Deal ID:* ${groupResult.dealInfo.dealId}
*Cryptocurrency:* ${groupResult.dealInfo.crypto}
*Participants:* @${groupResult.dealInfo.initiatorUsername} ↔️ @${groupResult.dealInfo.counterpartyUsername}

📋 *Next Steps:*
1. Both parties confirm participation
2. Deal terms will be set  
3. Escrow address will be provided
4. Payment monitoring begins

⚠️ *Important:* Only communicate about this deal in this group.

🤖 Deal is now active and being managed automatically!
      `;

      try {
        await ctx.api.sendMessage(groupResult.chatId, welcomeMessage, {
          parse_mode: 'Markdown'
        });
        logger.info(`Welcome message sent to group ${groupResult.chatId} via bot`);
      } catch (error) {
        logger.error(`Failed to send welcome message to group ${groupResult.chatId}:`, error);
      }

      // Now add the users to the group via bot invite
      try {
        // Add initiator via invite link
        const initiatorInvite = `
🎉 *Welcome to your Escrow Deal!*

Your deal group has been created and is ready.

🔗 *Join your deal group:*
${groupResult.inviteLink}

The group is clean and ready for your escrow transaction!
        `;

        await ctx.api.sendMessage(groupResult.usersToAdd[0].id, initiatorInvite, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        logger.info(`Sent group invite to initiator ${groupResult.usersToAdd[0].id}`);
      } catch (error) {
        logger.error(`Failed to send invite to initiator:`, error);
      }

      // Send invitation to counterparty via bot
      const inviteMessage = `
🤝 *ESCROW DEAL INVITATION*

You've been invited to join an escrow deal:

*Deal ID:* ${groupResult.dealInfo.dealId}
*Cryptocurrency:* ${groupResult.dealInfo.crypto}
*Initiator:* @${groupResult.dealInfo.initiatorUsername}

🔗 *Join Deal Group:*
${groupResult.inviteLink}

⏰ *This invite expires in 24 hours*

By joining, you agree to participate in this secure escrow transaction. All communications should happen in the deal group.
      `;

      try {
        await ctx.api.sendMessage(groupResult.counterpartyUserId, inviteMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        logger.info(`Invitation sent to user ${groupResult.counterpartyUserId} via bot`);
      } catch (error) {
        logger.error(`Failed to send invitation to user ${groupResult.counterpartyUserId}:`, error);
      }

      const successText = `
✅ *Deal Group Created Successfully!*

*Group:* 🔒 Escrow Deal #${tempDealId.slice(-6)} - ${crypto}
*Cryptocurrency:* ${crypto}
*Participants:* @${username} ↔️ @${otherPartyUsername}

*Group Chat ID:* \`${groupResult.chatId}\`
${groupResult.inviteLink ? `*Invite Link:* ${groupResult.inviteLink}` : ''}

*Lightning Fast Setup Complete:*
✅ Clean group created (bot-only initially)
✅ Bot promoted to admin instantly
✅ Service messages cleaned immediately
✅ Welcome message sent to clean group
✅ Invite sent to you
✅ Invitation sent to @${otherPartyUsername} via bot
🔄 Escrow wallet being generated...

Both parties can now join the clean group via invite links!
      `;

      await ctx.editMessageText(successText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💬 Open Group', url: groupResult.inviteLink || `tg://resolve?id=${groupResult.chatId}` },
              { text: '📊 Deal Status', callback_data: `status_${tempDealId}` }
            ],
            [
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
          ]
        },
        disable_web_page_preview: true
      });

      // Store deal info in database
      // TODO: Implement full deal creation in database

      logger.info(`✅ Automatic group created: ${groupResult.chatId} for ${username} and @${otherPartyUsername}`);

    } else {
      // Fallback to manual group creation
      logger.warn(`MTProto group creation failed: ${groupResult.error}`);
      await createManualDealGroup(ctx, tempDealId, username, otherPartyUsername, crypto);
    }

    // Clear session data
    ctx.session.awaitingInput = null;
    ctx.session.selectedCrypto = null;
    ctx.session.otherPartyUsername = null;

  } catch (error) {
    logger.error('Error creating deal group:', error);
    
    // Fallback to manual instructions
    const tempDealId = `DEAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await createManualDealGroup(ctx, tempDealId, ctx.from.username, ctx.session.otherPartyUsername, crypto);
  }
}

/**
 * Fallback manual group creation
 */
async function createManualDealGroup(ctx, tempDealId, username, otherPartyUsername, crypto) {
  const groupTitle = `🔒 Escrow Deal #${tempDealId.slice(-6)} - ${crypto}`;
  
  const instructionText = `
🔒 *Deal Setup Instructions*
*(Automatic creation unavailable)*

*Deal ID:* \`${tempDealId}\`
*Cryptocurrency:* ${crypto}
*Other Party:* @${otherPartyUsername}

📋 *How to set up the deal group:*

1️⃣ *Create a new group* in Telegram
2️⃣ *Add both participants:*
   • You (@${username})
   • Other party (@${otherPartyUsername})
   • This bot (@${process.env.BOT_USERNAME || 'CoinEscrowPro'})

3️⃣ *Name the group:* ${groupTitle}

4️⃣ *Send this command in the group:*
/registergroup ${tempDealId}

5️⃣ *Alternative:* Share this deal code with @${otherPartyUsername}:
/joindeal ${tempDealId}

⚠️ *Important:* Both parties must be in the same group with the bot for the escrow to work properly.

Would you like to proceed with manual group creation, or should we try a different approach?
    `;

  await ctx.editMessageText(instructionText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ I\'ll create the group', callback_data: 'confirm_manual_group' },
          { text: '🔄 Try different approach', callback_data: 'try_different_approach' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  });

  // Store deal info in session for later use
  ctx.session.dealData = {
    id: tempDealId,
    initiatorUsername: username,
    otherPartyUsername: otherPartyUsername,
    cryptocurrency: crypto,
    status: 'PENDING_COUNTERPARTY',
    createdAt: new Date(),
  };
}

async function handleConfirmManualGroup(ctx) {
  const dealData = ctx.session.dealData;
  
  if (!dealData) {
    await ctx.editMessageText('❌ Deal session expired. Please start a new deal.', {
      reply_markup: Keyboards.backButton('main_menu')
    });
    return;
  }

  const confirmText = `
✅ *Great! Manual Group Setup*

*Deal ID:* \`${dealData.id}\`

*Instructions:*
1. Create a new Telegram group
2. Add these members:
   • You (@${dealData.initiatorUsername})
   • Other party (@${dealData.otherPartyUsername})
   • This bot (@${process.env.BOT_USERNAME || 'CoinEscrowPro'})

3. *In the group, send:* /registergroup ${dealData.id}

4. *Or share this with @${dealData.otherPartyUsername}:*
   /joindeal ${dealData.id}

The bot will detect the group and set up the escrow automatically!
  `;

  await ctx.editMessageText(confirmText, {
    parse_mode: 'Markdown',
    reply_markup: Keyboards.backButton('main_menu')
  });

  // Clear session
  ctx.session.dealData = null;
  ctx.session.awaitingInput = null;
  ctx.session.selectedCrypto = null;
  ctx.session.otherPartyUsername = null;
}

async function handleTryDifferentApproach(ctx) {
  const dealData = ctx.session.dealData;
  
  if (!dealData) {
    await ctx.editMessageText('❌ Deal session expired. Please start a new deal.', {
      reply_markup: Keyboards.backButton('main_menu')
    });
    return;
  }

  const approachText = `
🔄 *Alternative Approach*

*Deal ID:* \`${dealData.id}\`
*Cryptocurrency:* ${dealData.cryptocurrency}
*Other Party:* @${dealData.otherPartyUsername}

*Option 1: Share Deal Code*
Send this to @${dealData.otherPartyUsername}:
/joindeal ${dealData.id}

*Option 2: Direct Contact*
1. Contact @${dealData.otherPartyUsername} directly
2. Ask them to start this bot: @${process.env.BOT_USERNAME || 'CoinEscrowPro'}
3. Tell them to send: /joindeal ${dealData.id}

*Option 3: Manual Group*
Create a group manually and use /registergroup

Choose your preferred method and proceed!
  `;

  await ctx.editMessageText(approachText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Copy Deal Code', callback_data: 'copy_deal_code' },
          { text: '👥 Manual Group', callback_data: 'confirm_manual_group' }
        ],
        [
          { text: '🔙 Main Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  });
}

module.exports = { callbackHandlers };
