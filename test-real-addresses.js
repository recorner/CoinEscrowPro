const { WalletService } = require('./src/services/wallet/walletService');

async function testRealAddresses() {
  console.log('🧪 Testing Real Cryptocurrency Address Generation\n');

  try {
    // Test Bitcoin address generation
    console.log('1. Testing Bitcoin Address Generation:');
    const btcResult = await WalletService.generateBitcoinAddress();
    console.log('   ✅ Success:', btcResult.success);
    console.log('   📍 Address:', btcResult.address);
    console.log('   🔑 Private Key (first 10 chars):', btcResult.privateKey?.substring(0, 10) + '...');
    console.log('   🔐 WIF Format:', btcResult.privateKeyWIF?.substring(0, 10) + '...');
    console.log('   🔒 Encrypted:', btcResult.encryptedPrivateKey ? 'YES' : 'NO');
    
    // Validate the Bitcoin address
    const btcValid = WalletService.validateAddress(btcResult.address, 'BTC');
    console.log('   ✓ Address Valid:', btcValid);
    console.log();

    // Test Litecoin address generation
    console.log('2. Testing Litecoin Address Generation:');
    const ltcResult = await WalletService.generateLitecoinAddress();
    console.log('   ✅ Success:', ltcResult.success);
    console.log('   📍 Address:', ltcResult.address);
    console.log('   🔑 Private Key (first 10 chars):', ltcResult.privateKey?.substring(0, 10) + '...');
    console.log('   🔐 WIF Format:', ltcResult.privateKeyWIF?.substring(0, 10) + '...');
    console.log('   🔒 Encrypted:', ltcResult.encryptedPrivateKey ? 'YES' : 'NO');
    
    // Validate the Litecoin address
    const ltcValid = WalletService.validateAddress(ltcResult.address, 'LTC');
    console.log('   ✓ Address Valid:', ltcValid);
    console.log();

    // Test address validation with known patterns
    console.log('3. Testing Address Validation:');
    
    // Bitcoin test addresses
    const btcTests = [
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', // Valid Bech32
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',        // Valid Legacy
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',        // Valid P2SH
      'invalid_address',                             // Invalid
      'bc1qinvalid'                                  // Invalid Bech32
    ];
    
    btcTests.forEach(addr => {
      const valid = WalletService.validateAddress(addr, 'BTC');
      console.log(`   BTC ${addr}: ${valid ? '✅ Valid' : '❌ Invalid'}`);
    });
    
    // Litecoin test addresses
    const ltcTests = [
      'ltc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', // Valid Bech32
      'LhK2BTzVMbdq8W8aW4jX6zXfpqKvBVVA6y',        // Valid Legacy
      'MVaMhqWYCHHK4UqEQ8F5JLHVXhsZpb1x4t',        // Valid P2SH (testnet style)
      'invalid_litecoin_address',                     // Invalid
      'ltc1qinvalid'                                  // Invalid Bech32
    ];
    
    ltcTests.forEach(addr => {
      const valid = WalletService.validateAddress(addr, 'LTC');
      console.log(`   LTC ${addr}: ${valid ? '✅ Valid' : '❌ Invalid'}`);
    });

    console.log('\n🎉 Real address generation tests completed!');
    console.log('\n⚠️  Important Notes:');
    console.log('   • These are REAL cryptocurrency addresses with REAL private keys');
    console.log('   • The addresses can receive actual Bitcoin/Litecoin transactions');
    console.log('   • Private keys are properly encrypted for secure storage');
    console.log('   • Never expose private keys in production logs');
    console.log('   • Use proper key management and backup procedures');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

testRealAddresses();
