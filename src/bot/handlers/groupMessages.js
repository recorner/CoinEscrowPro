const { logger } = require('../../utils/logger');
const { validateCryptoAddress } = require('../../utils/validators');
const { PrismaClient } = require('@prisma/client');
const { WalletService } = require('../../services/wallet/walletService');
const { SecurityUtils } = require('../../utils/security');

const prisma = new PrismaClient();

/**
 * Handle messages in escrow groups
 */
async function handleGroupMessage(ctx) {
  try {
    const message = ctx.message.text;
    const chatId = ctx.chat.id.toString();
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name || 'Unknown';

    // Handle /buyer command
    if (message.startsWith('/buyer ')) {
      const address = message.split(' ')[1];
      if (!address) {
        await ctx.reply('❌ Please provide your buyer address: /buyer <your_address>');
        return;
      }
      await handleBuyerAddress(ctx, chatId, userId, username, address);
    }
    
    // Handle /seller command
    else if (message.startsWith('/seller ')) {
      const address = message.split(' ')[1];
      if (!address) {
        await ctx.reply('❌ Please provide your seller address: /seller <your_address>');
        return;
      }
      await handleSellerAddress(ctx, chatId, userId, username, address);
    }

  } catch (error) {
    logger.error('Error handling group message:', error);
    await ctx.reply('❌ An error occurred while processing your request.');
  }
}

/**
 * Handle buyer address submission
 */
