const crypto = require('crypto');
const { logger } = require('../../utils/logger');

// Encryption settings - using AES-256-CBC for broader compatibility
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

class CryptoKeyService {
  
  constructor() {
    // Use environment variable or generate a secure key
    this.masterKey = process.env.CRYPTO_MASTER_KEY || crypto.randomBytes(KEY_LENGTH).toString('hex');
    
    if (!process.env.CRYPTO_MASTER_KEY) {
      logger.warn('CRYPTO_MASTER_KEY not set in environment. Using generated key (not recommended for production).');
      logger.warn(`Generated key: ${this.masterKey}`);
    }
  }

  /**
   * Encrypt a private key
   * @param {string} privateKey - The private key to encrypt
   * @returns {string} Encrypted private key with IV and auth tag
   */
  encryptPrivateKey(privateKey) {
    try {
      const key = Buffer.from(this.masterKey.slice(0, 64), 'hex');
      const iv = crypto.randomBytes(IV_LENGTH);
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV + Encrypted data for CBC
      const result = iv.toString('hex') + ':' + encrypted;
      
      logger.debug('Private key encrypted successfully');
      return result;
      
    } catch (error) {
      logger.error('Error encrypting private key:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt a private key
   * @param {string} encryptedData - The encrypted private key data
   * @returns {string} Decrypted private key
   */
  decryptPrivateKey(encryptedData) {
    try {
      const key = Buffer.from(this.masterKey.slice(0, 64), 'hex');
      
      // Split the combined data
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.debug('Private key decrypted successfully');
      return decrypted;
      
    } catch (error) {
      logger.error('Error decrypting private key:', error);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Generate a secure random private key for Bitcoin/Litecoin
   * @returns {string} Hex private key
   */
  generatePrivateKey() {
    try {
      // Generate 32 bytes (256 bits) of secure random data
      const privateKey = crypto.randomBytes(32);
      return privateKey.toString('hex');
    } catch (error) {
      logger.error('Error generating private key:', error);
      throw new Error('Failed to generate private key');
    }
  }

  /**
   * Validate a private key format
   * @param {string} privateKey - Private key to validate
   * @returns {boolean} True if valid
   */
  validatePrivateKey(privateKey) {
    try {
      // Check if it's a valid hex string of 64 characters (32 bytes)
      if (!/^[a-fA-F0-9]{64}$/.test(privateKey)) {
        return false;
      }
      
      // Check if it's within valid range for secp256k1
      const keyBigInt = BigInt('0x' + privateKey);
      const maxKey = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140');
      
      return keyBigInt > 0n && keyBigInt < maxKey;
    } catch (error) {
      logger.error('Error validating private key:', error);
      return false;
    }
  }

  /**
   * Create a secure backup of encrypted private key
   * @param {string} dealId - Deal ID for reference
   * @param {string} encryptedPrivateKey - Encrypted private key
   * @returns {object} Backup data
   */
  createPrivateKeyBackup(dealId, encryptedPrivateKey) {
    try {
      const backup = {
        dealId: dealId,
        encryptedPrivateKey: encryptedPrivateKey,
        timestamp: new Date().toISOString(),
        checksum: crypto.createHash('sha256').update(encryptedPrivateKey).digest('hex')
      };
      
      logger.info(`Private key backup created for deal: ${dealId}`);
      return backup;
    } catch (error) {
      logger.error('Error creating private key backup:', error);
      throw error;
    }
  }

  /**
   * Verify private key backup integrity
   * @param {object} backup - Backup data
   * @returns {boolean} True if backup is valid
   */
  verifyPrivateKeyBackup(backup) {
    try {
      const expectedChecksum = crypto.createHash('sha256').update(backup.encryptedPrivateKey).digest('hex');
      return backup.checksum === expectedChecksum;
    } catch (error) {
      logger.error('Error verifying private key backup:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = { CryptoKeyService: new CryptoKeyService() };
