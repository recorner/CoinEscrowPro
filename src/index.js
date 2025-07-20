require('dotenv').config();
const { Bot, GrammyError, HttpError, session } = require('grammy');
const { PrismaClient } = require('@prisma/client');
const winston = require('winston');

// Import bot components
const { createInitialSession } = require('./bot/middleware/session');
const { rateLimiter } = require('./bot/middleware/rateLimiter');
const { errorHandler } = require('./bot/middleware/errorHandler');
const { Keyboards } = require('./bot/keyboards');
const { logger } = require('./utils/logger');
const { startHandler } = require('./bot/handlers/start');
const { dealHandlers } = require('./bot/handlers/deal');
const { walletHandlers } = require('./bot/handlers/wallet');
const { adminHandlers } = require('./bot/handlers/admin');
const { callbackHandlers } = require('./bot/handlers/callbacks');
const { handleGroupMessage } = require('./bot/handlers/groupMessages');
const { setupCronJobs } = require('./services/scheduler');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize bot
const bot = new Bot(process.env.BOT_TOKEN);

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Bot middleware
bot.use(session({
  initial: createInitialSession
}));

bot.use(rateLimiter);
bot.use(errorHandler);

// Command handlers
bot.command('start', startHandler);

// Deal management commands
bot.command('help', dealHandlers.helpHandler);
bot.command('rules', dealHandlers.rulesHandler);
bot.command('set', dealHandlers.setCryptoHandler);
bot.command('setwallet', walletHandlers.setWalletHandler);
bot.command('wallet', walletHandlers.walletHandler);
bot.command('release', dealHandlers.releaseHandler);
bot.command('cancel', dealHandlers.cancelHandler);
bot.command('dispute', dealHandlers.disputeHandler);
bot.command('report', dealHandlers.reportHandler);
bot.command('extend', dealHandlers.extendHandler);
bot.command('balance', dealHandlers.balanceHandler);
bot.command('txid', dealHandlers.txidHandler);
bot.command('vouch', dealHandlers.vouchHandler);
bot.command('botstats', dealHandlers.statsHandler);
bot.command('whoami', dealHandlers.whoamiHandler);

// Admin commands
bot.command('admin', adminHandlers.adminPanelHandler);
bot.command('broadcast', adminHandlers.broadcastHandler);
bot.command('registergroup', adminHandlers.registerGroupHandler);

// Deal joining command
bot.command('joindeal', dealHandlers.joinDealHandler);

// Callback query handlers
bot.on('callback_query', callbackHandlers);

// Text message handlers
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const messageText = ctx.message.text;

  // Handle group messages first (for escrow deal commands)
  if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
    await handleGroupMessage(ctx);
    return;
  }

  // Skip if it's a command
  if (messageText.startsWith('/')) return;

  // Handle awaiting input states
  if (ctx.session?.awaitingInput) {
    await handleAwaitingInput(ctx, messageText);
  }
});

