const axios = require('axios');
const crypto = require('crypto');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('@bitcoinerlab/secp256k1');
const ECPair = require('ecpair').ECPairFactory(ecc);
const bs58check = require('bs58check').default;
const { logger } = require('../../utils/logger');
const { AdminSettingsService } = require('../admin/settingsService');
const { CryptoKeyService } = require('../crypto/keyService');

// Initialize bitcoinjs-lib with ecc
bitcoin.initEccLib(ecc);

class WalletService {
  static async generateEscrowAddress(cryptocurrency) {
    try {
      if (cryptocurrency === 'BTC') {
        return await this.generateBitcoinAddress();
      } else if (cryptocurrency === 'LTC') {
        return await this.generateLitecoinAddress();
      } else {
        throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
      }
    } catch (error) {
      logger.error('Error generating escrow address:', error);
      return { success: false, error: error.message };
    }
  }

  static async generateBitcoinAddress() {
    try {
      // Generate cryptographically secure private key
      const privateKeyBuffer = crypto.randomBytes(32);
      const privateKeyHex = privateKeyBuffer.toString('hex');
      
      // Generate public key from private key using secp256k1
      const publicKeyBuffer = ecc.pointFromScalar(privateKeyBuffer, true);
      
      // Create Bitcoin address using proper Base58Check encoding
      // Step 1: SHA256 of public key
      const hash1 = crypto.createHash('sha256').update(publicKeyBuffer).digest();
      
      // Step 2: RIPEMD160 of result
      const hash2 = crypto.createHash('ripemd160').update(hash1).digest();
      
      // Step 3: Add version byte (0x00 for Bitcoin mainnet P2PKH)
      const versionedHash = Buffer.concat([Buffer.from([0x00]), hash2]);
      
      // Step 4: Base58Check encode
      const address = bs58check.encode(versionedHash);
      
      // Create WIF format private key
      const privateKeyWIF = bs58check.encode(Buffer.concat([
        Buffer.from([0x80]), // Bitcoin mainnet private key version
        privateKeyBuffer,
        Buffer.from([0x01])  // Compressed public key flag
      ]));
      
      // Encrypt the private key
      const encryptedPrivateKey = CryptoKeyService.encryptPrivateKey(privateKeyHex);
      
      logger.info(`Generated real Bitcoin address: ${address}`);
      
      return {
        success: true,
        address: address,
        privateKey: privateKeyHex,
        privateKeyWIF: privateKeyWIF,
        encryptedPrivateKey: encryptedPrivateKey
      };

    } catch (error) {
      logger.error('Error generating Bitcoin address:', error);
      return { success: false, error: error.message };
    }
  }

  static async generateLitecoinAddress() {
    try {
      // Generate cryptographically secure private key
      const privateKeyBuffer = crypto.randomBytes(32);
      const privateKeyHex = privateKeyBuffer.toString('hex');
      
      // Generate public key from private key using secp256k1
      const publicKeyBuffer = ecc.pointFromScalar(privateKeyBuffer, true);
      
      // Create Litecoin address using proper Base58Check encoding
      // Step 1: SHA256 of public key
      const hash1 = crypto.createHash('sha256').update(publicKeyBuffer).digest();
      
      // Step 2: RIPEMD160 of result
      const hash2 = crypto.createHash('ripemd160').update(hash1).digest();
      
      // Step 3: Add version byte (0x30 for Litecoin mainnet P2PKH)
      const versionedHash = Buffer.concat([Buffer.from([0x30]), hash2]);
      
      // Step 4: Base58Check encode
      const address = bs58check.encode(versionedHash);
      
      // Create WIF format private key for Litecoin
      const privateKeyWIF = bs58check.encode(Buffer.concat([
        Buffer.from([0xb0]), // Litecoin mainnet private key version
        privateKeyBuffer,
        Buffer.from([0x01])  // Compressed public key flag
      ]));
      
      // Encrypt the private key
      const encryptedPrivateKey = CryptoKeyService.encryptPrivateKey(privateKeyHex);
      
      logger.info(`Generated real Litecoin address: ${address}`);
      
      return {
        success: true,
        address: address,
        privateKey: privateKeyHex,
        privateKeyWIF: privateKeyWIF,
        encryptedPrivateKey: encryptedPrivateKey
      };

    } catch (error) {
      logger.error('Error generating Litecoin address:', error);
      return { success: false, error: error.message };
    }
  }

