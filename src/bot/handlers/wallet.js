const { PrismaClient } = require('@prisma/client');
const { SecurityUtils } = require('../../utils/security');
const { logger } = require('../../utils/logger');

const prisma = new PrismaClient();

class WalletHandlers {
  static async setWalletHandler(ctx) {
    const address = ctx.match;
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    if (!address) {
      return ctx.reply(
        '❌ Please provide wallet address. Example: `/setwallet 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`',
        { parse_mode: 'Markdown' }
      );
    }

    if (chat.type === 'private') {
      return ctx.reply('❌ This command can only be used in a deal group.');
    }

    try {
      // Find active deal in this group
      const userDbId = await getUserId(userId);
      const deal = await prisma.deal.findFirst({
        where: {
          groupId: chat.id.toString(),
          status: {
            in: ['PENDING', 'WAITING_PAYMENT'],
          },
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
        return ctx.reply('❌ No active deal found or you are not part of this deal.');
      }

      if (!deal.cryptocurrency) {
        return ctx.reply('❌ Please set cryptocurrency first using `/set btc` or `/set ltc`');
      }

      // Validate address format
      const isValidAddress = deal.cryptocurrency === 'BTC' 
        ? SecurityUtils.isValidBitcoinAddress(address)
        : SecurityUtils.isValidLitecoinAddress(address);

      if (!isValidAddress) {
        return ctx.reply(`❌ Invalid ${deal.cryptocurrency} address format.`);
      }

      // Determine user role
      const userRole = deal.buyerId === userDbId ? 'BUYER' : 'SELLER';

      // Create or update wallet
      const wallet = await prisma.wallet.upsert({
        where: {
          userId_address: {
            userId: userDbId,
            address: address,
          },
        },
        update: {
          isActive: true,
          crypto: deal.cryptocurrency,
        },
        create: {
          userId: userDbId,
          address: address,
          crypto: deal.cryptocurrency,
          label: `${deal.cryptocurrency} Wallet`,
          isActive: true,
        },
      });

      // Link wallet to deal
      await prisma.dealWallet.upsert({
        where: {
          dealId_role: {
            dealId: deal.id,
            role: userRole,
          },
        },
        update: {
          walletId: wallet.id,
        },
        create: {
          dealId: deal.id,
          walletId: wallet.id,
          role: userRole,
        },
      });

      // Log wallet setting
      await prisma.auditLog.create({
        data: {
          userId: userDbId,
          dealId: deal.id,
          action: 'WALLET_SET',
          details: {
            address: address,
            crypto: deal.cryptocurrency,
            role: userRole,
          },
        },
      });

      await ctx.reply(
        `✅ *Wallet Set Successfully*\n\n` +
        `Role: ${userRole}\n` +
        `Address: \`${address}\`\n` +
        `Crypto: ${deal.cryptocurrency}\n\n` +
        `${userRole === 'BUYER' ? '💰 You can now wait for the escrow address to be generated.' : '📨 Wait for buyer to fund the escrow.'}`
      );

      // Check if both wallets are set
      const dealWallets = await prisma.dealWallet.count({
        where: { dealId: deal.id },
      });

      if (dealWallets === 2) {
        // Both wallets set, generate escrow address
        await generateEscrowAddress(ctx, deal);
      }

    } catch (error) {
      logger.error('Error setting wallet:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  static async walletHandler(ctx) {
    const userId = ctx.from.id.toString();
    const chat = ctx.chat;

    try {
      const userDbId = await getUserId(userId);
      
      if (chat.type === 'private') {
        // Show all user wallets
        const wallets = await prisma.wallet.findMany({
          where: {
            userId: userDbId,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (wallets.length === 0) {
          return ctx.reply('❌ No wallets found. Use `/setwallet <address>` in a deal group to add one.');
        }

        let walletText = '👛 *Your Wallets:*\n\n';
        wallets.forEach((wallet, index) => {
          walletText += `${index + 1}. **${wallet.crypto}**\n`;
          walletText += `   \`${wallet.address}\`\n`;
          walletText += `   ${wallet.label || 'No label'}\n\n`;
        });

        await ctx.reply(walletText, { parse_mode: 'Markdown' });

      } else {
        // Show wallet for current deal
        const deal = await prisma.deal.findFirst({
          where: {
            groupId: chat.id.toString(),
            OR: [
              { buyerId: userDbId },
              { sellerId: userDbId },
            ],
          },
          include: {
            wallets: {
              include: {
                wallet: true,
              },
              where: {
                wallet: {
                  userId: userDbId,
                },
              },
            },
          },
        });

        if (!deal) {
          return ctx.reply('❌ No deal found in this group.');
        }

        const dealWallet = deal.wallets[0];
        if (!dealWallet) {
          return ctx.reply('❌ No wallet set for this deal. Use `/setwallet <address>` to set one.');
        }

        const role = dealWallet.role;
        const wallet = dealWallet.wallet;

        const walletText = `
👛 *Your Deal Wallet*

🎭 **Role:** ${role}
💰 **Crypto:** ${wallet.crypto}
📍 **Address:** \`${wallet.address}\`
✅ **Status:** ${wallet.isVerified ? 'Verified' : 'Unverified'}
        `;

        await ctx.reply(walletText, { parse_mode: 'Markdown' });
      }

    } catch (error) {
      logger.error('Error showing wallet:', error);
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

async function generateEscrowAddress(ctx, deal) {
  try {
    // Import wallet service
    const { WalletService } = require('../../services/wallet/walletService');
    
    const escrowData = await WalletService.generateEscrowAddress(deal.cryptocurrency);
    
    if (!escrowData) {
      logger.error('Failed to generate escrow address');
      return;
    }

    // Update deal with escrow information
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        escrowAddress: escrowData.address,
        escrowPrivateKey: SecurityUtils.encrypt(escrowData.privateKey),
        status: 'WAITING_PAYMENT',
        expiresAt: new Date(Date.now() + deal.timeoutMinutes * 60 * 1000),
      },
    });

    // Generate QR code
    const QRCode = require('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(escrowData.address);
    
    // Convert data URL to buffer
    const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

    const escrowMessage = `
🏦 *Escrow Address Generated*

🆔 **Deal:** \`${deal.dealNumber}\`
💰 **Amount:** ${deal.amount} ${deal.cryptocurrency}
📍 **Escrow Address:** \`${escrowData.address}\`

⏰ **Timeout:** ${deal.timeoutMinutes} minutes
⚡ **Required Confirmations:** ${deal.confirmationsReq}

💡 **Buyer:** Please send exactly ${deal.amount} ${deal.cryptocurrency} to the escrow address.
🔍 **Seller:** Wait for payment confirmation.

⚠️ *Do not send from an exchange! Use a personal wallet only.*
    `;

    // Send message with QR code
    await ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption: escrowMessage,
        parse_mode: 'Markdown',
      }
    );

    // Log escrow generation
    await prisma.auditLog.create({
      data: {
        dealId: deal.id,
        action: 'ESCROW_GENERATED',
        details: {
          address: escrowData.address,
          crypto: deal.cryptocurrency,
        },
      },
    });

    logger.info(`Escrow address generated for deal ${deal.dealNumber}: ${escrowData.address}`);

  } catch (error) {
    logger.error('Error generating escrow address:', error);
    await ctx.reply('❌ Failed to generate escrow address. Please contact support.');
  }
}

module.exports = { walletHandlers: WalletHandlers };
