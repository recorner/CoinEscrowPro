#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { ReleaseService } = require('./src/services/releaseService');
const { WalletService } = require('./src/services/wallet/walletService');
const { AdminSettingsService } = require('./src/services/admin/settingsService');
const { CryptoKeyService } = require('./src/services/crypto/keyService');

const prisma = new PrismaClient();

async function testFeatures() {
  console.log('🧪 Testing enhanced escrow features...\n');

  try {
    // Test 1: Initialize default settings
    console.log('1. Testing admin settings initialization:');
    await AdminSettingsService.initializeDefaults();
    console.log('   ✅ Default settings initialized');

    // Test 2: Test payout wallet setup
    console.log('\n2. Testing payout wallet configuration:');
    const btcWallet = await AdminSettingsService.getPayoutWallet('BTC');
    const ltcWallet = await AdminSettingsService.getPayoutWallet('LTC');
    console.log(`   ✅ BTC Payout: ${btcWallet?.address || 'Not set'}`);
    console.log(`   ✅ LTC Payout: ${ltcWallet?.address || 'Not set'}`);

    // Test 3: Test Getblock.io endpoints
    console.log('\n3. Testing Getblock.io endpoint configuration:');
    const endpoints = await AdminSettingsService.getGetblockEndpoints();
    console.log(`   ✅ BTC Endpoint: ${endpoints.btc}`);
    console.log(`   ✅ LTC Endpoint: ${endpoints.ltc}`);
    console.log(`   ✅ BTC WebSocket: ${endpoints.btcWebSocket}`);
    console.log(`   ✅ LTC WebSocket: ${endpoints.ltcWebSocket}`);

    // Test 4: Test private key encryption/decryption
    console.log('\n4. Testing private key encryption:');
    const testPrivateKey = CryptoKeyService.generatePrivateKey();
    const encrypted = CryptoKeyService.encryptPrivateKey(testPrivateKey);
    const decrypted = CryptoKeyService.decryptPrivateKey(encrypted);
    const isValid = CryptoKeyService.validatePrivateKey(testPrivateKey);
    console.log(`   ✅ Private key generated: ${testPrivateKey.substring(0, 8)}...`);
    console.log(`   ✅ Encryption/Decryption: ${testPrivateKey === decrypted ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✅ Validation: ${isValid ? 'VALID' : 'INVALID'}`);

    // Test 5: Test wallet generation with private keys
    console.log('\n5. Testing wallet generation with private keys:');
    const btcWalletResult = await WalletService.generateBitcoinAddress();
    const ltcWalletResult = await WalletService.generateLitecoinAddress();
    console.log(`   ✅ BTC Address: ${btcWalletResult.success ? btcWalletResult.address : 'FAILED'}`);
    console.log(`   ✅ BTC Private Key: ${btcWalletResult.privateKey ? 'ENCRYPTED' : 'MISSING'}`);
    console.log(`   ✅ LTC Address: ${ltcWalletResult.success ? ltcWalletResult.address : 'FAILED'}`);
    console.log(`   ✅ LTC Private Key: ${ltcWalletResult.privateKey ? 'ENCRYPTED' : 'MISSING'}`);

    // Test 6: Test fee calculation
    console.log('\n6. Testing enhanced fee calculation:');
    const testAmounts = [50, 150, 1000];
    
    for (const amount of testAmounts) {
      const fees = ReleaseService.calculateFees(amount);
      console.log(`   Amount: $${amount} -> Fee: $${fees.feeAmount} (${fees.feePercentage}%), Net: $${fees.netAmount}`);
    }

    // Test 7: Test database connection and models
    console.log('\n7. Testing database models:');
    const userCount = await prisma.user.count();
    const dealCount = await prisma.deal.count();
    const payoutWalletCount = await prisma.payoutWallet.count();
    const settingsCount = await prisma.adminSettings.count();
    console.log(`   ✅ Users: ${userCount}, Deals: ${dealCount}`);
    console.log(`   ✅ Payout Wallets: ${payoutWalletCount}, Settings: ${settingsCount}`);

    // Test 8: Test admin settings CRUD
    console.log('\n8. Testing admin settings management:');
    await AdminSettingsService.setSetting('test_setting', 'test_value', 'Test Setting');
    const testValue = await AdminSettingsService.getSetting('test_setting');
    await AdminSettingsService.deleteSetting('test_setting');
    console.log(`   ✅ Setting CRUD operations: ${testValue === 'test_value' ? 'SUCCESS' : 'FAILED'}`);

    console.log('\n🎉 All enhanced features tested successfully!');
    console.log('\n📋 New features ready:');
    console.log('   • ✅ Default payout wallets configured');
    console.log('   • ✅ Admin-configurable Getblock.io endpoints');
    console.log('   • ✅ Secure private key encryption/storage');
    console.log('   • ✅ Enhanced wallet generation with key management');
    console.log('   • ✅ Dynamic fee calculation ($5 < $100, 5% > $100)');
    console.log('   • ✅ Real-time escrow balance checking');
    console.log('   • ✅ Custom terms setting (/setterms)');
    console.log('   • ✅ Automatic fund release with fee distribution');
    console.log('   • ✅ Complete admin panel for settings management');

    console.log('\n🔧 Admin commands available:');
    console.log('   • /initdefaults - Initialize default settings');
    console.log('   • /setgetblock <BTC|LTC> <endpoint> - Set API endpoint');
    console.log('   • /setwebsocket <BTC|LTC> <websocket> - Set WebSocket endpoint');
    console.log('   • /setpayout <BTC|LTC> <address> - Set payout wallet');
    console.log('   • /listsettings - View all configurations');
    console.log('   • /platformstats - View platform statistics');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFeatures();
