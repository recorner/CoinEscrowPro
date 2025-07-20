#!/usr/bin/env node

/**
 * MTProto Setup Script
 * This script helps you configure Telegram MTProto credentials for automatic group creation
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

async function setupMTProto() {
  console.log('\n🔧 CoinEscrowPro MTProto Setup\n');
  console.log('This script will help you configure automatic group creation using Telegram MTProto.\n');

  // Get API credentials
  console.log('📋 Step 1: Get your Telegram API credentials from https://my.telegram.org/apps\n');
  
  const apiId = await input.text('Enter your API ID: ');
  const apiHash = await input.text('Enter your API Hash: ');
  const phoneNumber = await input.text('Enter your phone number (with country code, e.g., +1234567890): ');

  console.log('\n🔐 Connecting to Telegram...\n');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, parseInt(apiId), apiHash);

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => {
        return await input.password('Enter your 2FA password (if enabled): ');
      },
      phoneCode: async () => {
        return await input.text('Enter the verification code sent to your phone: ');
      },
      onError: (err) => console.error('Authentication error:', err),
    });

    const session = client.session.save();
    
    console.log('\n✅ Authentication successful!\n');
    console.log('📝 Add these to your .env file:\n');
    console.log(`TELEGRAM_API_ID=${apiId}`);
    console.log(`TELEGRAM_API_HASH=${apiHash}`);
    console.log(`TELEGRAM_PHONE=${phoneNumber}`);
    console.log(`TELEGRAM_SESSION=${session}`);
    console.log('TELEGRAM_PASSWORD=your_2fa_password # Only if you have 2FA enabled\n');

    console.log('🎉 Setup complete! Your bot can now create groups automatically.\n');

    await client.disconnect();

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure your API ID and Hash are correct');
    console.log('2. Check your phone number format (+country_code_phone_number)');
    console.log('3. Ensure you have a stable internet connection');
    console.log('4. Try again in a few minutes if rate limited\n');
  }
}

// Run the setup
if (require.main === module) {
  setupMTProto().catch(console.error);
}

module.exports = { setupMTProto };
