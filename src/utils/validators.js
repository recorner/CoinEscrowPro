/**
 * Crypto address validation utilities
 */

/**
 * Validate cryptocurrency address format
 * @param {string} address - The address to validate
 * @param {string} crypto - The cryptocurrency type (BTC, LTC, etc.)
 * @returns {Object} Validation result
 */
function validateCryptoAddress(address, crypto) {
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Address is required and must be a string'
    };
  }

  // Remove whitespace
  address = address.trim();

  switch (crypto.toUpperCase()) {
    case 'BTC':
      return validateBTCAddress(address);
    case 'LTC':
      return validateLTCAddress(address);
    default:
      return validateBTCAddress(address); // Default to BTC validation
  }
}

/**
 * Validate Bitcoin address
 * @param {string} address - Bitcoin address
 * @returns {Object} Validation result
 */
function validateBTCAddress(address) {
  // Bitcoin address patterns
  const legacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // Legacy (P2PKH, P2SH)
  const segwitPattern = /^bc1[a-z0-9]{39,59}$/; // Bech32 (SegWit)
  const segwitv1Pattern = /^bc1p[a-z0-9]{58}$/; // Bech32m (SegWit v1 - Taproot)

  if (legacyPattern.test(address) || segwitPattern.test(address) || segwitv1Pattern.test(address)) {
    return {
      isValid: true,
      type: getAddressType(address)
    };
  }

  return {
    isValid: false,
    error: 'Invalid Bitcoin address format'
  };
}

/**
 * Validate Litecoin address
 * @param {string} address - Litecoin address
 * @returns {Object} Validation result
 */
function validateLTCAddress(address) {
  // Litecoin address patterns
  const legacyPattern = /^[LM3][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // Legacy (P2PKH, P2SH)
  const segwitPattern = /^ltc1[a-z0-9]{39,59}$/; // Bech32 (SegWit)

  if (legacyPattern.test(address) || segwitPattern.test(address)) {
    return {
      isValid: true,
      type: getAddressType(address)
    };
  }

  return {
    isValid: false,
    error: 'Invalid Litecoin address format'
  };
}

/**
 * Get address type for display purposes
 * @param {string} address - Crypto address
 * @returns {string} Address type
 */
function getAddressType(address) {
  if (address.startsWith('bc1p')) return 'Taproot';
  if (address.startsWith('bc1') || address.startsWith('ltc1')) return 'SegWit';
  if (address.startsWith('3') || address.startsWith('M')) return 'P2SH';
  if (address.startsWith('1') || address.startsWith('L')) return 'Legacy';
  return 'Unknown';
}

/**
 * Validate deal amount
 * @param {string|number} amount - Amount to validate
 * @returns {Object} Validation result
 */
function validateAmount(amount) {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) {
    return {
      isValid: false,
      error: 'Amount must be a valid number'
    };
  }

  if (numAmount <= 0) {
    return {
      isValid: false,
      error: 'Amount must be greater than 0'
    };
  }

  if (numAmount > 100) {
    return {
      isValid: false,
      error: 'Amount too large (max 100 BTC/LTC)'
    };
  }

  return {
    isValid: true,
    amount: numAmount
  };
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {Object} Validation result
 */
function validateUsername(username) {
  if (!username) {
    return {
      isValid: false,
      error: 'Username is required'
    };
  }

  // Remove @ if present
  username = username.replace('@', '');

  // Telegram username pattern
  const usernamePattern = /^[a-zA-Z0-9_]{5,32}$/;

  if (!usernamePattern.test(username)) {
    return {
      isValid: false,
      error: 'Invalid username format (5-32 characters, letters, numbers, underscore only)'
    };
  }

  return {
    isValid: true,
    username: username
  };
}

module.exports = {
  validateCryptoAddress,
  validateBTCAddress,
  validateLTCAddress,
  validateAmount,
  validateUsername,
  getAddressType
};