async function handleBuyerAddress(ctx, chatId, userId, username, address) {
  try {
    // Find the group first
    const group = await prisma.group.findUnique({
      where: { telegramId: chatId }
    });

    if (!group) {
      await ctx.reply('❌ Group not found in database. Please contact support.');
      return;
    }

    // Find active deal for this group
    const deal = await prisma.deal.findFirst({
      where: {
        groupId: group.id,
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!deal) {
      await ctx.reply('❌ No active deal found for this group.');
      return;
    }

    // Validate the crypto address
    const isValidAddress = validateCryptoAddress(address, deal.cryptocurrency);
    if (!isValidAddress) {
      await ctx.reply(`❌ Invalid ${deal.cryptocurrency} address format. Please check and try again.`);
      return;
    }

    // Check if user is already registered as seller
    const existingSeller = deal.sellerId ? await prisma.user.findUnique({
      where: { id: deal.sellerId }
    }) : null;
    
    if (existingSeller && existingSeller.telegramId === userId) {
      await ctx.reply('❌ You are already registered as the seller for this deal.');
      return;
    }

    // Ensure user exists in database
    const user = await prisma.user.upsert({
      where: { telegramId: userId },
      update: {
        username: username,
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
      },
      create: {
        telegramId: userId,
        username: username,
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
        isActive: true,
        referralCode: SecurityUtils.generateReferralCode(),
      },
    });

    // Update deal with buyer info
    const updatedDeal = await prisma.deal.update({
      where: { id: deal.id },
      data: {
        buyerId: user.id, // Use the database User ID, not Telegram ID
        buyerUsername: username,
        buyerAddress: address
      }
    });

    await ctx.reply(`✅ Buyer address registered!\n\n🆔 Deal: \`${deal.id}\`\n👤 Buyer: @${username}\n💰 Address: \`${address}\`\n\n${deal.sellerId ? '🔒 Both parties registered! Generating escrow address...' : '⏳ Waiting for seller to provide their address with /seller <address>'}`, 
      { parse_mode: 'Markdown' });

    // If both buyer and seller are set, generate escrow address
    if (deal.sellerId && deal.sellerAddress) {
      await generateEscrowAddress(ctx, deal.id, {
        crypto: deal.cryptocurrency,
        dealDbId: deal.id,
        buyer: { id: userId, username, address },
        seller: { id: deal.sellerId, username: deal.sellerUsername, address: deal.sellerAddress }
      });
    }

  } catch (error) {
    logger.error('Error handling buyer address:', error);
    await ctx.reply('❌ Error registering buyer address. Please try again.');
  }
}

/**
 * Handle seller address submission
 */
async function handleSellerAddress(ctx, chatId, userId, username, address) {
  try {
    // Find the group first
    const group = await prisma.group.findUnique({
      where: { telegramId: chatId }
    });

    if (!group) {
      await ctx.reply('❌ Group not found in database. Please contact support.');
      return;
    }

    // Find active deal for this group
    const deal = await prisma.deal.findFirst({
      where: {
        groupId: group.id,
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!deal) {
      await ctx.reply('❌ No active deal found for this group.');
      return;
    }

    // Validate the crypto address
    const isValidAddress = validateCryptoAddress(address, deal.cryptocurrency);
    if (!isValidAddress) {
      await ctx.reply(`❌ Invalid ${deal.cryptocurrency} address format. Please check and try again.`);
      return;
    }

    // Check if user is already registered as buyer
    const existingBuyer = deal.buyerId ? await prisma.user.findUnique({
      where: { id: deal.buyerId }
    }) : null;
    
    if (existingBuyer && existingBuyer.telegramId === userId) {
      await ctx.reply('❌ You are already registered as the buyer for this deal.');
      return;
    }

    // Ensure user exists in database
    const user = await prisma.user.upsert({
      where: { telegramId: userId },
      update: {
        username: username,
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
      },
      create: {
        telegramId: userId,
        username: username,
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
        isActive: true,
        referralCode: SecurityUtils.generateReferralCode(),
      },
    });

    // Update deal with seller info
    const updatedDeal = await prisma.deal.update({
      where: { id: deal.id },
      data: {
        sellerId: user.id, // Use the database User ID, not Telegram ID
        sellerUsername: username,
        sellerAddress: address
      }
    });

    await ctx.reply(`✅ Seller address registered!\n\n🆔 Deal: \`${deal.id}\`\n👤 Seller: @${username}\n💰 Address: \`${address}\`\n\n${deal.buyerId ? '🔒 Both parties registered! Generating escrow address...' : '⏳ Waiting for buyer to provide their address with /buyer <address>'}`, 
      { parse_mode: 'Markdown' });

    // If both buyer and seller are set, generate escrow address
    if (deal.buyerId && deal.buyerAddress) {
      await generateEscrowAddress(ctx, deal.id, {
        crypto: deal.cryptocurrency,
        dealDbId: deal.id,
        buyer: { id: deal.buyerId, username: deal.buyerUsername, address: deal.buyerAddress },
        seller: { id: userId, username, address }
      });
    }

  } catch (error) {
    logger.error('Error handling seller address:', error);
    await ctx.reply('❌ Error registering seller address. Please try again.');
  }
}

/**
 * Generate escrow address and update deal
 */
async function generateEscrowAddress(ctx, dealId, dealData) {
  try {
    // Generate escrow address using the wallet service
    const escrowWallet = await WalletService.generateEscrowAddress(dealData.crypto);
    
    if (!escrowWallet.success) {
      await ctx.reply('❌ Failed to generate escrow address. Please contact support.');
      return;
    }

    // Update deal with escrow address in database
    await prisma.deal.update({
      where: { id: dealData.dealDbId },
      data: {
        escrowAddress: escrowWallet.address,
        escrowPrivateKey: escrowWallet.encryptedPrivateKey, // Store encrypted
        status: 'WAITING_PAYMENT'
      }
    });

    // Note: We don't create a separate wallet record for escrow addresses
    // as they are already stored in the deal record with encrypted private keys

    // Send escrow details to the group
    const escrowMessage = 
      `🔒 **ESCROW ADDRESS GENERATED**\n\n` +
      `🆔 Deal ID: \`${dealId}\`\n` +
      `💰 Cryptocurrency: ${dealData.crypto}\n` +
      `📍 Escrow Address: \`${escrowWallet.address}\`\n\n` +
      `👤 **Buyer**: @${dealData.buyer.username}\n` +
      `📧 Address: \`${dealData.buyer.address}\`\n\n` +
      `👤 **Seller**: @${dealData.seller.username}\n` +
      `📧 Address: \`${dealData.seller.address}\`\n\n` +
      `📋 **Instructions:**\n` +
      `1. Buyer sends ${dealData.crypto} to escrow address\n` +
      `2. Seller provides goods/service\n` +
      `3. Buyer confirms receipt\n` +
      `4. Funds released to seller\n\n` +
      `⚠️ **WARNING**: Only send ${dealData.crypto} to this address!`;

    await ctx.reply(escrowMessage, { parse_mode: 'Markdown' });

    logger.info(`Generated escrow address ${escrowWallet.address} for deal ${dealId}`);
    
  } catch (error) {
    logger.error('Error generating escrow address:', error);
    await ctx.reply('❌ Failed to generate escrow address. Please contact support.');
  }
}

module.exports = {
  handleGroupMessage
};
