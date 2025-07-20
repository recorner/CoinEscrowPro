const { PrismaClient } = require('@prisma/client');
const { WalletService } = require('../wallet/walletService');
const { SecurityUtils } = require('../../utils/security');
const { TimeUtils } = require('../../utils/time');
const { logger } = require('../../utils/logger');

const prisma = new PrismaClient();

class EscrowService {
  static async createDeal(buyerTelegramId, sellerTelegramId, amount, cryptocurrency, options = {}) {
    try {
      // Get user IDs
      const [buyer, seller] = await Promise.all([
        prisma.user.findUnique({ where: { telegramId: buyerTelegramId } }),
        prisma.user.findUnique({ where: { telegramId: sellerTelegramId } }),
      ]);

      if (!buyer || !seller) {
        throw new Error('One or both users not found');
      }

      if (buyer.id === seller.id) {
        throw new Error('Buyer and seller cannot be the same person');
      }

      // Calculate fees
      const feePercentage = options.feePercentage || parseFloat(process.env.DEFAULT_FEE_PERCENTAGE) || 0.5;
      const feeAmount = (amount * feePercentage) / 100;
      const timeoutMinutes = options.timeoutMinutes || parseInt(process.env.DEFAULT_TIMEOUT_MINUTES) || 60;

      // Create deal
      const deal = await prisma.deal.create({
        data: {
          dealNumber: SecurityUtils.generateDealNumber(),
          buyerId: buyer.id,
          sellerId: seller.id,
          amount: amount,
          cryptocurrency: cryptocurrency,
          feePercentage: feePercentage,
          feeAmount: feeAmount,
          timeoutMinutes: timeoutMinutes,
          confirmationsReq: cryptocurrency === 'BTC' ? 
            parseInt(process.env.REQUIRED_CONFIRMATIONS_BTC) || 1 :
            parseInt(process.env.REQUIRED_CONFIRMATIONS_LTC) || 1,
          status: 'PENDING',
          referralGroupId: options.referralGroupId || null,
        },
      });

      // Log deal creation
      await prisma.auditLog.create({
        data: {
          userId: buyer.id,
          dealId: deal.id,
          action: 'DEAL_CREATED',
          details: {
            amount: amount,
            cryptocurrency: cryptocurrency,
            sellerId: seller.id,
          },
        },
      });

      logger.info(`Deal created: ${deal.dealNumber} for ${amount} ${cryptocurrency}`);
      
      return {
        success: true,
        deal: deal,
      };

    } catch (error) {
      logger.error('Error creating deal:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async generateEscrowAddress(dealId) {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          buyer: true,
          seller: true,
        },
      });

      if (!deal) {
        throw new Error('Deal not found');
      }

      if (deal.status !== 'PENDING') {
        throw new Error('Deal is not in pending status');
      }

      // Generate escrow address
      const escrowData = await WalletService.generateEscrowAddress(deal.cryptocurrency);
      
      if (!escrowData) {
        throw new Error('Failed to generate escrow address');
      }

      // Update deal with escrow information
      const updatedDeal = await prisma.deal.update({
        where: { id: dealId },
        data: {
          escrowAddress: escrowData.address,
          escrowPrivateKey: SecurityUtils.encrypt(escrowData.privateKey),
          status: 'WAITING_PAYMENT',
          expiresAt: TimeUtils.addMinutes(new Date(), deal.timeoutMinutes),
        },
      });

      // Log escrow generation
      await prisma.auditLog.create({
        data: {
          dealId: deal.id,
          action: 'ESCROW_GENERATED',
          details: {
            address: escrowData.address,
            expiresAt: updatedDeal.expiresAt,
          },
        },
      });

      logger.info(`Escrow address generated for deal ${deal.dealNumber}: ${escrowData.address}`);

