const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function healthCheck() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if bot token is available
    if (!process.env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN not configured');
    }

    // Check blockchain API connectivity
    const axios = require('axios');
    try {
      await axios.get(`${process.env.BLOCKCYPHER_BASE_URL}/btc/main`, {
        timeout: 5000,
        params: {
          token: process.env.BLOCKCYPHER_API_KEY,
        },
      });
    } catch (apiError) {
      console.warn('BlockCypher API check failed:', apiError.message);
    }

    console.log('Health check passed');
    process.exit(0);
    
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run health check if called directly
if (require.main === module) {
  healthCheck();
}

module.exports = { healthCheck };