// Handle group events
bot.on('my_chat_member', async (ctx) => {
  const { chat, new_chat_member } = ctx.update.my_chat_member;
  
  if (new_chat_member.status === 'member' || new_chat_member.status === 'administrator') {
    // Bot was added to a group
    logger.info(`Bot added to group: ${chat.title} (${chat.id})`);
    
    // Save group info to database
    try {
      const group = await prisma.group.upsert({
        where: { telegramId: chat.id.toString() },
        update: {
          title: chat.title,
          isActive: true,
        },
        create: {
          telegramId: chat.id.toString(),
          title: chat.title || 'Unknown Group',
          isActive: true,
        },
      });

      // Automatically create a new deal for this group
      const dealNumber = Math.random().toString(36).substr(2, 9).toUpperCase();
      const newDeal = await prisma.deal.create({
        data: {
          id: `DEAL_${Date.now()}_${dealNumber}`,
          dealNumber: dealNumber,
          cryptocurrency: 'BTC', // Default to BTC, users can change with /set command
          amount: 0, // Will be set later
          status: 'PENDING',
          groupId: group.id, // Use the database Group ID, not Telegram chat ID
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      // Send welcome message to the group
      await ctx.api.sendMessage(chat.id, 
        `🤖 **CoinEscrowPro Bot Activated!**\n\n` +
        `✅ Deal ID: \`${newDeal.id}\`\n` +
        `💰 Default Cryptocurrency: ${newDeal.cryptocurrency}\n\n` +
        `**How to use:**\n` +
        `• Buyer: Send \`/buyer <your_address>\`\n` +
        `• Seller: Send \`/seller <your_address>\`\n` +
        `• Change crypto: \`/set <BTC|LTC>\`\n` +
        `• Set amount: \`/amount <value>\`\n\n` +
        `🔒 Once both addresses are provided, an escrow address will be generated automatically!`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Created new deal ${newDeal.id} for group ${chat.title}`);
      
    } catch (error) {
      logger.error('Error saving group info or creating deal:', error);
    }
  }
});

// Handle new members in groups
bot.on('message:new_chat_members', async (ctx) => {
  const { chat, new_chat_members } = ctx.message;
  
  for (const member of new_chat_members) {
    if (!member.is_bot) {
      // Check if this is a deal group and add member to deal
      // Implementation depends on your group naming/identification strategy
      logger.info(`New member ${member.username} joined group ${chat.title}`);
    }
  }
});

// Bot error handling
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Error while handling update ${ctx.update.update_id}:`);
  
  const e = err.error;
  if (e instanceof GrammyError) {
    logger.error('Error in request:', e.description);
  } else if (e instanceof HttpError) {
    logger.error('Could not contact Telegram:', e);
  } else {
    logger.error('Unknown error:', e);
  }
});

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  try {
    await bot.stop();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start the bot
async function startBot() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Setup cron jobs
    setupCronJobs();
    logger.info('✅ Cron jobs initialized');

    // Start the bot
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
      // Use webhooks in production
      await bot.api.setWebhook(process.env.WEBHOOK_URL, {
        secret_token: process.env.WEBHOOK_SECRET,
      });
      logger.info('✅ Webhook set successfully');
      
      // Start express server for webhooks
      const express = require('express');
      const app = express();
      
      app.use(express.json());
      app.post('/webhook', async (req, res) => {
        try {
          await bot.handleUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          logger.error('Webhook error:', error);
          res.sendStatus(500);
        }
      });
      
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        logger.info(`✅ Bot server running on port ${port}`);
      });
    } else {
      // Use long polling in development
      await bot.start();
      logger.info('✅ Bot started with long polling');
    }

    logger.info('🚀 CoinEscrowPro Bot is now running!');
  } catch (error) {
    logger.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * Handle text input when the bot is waiting for specific user input
 */
async function handleAwaitingInput(ctx, messageText) {
  const awaitingType = ctx.session.awaitingInput;

  try {
    switch (awaitingType) {
      case 'other_party_username':
        await handleUsernameInput(ctx, messageText);
        break;
      
      default:
        logger.warn(`Unknown awaiting input type: ${awaitingType}`);
        ctx.session.awaitingInput = null;
    }
  } catch (error) {
    logger.error('Error handling awaiting input:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
    ctx.session.awaitingInput = null;
  }
}

/**
 * Handle username input for deal creation
 */
async function handleUsernameInput(ctx, username) {
  // Clean the username (remove @ if present)
  const cleanUsername = username.replace('@', '').trim();
  
  // Basic validation
  if (!cleanUsername || cleanUsername.length < 3) {
    await ctx.reply('❌ Please provide a valid username (at least 3 characters).');
    return;
  }

  if (cleanUsername.includes(' ') || !/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    await ctx.reply('❌ Invalid username format. Usernames can only contain letters, numbers, and underscores.');
    return;
  }

  // Check if user is trying to deal with themselves
  if (cleanUsername.toLowerCase() === ctx.from.username?.toLowerCase()) {
    await ctx.reply('❌ You cannot create a deal with yourself.');
    return;
  }

  // Store username in session
  ctx.session.otherPartyUsername = cleanUsername;

  // Show crypto selection
  const cryptoSelectionText = `
✅ **Other Party Set:** @${cleanUsername}

Now choose the cryptocurrency for your escrow deal:
  `;

  await ctx.reply(cryptoSelectionText, {
    parse_mode: 'Markdown',
    reply_markup: Keyboards.cryptoSelection(),
  });

  // Clear awaiting input
  ctx.session.awaitingInput = null;
}

// Initialize the bot
startBot();
