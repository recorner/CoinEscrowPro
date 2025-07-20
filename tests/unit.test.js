const { PrismaClient } = require('@prisma/client');
const { SecurityUtils } = require('../src/utils/security');
const { TimeUtils } = require('../src/utils/time');

const prisma = new PrismaClient();

describe('Security Utils', () => {
  test('should generate valid referral code', () => {
    const code = SecurityUtils.generateReferralCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  test('should generate unique deal numbers', () => {
    const deal1 = SecurityUtils.generateDealNumber();
    const deal2 = SecurityUtils.generateDealNumber();
    expect(deal1).not.toEqual(deal2);
    expect(deal1).toMatch(/^DEAL-/);
  });

  test('should validate Bitcoin addresses', () => {
    expect(SecurityUtils.isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
    expect(SecurityUtils.isValidBitcoinAddress('invalid-address')).toBe(false);
  });

  test('should validate Litecoin addresses', () => {
    expect(SecurityUtils.isValidLitecoinAddress('LUkKNrqHp8LJi3Gp1gHVjpnC2TJA4J2Kfp')).toBe(true);
    expect(SecurityUtils.isValidLitecoinAddress('invalid-address')).toBe(false);
  });

  test('should sanitize input', () => {
    const input = '<script>alert("xss")</script>Hello';
    const sanitized = SecurityUtils.sanitizeInput(input);
    expect(sanitized).toBe('scriptalert(xss)/scriptHello');
  });
});

describe('Time Utils', () => {
  test('should format duration correctly', () => {
    expect(TimeUtils.formatDuration(30)).toBe('30 minutes');
    expect(TimeUtils.formatDuration(60)).toBe('1 hour');
    expect(TimeUtils.formatDuration(90)).toBe('1h 30m');
  });

  test('should calculate time remaining', () => {
    const future = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    const remaining = TimeUtils.getTimeRemaining(future);
    expect(remaining.expired).toBe(false);
    expect(remaining.totalMinutes).toBeGreaterThan(25);
  });

  test('should detect expired dates', () => {
    const past = new Date(Date.now() - 10000); // 10 seconds ago
    expect(TimeUtils.isExpired(past)).toBe(true);
    
    const future = new Date(Date.now() + 10000); // 10 seconds from now
    expect(TimeUtils.isExpired(future)).toBe(false);
  });

  test('should add minutes to date', () => {
    const now = new Date();
    const future = TimeUtils.addMinutes(now, 30);
    const diffMs = future.getTime() - now.getTime();
    expect(diffMs).toBe(30 * 60 * 1000);
  });
});

describe('Database Operations', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.deal.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  test('should create user', async () => {
    const userData = {
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      referralCode: SecurityUtils.generateReferralCode(),
    };

    const user = await prisma.user.create({
      data: userData,
    });

    expect(user.telegramId).toBe(userData.telegramId);
    expect(user.username).toBe(userData.username);
    expect(user.isActive).toBe(true);
  });

  test('should create deal', async () => {
    // First create users
    const buyer = await prisma.user.create({
      data: {
        telegramId: '123456790',
        username: 'buyer',
        firstName: 'Test',
        lastName: 'Buyer',
        referralCode: SecurityUtils.generateReferralCode(),
      },
    });

    const seller = await prisma.user.create({
      data: {
        telegramId: '123456791',
        username: 'seller',
        firstName: 'Test',
        lastName: 'Seller',
        referralCode: SecurityUtils.generateReferralCode(),
      },
    });

    const dealData = {
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

    const deal = await prisma.deal.create({
      data: dealData,
    });

    expect(deal.buyerId).toBe(buyer.id);
    expect(deal.sellerId).toBe(seller.id);
    expect(deal.status).toBe('PENDING');
    expect(deal.cryptocurrency).toBe('BTC');
  });
});