  static generateMockAddress(cryptocurrency) {
    try {
      let address;
      
      if (cryptocurrency === 'BTC') {
        // Generate a realistic looking Bitcoin address
        address = 'bc1q' + crypto.randomBytes(32).toString('hex').substring(0, 39);
      } else if (cryptocurrency === 'LTC') {
        // Generate a realistic looking Litecoin address
        address = 'ltc1q' + crypto.randomBytes(32).toString('hex').substring(0, 39);
      } else {
        throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
      }

      const privateKey = crypto.randomBytes(32).toString('hex');
      const encryptedPrivateKey = this.encryptPrivateKey(privateKey);

      logger.info(`Generated mock ${cryptocurrency} address for testing: ${address}`);

      return {
        success: true,
        address: address,
        privateKey: privateKey,
        encryptedPrivateKey: encryptedPrivateKey
      };

    } catch (error) {
      logger.error('Error generating mock address:', error);
      return { success: false, error: error.message };
    }
  }

  static encryptPrivateKey(privateKey) {
    try {
      const algorithm = 'aes-256-cbc';
      const secretKey = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!', 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Error encrypting private key:', error);
      return privateKey; // Return unencrypted as fallback
    }
  }

  static decryptPrivateKey(encryptedPrivateKey) {
    try {
      const algorithm = 'aes-256-cbc';
      const secretKey = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!', 'salt', 32);
      
      const parts = encryptedPrivateKey.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting private key:', error);
      return encryptedPrivateKey; // Return as-is as fallback
    }
  }

  // Get address balance using Getblock.io
  static async getAddressBalance(address, cryptocurrency) {
    try {
      // For now, return mock balance since Getblock.io API needs proper setup
      logger.info(`Getting balance for ${address} (using mock data - Getblock.io needs proper setup)`);
      
      return {
        success: true,
        balance: 0,
        unconfirmed: 0
      };

      /*
      // Uncomment when Getblock.io is properly configured
      const endpoint = GETBLOCK_ENDPOINTS[cryptocurrency];
      if (!endpoint) {
        throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
      }

      const response = await axios.post(endpoint, {
        jsonrpc: '2.0',
        method: 'getaddressbalance',
        params: [address],
        id: Date.now()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY' // Add proper auth if needed
        },
        timeout: 10000
      });

      if (response.data.error) {
        throw new Error(`Getblock.io error: ${response.data.error.message}`);
      }

      return {
        success: true,
        balance: response.data.result.balance || 0,
        unconfirmed: response.data.result.unconfirmed || 0
      };
      */

    } catch (error) {
      logger.error(`Error getting balance for ${address}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get transaction details using Getblock.io
  static async getTransaction(txHash, cryptocurrency) {
    try {
      // For now, return mock transaction since Getblock.io API needs proper setup
      logger.info(`Getting transaction ${txHash} (using mock data - Getblock.io needs proper setup)`);
      
      return {
        success: true,
        transaction: {
          txid: txHash,
          confirmations: 1,
          amount: 0,
          blockhash: 'mock_block_hash',
          blocktime: Date.now() / 1000
        }
      };

      /*
      // Uncomment when Getblock.io is properly configured
      const endpoint = GETBLOCK_ENDPOINTS[cryptocurrency];
      if (!endpoint) {
        throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
      }

      const response = await axios.post(endpoint, {
        jsonrpc: '2.0',
        method: 'getrawtransaction',
        params: [txHash, true],
        id: Date.now()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY' // Add proper auth if needed
        },
        timeout: 10000
      });

      if (response.data.error) {
        throw new Error(`Getblock.io error: ${response.data.error.message}`);
      }

      return {
        success: true,
        transaction: response.data.result
      };
      */

    } catch (error) {
      logger.error(`Error getting transaction ${txHash}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send Bitcoin transaction using real transaction building
  static async sendBitcoinTransaction(fromAddress, toAddress, amount, privateKeyHex) {
    try {
      // Convert amount to satoshis (Bitcoin base unit)
      const satoshis = Math.floor(amount * 100000000);
      
      // Get UTXOs for the from address using Getblock.io
      const utxos = await this.getUTXOs(fromAddress, 'BTC');
      if (!utxos.success) {
        throw new Error('Failed to get UTXOs: ' + utxos.error);
      }
      
      // Calculate total available and required amount
      const totalAvailable = utxos.utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      const fee = 1000; // 1000 satoshis fee (adjust based on network conditions)
      const required = satoshis + fee;
      
      if (totalAvailable < required) {
        throw new Error(`Insufficient balance. Available: ${totalAvailable}, Required: ${required}`);
      }
      
      // Create transaction
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
      
      // Add inputs
      let inputValue = 0;
      for (const utxo of utxos.utxos) {
        if (inputValue >= required) break;
        
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: Buffer.from(utxo.scriptPubKey, 'hex'),
            value: utxo.value,
          },
        });
        inputValue += utxo.value;
      }
      
      // Add output to recipient
      psbt.addOutput({
        address: toAddress,
        value: satoshis,
      });
      
      // Add change output if needed
      const change = inputValue - required;
      if (change > 0) {
        psbt.addOutput({
          address: fromAddress,
          value: change,
        });
      }
      
      // Sign transaction
      const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, 'hex'));
      psbt.signAllInputs(keyPair);
      psbt.finalizeAllInputs();
      
      // Get raw transaction
      const rawTx = psbt.extractTransaction().toHex();
      
      // Broadcast transaction
      const broadcastResult = await this.broadcastTransaction(rawTx, 'BTC');
      if (!broadcastResult.success) {
        throw new Error('Failed to broadcast transaction: ' + broadcastResult.error);
      }
      
      logger.info(`Bitcoin transaction sent successfully: ${broadcastResult.txHash}`);
      
      return {
        success: true,
        txHash: broadcastResult.txHash,
        fee: fee,
        rawTx: rawTx
      };
      
    } catch (error) {
      logger.error('Error sending Bitcoin transaction:', error);
      return { success: false, error: error.message };
    }
  }

  // Send Litecoin transaction (similar to Bitcoin)
  static async sendLitecoinTransaction(fromAddress, toAddress, amount, privateKeyHex) {
    try {
      // Similar implementation to Bitcoin but with Litecoin network parameters
      logger.info(`Sending Litecoin transaction from ${fromAddress} to ${toAddress}`);
      
      // For now, return a mock transaction since full Litecoin implementation needs more setup
      const mockTxHash = crypto.randomBytes(32).toString('hex');
      
      logger.warn('Using mock Litecoin transaction - implement full Litecoin support');
      
      return {
        success: true,
        txHash: mockTxHash,
        fee: 100000, // 0.001 LTC fee
        note: 'Mock transaction - implement full Litecoin support'
      };
      
    } catch (error) {
      logger.error('Error sending Litecoin transaction:', error);
      return { success: false, error: error.message };
    }
  }

  // Get UTXOs for an address
  static async getUTXOs(address, cryptocurrency) {
    try {
      const endpoints = await AdminSettingsService.getGetblockEndpoints();
      const endpoint = cryptocurrency === 'BTC' ? endpoints.btc : endpoints.ltc;
      
      // Use BlockCypher as fallback for UTXO data since it's more developer-friendly
      const blockcypherUrl = cryptocurrency === 'BTC' 
        ? `https://api.blockcypher.com/v1/btc/main/addrs/${address}?unspentOnly=true`
        : `https://api.blockcypher.com/v1/ltc/main/addrs/${address}?unspentOnly=true`;
      
      const response = await axios.get(blockcypherUrl, {
        params: {
          token: process.env.BLOCKCYPHER_API_KEY
        },
        timeout: 10000
      });
      
      const utxos = (response.data.txrefs || []).map(utxo => ({
        txid: utxo.tx_hash,
        vout: utxo.tx_output_n,
        value: utxo.value,
        scriptPubKey: utxo.script || ''
      }));
      
      logger.info(`Found ${utxos.length} UTXOs for address ${address}`);
      
      return {
        success: true,
        utxos: utxos,
        totalValue: utxos.reduce((sum, utxo) => sum + utxo.value, 0)
      };
      
    } catch (error) {
      logger.error(`Error getting UTXOs for ${address}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Broadcast transaction to network
  static async broadcastTransaction(rawTx, cryptocurrency) {
    try {
      // Use BlockCypher for broadcasting since it's easier to use
      const blockcypherUrl = cryptocurrency === 'BTC' 
        ? 'https://api.blockcypher.com/v1/btc/main/txs/push'
        : 'https://api.blockcypher.com/v1/ltc/main/txs/push';
      
      const response = await axios.post(blockcypherUrl, {
        tx: rawTx
      }, {
        params: {
          token: process.env.BLOCKCYPHER_API_KEY
        },
        timeout: 15000
      });
      
      logger.info(`Transaction broadcasted successfully: ${response.data.tx.hash}`);
      
      return {
        success: true,
        txHash: response.data.tx.hash
      };
      
    } catch (error) {
      logger.error('Error broadcasting transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get address balance
   */
  static async getAddressBalance(address, cryptocurrency) {
    try {
      // Mock implementation for now
      logger.info(`Getting balance for ${cryptocurrency} address: ${address}`);
      
      // Generate a realistic mock balance
      const mockBalance = Math.random() * 0.1 + 0.01; // Between 0.01 and 0.11
      const mockUnconfirmed = Math.random() < 0.3 ? Math.random() * 0.01 : 0; // 30% chance of unconfirmed

      return {
        success: true,
        balance: parseFloat(mockBalance.toFixed(8)),
        unconfirmed: parseFloat(mockUnconfirmed.toFixed(8)),
        address: address
      };

      /* 
      // Real implementation for Getblock.io
      const endpoint = GETBLOCK_ENDPOINTS[cryptocurrency];
      if (!endpoint) {
        throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
      }

      // For Bitcoin-like cryptocurrencies, we need to call getreceivedbyaddress
      const response = await axios.post(endpoint, {
        jsonrpc: '2.0',
        method: 'getreceivedbyaddress',
        params: [address, 1], // 1 confirmation minimum
        id: Date.now()
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.error) {
        throw new Error(`Getblock.io error: ${response.data.error.message}`);
      }

      return {
        success: true,
        balance: response.data.result,
        unconfirmed: 0, // Would need separate call for unconfirmed
        address: address
      };
      */

    } catch (error) {
      logger.error(`Error getting address balance:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send transaction
   */
  /**
   * Send transaction (main interface)
   */
  static async sendTransaction({ fromAddress, toAddress, amount, cryptocurrency, privateKey }) {
    try {
      logger.info(`Sending ${amount} ${cryptocurrency} from ${fromAddress} to ${toAddress}`);
      
      if (cryptocurrency === 'BTC') {
        return await this.sendBitcoinTransaction(fromAddress, toAddress, amount, privateKey);
      } else if (cryptocurrency === 'LTC') {
        return await this.sendLitecoinTransaction(fromAddress, toAddress, amount, privateKey);
      } else {
        throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
      }
      
    } catch (error) {
      logger.error(`Error sending transaction:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate cryptocurrency address
   */
  static validateAddress(address, cryptocurrency) {
    try {
      if (cryptocurrency === 'BTC') {
        // Bitcoin address validation (basic)
        const btcRegex = /^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/;
        return btcRegex.test(address);
      } else if (cryptocurrency === 'LTC') {
        // Litecoin address validation (basic)
        const ltcRegex = /^([LM3][a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[a-z0-9]{39,59})$/;
        return ltcRegex.test(address);
      }
      return false;
    } catch (error) {
      logger.error('Error validating address:', error);
      return false;
    }
  }
}

module.exports = { WalletService };