      return {
        success: true,
        address: escrowData.address,
        expiresAt: updatedDeal.expiresAt,
      };

    } catch (error) {
      logger.error('Error generating escrow address:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async checkPayment(dealId) {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
      });

      if (!deal || !deal.escrowAddress) {
        return { success: false, error: 'Deal or escrow address not found' };
      }

      // Check balance on escrow address
      const balance = await WalletService.getAddressBalance(deal.escrowAddress, deal.cryptocurrency);
      
      if (balance.confirmed >= deal.amount) {
        // Payment detected and confirmed
        await this.markDealAsFunded(dealId, balance.confirmed);
        
        return {
          success: true,
          funded: true,
          amount: balance.confirmed,
          confirmations: await this.getConfirmations(deal.escrowAddress, deal.cryptocurrency),
        };
      } else if (balance.unconfirmed > 0) {
        // Payment detected but not confirmed
        return {
          success: true,
          funded: false,
          amount: balance.unconfirmed,
          confirmed: balance.confirmed,
          pending: true,
        };
      }

      return {
        success: true,
        funded: false,
        amount: 0,
      };

    } catch (error) {
      logger.error('Error checking payment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async markDealAsFunded(dealId, actualAmount) {
    try {
      const deal = await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'FUNDED',
          // Update amount if different (accounting for fees paid by network)
          ...(actualAmount !== deal.amount && { amount: actualAmount }),
        },
        include: {
          buyer: true,
          seller: true,
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          dealId: dealId,
          hash: 'pending_detection', // Will be updated when transaction hash is found
          toAddress: deal.escrowAddress,
          amount: actualAmount,
          cryptocurrency: deal.cryptocurrency,
          confirmations: deal.confirmationsReq,
          status: 'CONFIRMED',
          type: 'DEPOSIT',
        },
      });

      // Log funding
      await prisma.auditLog.create({
        data: {
          dealId: dealId,
          action: 'DEAL_FUNDED',
          details: {
            amount: actualAmount,
            escrowAddress: deal.escrowAddress,
          },
        },
      });

      logger.info(`Deal ${deal.dealNumber} marked as funded with ${actualAmount} ${deal.cryptocurrency}`);

      return { success: true };

    } catch (error) {
      logger.error('Error marking deal as funded:', error);
      return { success: false, error: error.message };
    }
  }

  static async releaseFunds(dealId, buyerTelegramId) {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
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
        throw new Error('Deal not found');
      }

      // Verify buyer authorization
      if (deal.buyer.telegramId !== buyerTelegramId) {
        throw new Error('Only the buyer can release funds');
      }

      if (deal.status !== 'FUNDED') {
        throw new Error('Deal is not funded');
      }

      if (deal.isDisputed) {
        throw new Error('Deal is under dispute');
      }

      // Get seller wallet
      const sellerWallet = deal.wallets.find(w => w.role === 'SELLER');
      if (!sellerWallet) {
        throw new Error('Seller wallet not found');
      }

      // Decrypt escrow private key
      const escrowPrivateKey = SecurityUtils.decrypt(deal.escrowPrivateKey);

      // Calculate amounts
      const netAmount = deal.amount - deal.feeAmount;
      
      // Send transaction to seller
      const txResult = await WalletService.sendTransaction(
        escrowPrivateKey,
        sellerWallet.wallet.address,
        netAmount,
        deal.cryptocurrency
      );

      if (!txResult.success) {
        throw new Error(`Transaction failed: ${txResult.error}`);
      }

      // Update deal status
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // Create release transaction record
      await prisma.transaction.create({
        data: {
          dealId: dealId,
          hash: txResult.transactionHash,
          fromAddress: deal.escrowAddress,
          toAddress: sellerWallet.wallet.address,
          amount: netAmount,
          feeAmount: txResult.fee,
          cryptocurrency: deal.cryptocurrency,
          confirmations: 0,
          status: 'PENDING',
          type: 'RELEASE',
        },
      });

      // Update user statistics
      await Promise.all([
        prisma.user.update({
          where: { id: deal.buyerId },
          data: {
            successfulDeals: { increment: 1 },
            reputation: { increment: 1 },
            [`totalVolume${deal.cryptocurrency}`]: { increment: deal.amount },
          },
        }),
        prisma.user.update({
          where: { id: deal.sellerId },
          data: {
            successfulDeals: { increment: 1 },
            reputation: { increment: 1 },
            [`totalVolume${deal.cryptocurrency}`]: { increment: deal.amount },
          },
        }),
      ]);

      // Process referral fees if applicable
      if (deal.referralGroupId) {
        await this.processReferralFee(deal);
      }

      // Log release
      await prisma.auditLog.create({
        data: {
          userId: deal.buyerId,
          dealId: dealId,
          action: 'FUNDS_RELEASED',
          details: {
            transactionHash: txResult.transactionHash,
            amount: netAmount,
            sellerAddress: sellerWallet.wallet.address,
          },
        },
      });

      logger.info(`Funds released for deal ${deal.dealNumber}: ${txResult.transactionHash}`);

      return {
        success: true,
        transactionHash: txResult.transactionHash,
        amount: netAmount,
        cryptocurrency: deal.cryptocurrency,
      };

    } catch (error) {
      logger.error('Error releasing funds:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async cancelDeal(dealId, userTelegramId, reason = 'User cancellation') {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          buyer: true,
          seller: true,
        },
      });

      if (!deal) {
        throw new Error('Deal not found');
      }

      // Verify user authorization
      const isAuthorized = deal.buyer.telegramId === userTelegramId || 
                          deal.seller.telegramId === userTelegramId ||
                          SecurityUtils.isAdmin(userTelegramId);

      if (!isAuthorized) {
        throw new Error('Not authorized to cancel this deal');
      }

      if (!['PENDING', 'WAITING_PAYMENT'].includes(deal.status)) {
        throw new Error('Deal cannot be cancelled in current status');
      }

      // Update deal status
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      // Log cancellation
      const user = await prisma.user.findUnique({
        where: { telegramId: userTelegramId },
      });

      await prisma.auditLog.create({
        data: {
          userId: user?.id,
          dealId: dealId,
          action: 'DEAL_CANCELLED',
          details: {
            reason: reason,
            cancelledBy: userTelegramId,
          },
        },
      });

      logger.info(`Deal ${deal.dealNumber} cancelled by ${userTelegramId}: ${reason}`);

      return { success: true };

    } catch (error) {
      logger.error('Error cancelling deal:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async processReferralFee(deal) {
    try {
      const referralGroup = await prisma.referralGroup.findUnique({
        where: { id: deal.referralGroupId },
      });

      if (!referralGroup) {
        return;
      }

      const referralFee = (deal.feeAmount * referralGroup.feePercentage) / 100;

      // Update referral group earnings
      await prisma.referralGroup.update({
        where: { id: deal.referralGroupId },
        data: {
          totalEarnings: { increment: referralFee },
          totalDeals: { increment: 1 },
        },
      });

      logger.info(`Processed referral fee: ${referralFee} ${deal.cryptocurrency} for group ${referralGroup.title}`);

    } catch (error) {
      logger.error('Error processing referral fee:', error);
    }
  }

  static async getConfirmations(address, cryptocurrency) {
    try {
      const transactions = await WalletService.getAddressTransactions(address, cryptocurrency);
      
      if (transactions.length > 0) {
        // Return the highest confirmation count
        return Math.max(...transactions.map(tx => tx.confirmations));
      }
      
      return 0;
    } catch (error) {
      logger.error('Error getting confirmations:', error);
      return 0;
    }
  }

  static async expireDeal(dealId) {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
      });

      if (!deal || deal.status !== 'WAITING_PAYMENT') {
        return { success: false, error: 'Deal not found or not waiting for payment' };
      }

      if (!TimeUtils.isExpired(deal.expiresAt)) {
        return { success: false, error: 'Deal has not expired yet' };
      }

      // Check if payment was made (grace period)
      const paymentCheck = await this.checkPayment(dealId);
      
      if (paymentCheck.success && paymentCheck.funded) {
        // Payment was made, don't expire
        return { success: false, error: 'Payment detected, deal not expired' };
      }

      // Expire the deal
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'EXPIRED',
        },
      });

      // Log expiration
      await prisma.auditLog.create({
        data: {
          dealId: dealId,
          action: 'DEAL_EXPIRED',
          details: {
            expiresAt: deal.expiresAt,
            expiredAt: new Date(),
          },
        },
      });

      logger.info(`Deal ${deal.dealNumber} expired`);

      return { success: true };

    } catch (error) {
      logger.error('Error expiring deal:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { EscrowService };
