const { PrismaClient } = require('@prisma/client');
const { WalletService } = require('./wallet/walletService');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient();

class ReleaseService {
  /**
   * Calculate platform fees based on deal amount
   * $5 for deals under $100, 5% for deals over $100
   */
  static calculateFees(amount) {
    let feeAmount;
    let feePercentage;

    if (amount < 100) {
      // $5 flat fee for deals under $100
      feeAmount = 5;
      feePercentage = ((5 / amount) * 100).toFixed(2);
    } else {
      // 5% fee for deals over $100
      feeAmount = amount * 0.05;
      feePercentage = 5;
    }

    const netAmount = amount - feeAmount;

    return {
      feeAmount: parseFloat(feeAmount.toFixed(8)),
      netAmount: parseFloat(netAmount.toFixed(8)),
      feePercentage: parseFloat(feePercentage)
    };
  }

  /**
   * Release funds from escrow to seller and collect platform fees
   */
  static async releaseFunds(dealId, userId) {
    try {
      logger.info(`Starting fund release for deal ${dealId} by user ${userId}`);

      // Get deal with all necessary relations
      const deal = await prisma.deal.findFirst({
        where: {
          id: dealId,
          status: 'FUNDED',
          buyer: {
            telegramId: userId
          }
        },
        include: {
          buyer: true,
          seller: true,
          group: true
        }
      });

      if (!deal) {
        throw new Error('Deal not found or not authorized');
      }

      if (!deal.escrowAddress || !deal.escrowPrivateKey) {
        throw new Error('Escrow address or private key not found');
      }

      // Get seller's wallet address
      const sellerWallet = await prisma.wallet.findFirst({
        where: {
          userId: deal.sellerId,
          cryptocurrency: deal.cryptocurrency,
          isActive: true
        }
      });

      if (!sellerWallet) {
        throw new Error('Seller wallet address not found');
      }

      // Get platform payout wallet
      const { AdminSettingsService } = require('./admin/settingsService');
      const platformWallet = await AdminSettingsService.getPayoutWallet(deal.cryptocurrency);

      if (!platformWallet) {
        throw new Error(`Platform payout wallet not configured for ${deal.cryptocurrency}`);
      }

      // Check escrow balance
      const balanceResult = await WalletService.getAddressBalance(deal.escrowAddress, deal.cryptocurrency);
      if (!balanceResult.success || balanceResult.balance < deal.amount) {
        throw new Error('Insufficient escrow balance');
      }

      // Calculate fees
      const { feeAmount, netAmount } = this.calculateFees(deal.amount);

      logger.info(`Deal ${deal.dealNumber}: Amount=${deal.amount}, Fee=${feeAmount}, Net=${netAmount}`);

      // Create transactions for both seller payout and platform fee
      const transactions = [];

      // Transaction to seller
      const sellerTxResult = await WalletService.sendTransaction({
        fromAddress: deal.escrowAddress,
        toAddress: sellerWallet.address,
        amount: netAmount,
        cryptocurrency: deal.cryptocurrency,
        privateKey: deal.escrowPrivateKey // This should be decrypted in production
      });

      if (!sellerTxResult.success) {
        throw new Error(`Failed to send to seller: ${sellerTxResult.error}`);
      }

      transactions.push({
        id: this.generateTransactionId(),
        dealId: deal.id,
        type: 'RELEASE',
        fromAddress: deal.escrowAddress,
        toAddress: sellerWallet.address,
        amount: netAmount,
        cryptocurrency: deal.cryptocurrency,
        txHash: sellerTxResult.txHash,
        status: 'COMPLETED',
        feeAmount: 0, // No additional fee for seller transaction
        createdAt: new Date()
      });

      // Transaction for platform fee
      if (feeAmount > 0) {
        const feeTxResult = await WalletService.sendTransaction({
          fromAddress: deal.escrowAddress,
          toAddress: platformWallet.address,
          amount: feeAmount,
          cryptocurrency: deal.cryptocurrency,
          privateKey: deal.escrowPrivateKey
        });

        if (!feeTxResult.success) {
          logger.warn(`Platform fee transfer failed: ${feeTxResult.error}`);
          // Continue anyway - seller got paid
        } else {
          transactions.push({
            id: this.generateTransactionId(),
            dealId: deal.id,
            type: 'FEE',
            fromAddress: deal.escrowAddress,
            toAddress: platformWallet.address,
            amount: feeAmount,
            cryptocurrency: deal.cryptocurrency,
            txHash: feeTxResult.txHash,
            status: 'COMPLETED',
            feeAmount: 0,
            createdAt: new Date()
          });
        }
      }

      // Update deal status and create transaction records
      await prisma.$transaction(async (tx) => {
        // Update deal
        await tx.deal.update({
          where: { id: deal.id },
          data: {
            status: 'COMPLETED',
            releasedAt: new Date(),
            feeAmount: feeAmount
          }
        });

        // Create transaction records
        for (const transaction of transactions) {
          await tx.transaction.create({
            data: transaction
          });
        }

        // Update user statistics
        await tx.user.update({
          where: { id: deal.buyerId },
          data: {
            successfulDeals: { increment: 1 },
            reputation: { increment: 1 }
          }
        });

        await tx.user.update({
          where: { id: deal.sellerId },
          data: {
            successfulDeals: { increment: 1 },
            reputation: { increment: 1 }
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: deal.buyerId,
            action: 'RELEASE_FUNDS',
            entity: 'Deal',
            entityId: deal.id,
            details: JSON.stringify({
              dealNumber: deal.dealNumber,
              amount: deal.amount,
              feeAmount: feeAmount,
              netAmount: netAmount,
              sellerTxHash: sellerTxResult.txHash
            })
          }
        });
      });

      logger.info(`Successfully released funds for deal ${deal.dealNumber}. Seller TX: ${sellerTxResult.txHash}`);

      return {
        success: true,
        sellerTxHash: sellerTxResult.txHash,
        feeAmount: feeAmount,
        netAmount: netAmount,
        transactions: transactions
      };

    } catch (error) {
      logger.error('Error releasing funds:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a unique transaction ID
   */
  static generateTransactionId() {
    return `TX_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }

  /**
   * Get default payout wallet for a cryptocurrency
   */
  static async getDefaultPayoutWallet(cryptocurrency) {
    return await prisma.payoutWallet.findFirst({
      where: {
        cryptocurrency: cryptocurrency,
        isActive: true,
        isDefault: true
      }
    });
  }

  /**
   * Set default payout wallet (admin function)
   */
  static async setDefaultPayoutWallet(cryptocurrency, address, label = null) {
    try {
      // Deactivate current default
      await prisma.payoutWallet.updateMany({
        where: {
          cryptocurrency: cryptocurrency,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });

      // Create or update new default
      const existingWallet = await prisma.payoutWallet.findFirst({
        where: {
          cryptocurrency: cryptocurrency,
          address: address
        }
      });

      let wallet;
      if (existingWallet) {
        wallet = await prisma.payoutWallet.update({
          where: { id: existingWallet.id },
          data: {
            isDefault: true,
            isActive: true,
            label: label || existingWallet.label
          }
        });
      } else {
        wallet = await prisma.payoutWallet.create({
          data: {
            cryptocurrency: cryptocurrency,
            address: address,
            label: label || `Default ${cryptocurrency} Payout`,
            isActive: true,
            isDefault: true
          }
        });
      }

      logger.info(`Set default payout wallet for ${cryptocurrency}: ${address}`);
      return { success: true, wallet };

    } catch (error) {
      logger.error('Error setting default payout wallet:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { ReleaseService };
