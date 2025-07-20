const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { logger } = require('../../utils/logger');

const prisma = new PrismaClient();

// Encryption key for sensitive settings (should be in environment variable)
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

class AdminSettingsService {
  
  /**
   * Initialize default settings and payout wallets
   */
  static async initializeDefaults() {
    try {
      // Set default payout wallets
      await this.setPayoutWallet('BTC', 'bc1q8fwypfetn5mu994wpxh70ag9mtq54gaa9d44le', 'Default BTC Payout');
      await this.setPayoutWallet('LTC', 'LMToh58PhRsHsSskrdYX9FoCN187hZdfod', 'Default LTC Payout');

      // Set default Getblock.io endpoints (these can be updated by admin)
      await this.setSetting('getblock_btc_endpoint', 'https://go.getblock.io/e09a873de73f402b9ed2b55809977aa8', 'Bitcoin Getblock.io Endpoint');
      await this.setSetting('getblock_ltc_endpoint', 'https://go.getblock.io/0a50cc0961b044dd8a65246c3808872e', 'Litecoin Getblock.io Endpoint');
      
      // Set default WebSocket endpoints (if needed)
      await this.setSetting('getblock_btc_websocket', 'wss://btc.getblock.io/e09a873de73f402b9ed2b55809977aa8/websocket', 'Bitcoin WebSocket Endpoint');
      await this.setSetting('getblock_ltc_websocket', 'wss://ltc.getblock.io/0a50cc0961b044dd8a65246c3808872e/websocket', 'Litecoin WebSocket Endpoint');

      logger.info('✅ Default admin settings and payout wallets initialized');
    } catch (error) {
      logger.error('Error initializing default settings:', error);
    }
  }

  /**
   * Set payout wallet for a cryptocurrency
   */
  static async setPayoutWallet(cryptocurrency, address, label = null) {
    try {
      const wallet = await prisma.payoutWallet.upsert({
        where: { cryptocurrency: cryptocurrency },
        update: {
          address: address,
          label: label,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          cryptocurrency: cryptocurrency,
          address: address,
          label: label,
          isActive: true
        }
      });

      logger.info(`Set payout wallet for ${cryptocurrency}: ${address}`);
      return wallet;
    } catch (error) {
      logger.error(`Error setting payout wallet for ${cryptocurrency}:`, error);
      throw error;
    }
  }

  /**
   * Get payout wallet for a cryptocurrency
   */
  static async getPayoutWallet(cryptocurrency) {
    try {
      const wallet = await prisma.payoutWallet.findUnique({
        where: { 
          cryptocurrency: cryptocurrency 
        }
      });

      return wallet;
    } catch (error) {
      logger.error(`Error getting payout wallet for ${cryptocurrency}:`, error);
      return null;
    }
  }

  /**
   * Get all payout wallets
   */
  static async getAllPayoutWallets() {
    try {
      return await prisma.payoutWallet.findMany({
        where: { isActive: true },
        orderBy: { cryptocurrency: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting all payout wallets:', error);
      return [];
    }
  }

  /**
   * Set an admin setting (with optional encryption)
   */
  static async setSetting(key, value, description = null, shouldEncrypt = false) {
    try {
      let finalValue = value;
      
      if (shouldEncrypt) {
        finalValue = this.encrypt(value);
      }

      const setting = await prisma.adminSettings.upsert({
        where: { key: key },
        update: {
          value: finalValue,
          description: description,
          isEncrypted: shouldEncrypt,
          updatedAt: new Date()
        },
        create: {
          key: key,
          value: finalValue,
          description: description,
          isEncrypted: shouldEncrypt
        }
      });

      logger.info(`Admin setting updated: ${key}`);
      return setting;
    } catch (error) {
      logger.error(`Error setting admin setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get an admin setting (with automatic decryption)
   */
  static async getSetting(key, defaultValue = null) {
    try {
      const setting = await prisma.adminSettings.findUnique({
        where: { key: key }
      });

      if (!setting) {
        return defaultValue;
      }

      if (setting.isEncrypted) {
        return this.decrypt(setting.value);
      }

      return setting.value;
    } catch (error) {
      logger.error(`Error getting admin setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get all admin settings
   */
  static async getAllSettings() {
    try {
      const settings = await prisma.adminSettings.findMany({
        orderBy: { key: 'asc' }
      });

      // Decrypt encrypted settings for display
      return settings.map(setting => ({
        ...setting,
        value: setting.isEncrypted ? '[ENCRYPTED]' : setting.value
      }));
    } catch (error) {
      logger.error('Error getting all admin settings:', error);
      return [];
    }
  }

  /**
   * Delete an admin setting
   */
  static async deleteSetting(key) {
    try {
      await prisma.adminSettings.delete({
        where: { key: key }
      });
      logger.info(`Admin setting deleted: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting admin setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Encrypt a value
   */
  static encrypt(text) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(algorithm, key);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Error encrypting value:', error);
      return text; // Return original text if encryption fails
    }
  }

  /**
   * Decrypt a value
   */
  static decrypt(encryptedText) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
      
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting value:', error);
      return encryptedText; // Return encrypted text if decryption fails
    }
  }

  /**
   * Get current Getblock.io endpoints
   */
  static async getGetblockEndpoints() {
    return {
      btc: await this.getSetting('getblock_btc_endpoint', 'https://go.getblock.io/e09a873de73f402b9ed2b55809977aa8'),
      ltc: await this.getSetting('getblock_ltc_endpoint', 'https://go.getblock.io/0a50cc0961b044dd8a65246c3808872e'),
      btcWebSocket: await this.getSetting('getblock_btc_websocket', 'wss://btc.getblock.io/e09a873de73f402b9ed2b55809977aa8/websocket'),
      ltcWebSocket: await this.getSetting('getblock_ltc_websocket', 'wss://ltc.getblock.io/0a50cc0961b044dd8a65246c3808872e/websocket')
    };
  }

  /**
   * Update Getblock.io endpoints
   */
  static async updateGetblockEndpoints(endpoints) {
    try {
      if (endpoints.btc) {
        await this.setSetting('getblock_btc_endpoint', endpoints.btc, 'Bitcoin Getblock.io Endpoint');
      }
      
      if (endpoints.ltc) {
        await this.setSetting('getblock_ltc_endpoint', endpoints.ltc, 'Litecoin Getblock.io Endpoint');
      }
      
      if (endpoints.btcWebSocket) {
        await this.setSetting('getblock_btc_websocket', endpoints.btcWebSocket, 'Bitcoin WebSocket Endpoint');
      }
      
      if (endpoints.ltcWebSocket) {
        await this.setSetting('getblock_ltc_websocket', endpoints.ltcWebSocket, 'Litecoin WebSocket Endpoint');
      }

      logger.info('Getblock.io endpoints updated successfully');
      return true;
    } catch (error) {
      logger.error('Error updating Getblock.io endpoints:', error);
      return false;
    }
  }
}

module.exports = { AdminSettingsService };
