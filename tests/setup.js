const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up and disconnect
  await prisma.$disconnect();
});

// Global test helpers
global.createTestUser = async (overrides = {}) => {
  const { SecurityUtils } = require('../src/utils/security');
  
  const defaultData = {
    telegramId: Math.random().toString(),
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    referralCode: SecurityUtils.generateReferralCode(),
  };

  return await prisma.user.create({
    data: { ...defaultData, ...overrides },
  });
};

global.createTestDeal = async (buyer, seller, overrides = {}) => {
  const { SecurityUtils } = require('../src/utils/security');
  
  const defaultData = {
    dealNumber: SecurityUtils.generateDealNumber(),
    buyerId: buyer.id,
    sellerId: seller.id,
    amount: 0.001,
    cryptocurrency: 'BTC',
    feePercentage: 0.5,
    feeAmount: 0.000005,
    timeoutMinutes: 60,
    confirmationsReq: 1,
  };

  return await prisma.deal.create({
    data: { ...defaultData, ...overrides },
  });
};

global.cleanupDatabase = async () => {
  await prisma.transaction.deleteMany({});
  await prisma.dealWallet.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
};
