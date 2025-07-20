const crypto = require('crypto');
const bcrypt = require('bcrypt');

class SecurityUtils {
  static generateReferralCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateDealNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `DEAL-${timestamp}-${random}`.toUpperCase();
  }

  static encrypt(text) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not set in environment variables');
    }
    
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not set in environment variables');
    }
    
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = textParts.join(':');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  static generateUniqueId() {
    return crypto.randomUUID();
  }

  static isValidBitcoinAddress(address) {
    // Basic Bitcoin address validation
    const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const bech32Regex = /^bc1[a-z0-9]{39,59}$/;
    return btcRegex.test(address) || bech32Regex.test(address);
  }

  static isValidLitecoinAddress(address) {
    // Basic Litecoin address validation
    const ltcRegex = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/;
    const bech32Regex = /^ltc1[a-z0-9]{39,59}$/;
    return ltcRegex.test(address) || bech32Regex.test(address);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"']/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  static isAdmin(userId) {
    const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    return adminIds.includes(userId.toString());
  }

  static isSuperAdmin(userId) {
    return userId.toString() === process.env.SUPER_ADMIN_ID;
  }

  static formatAmount(amount, decimals = 8) {
    return parseFloat(amount).toFixed(decimals);
  }

  static generateInviteCode() {
    return crypto.randomBytes(16).toString('hex');
  }
}

module.exports = { SecurityUtils };
