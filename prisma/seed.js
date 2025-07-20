const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample admin user
  const adminUser = await prisma.user.upsert({
    where: { telegramId: '123456789' },
    update: {},
    create: {
      telegramId: '123456789',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      isAdmin: true,
      isSuperAdmin: true,
      referralCode: 'ADMIN001',
    },
  });

  console.log('✅ Created admin user:', adminUser.username);

  // Create sample referral group
  const referralGroup = await prisma.referralGroup.upsert({
    where: { telegramId: '-1001234567890' },
    update: {},
    create: {
      telegramId: '-1001234567890',
      title: 'Sample Trading Group',
      adminUserId: adminUser.id,
      feePercentage: 1.0,
    },
  });

  console.log('✅ Created referral group:', referralGroup.title);

  // Initialize bot stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const botStats = await prisma.botStats.upsert({
    where: { date: today },
    update: {},
    create: {
      date: today,
      totalUsers: 1,
      totalDeals: 0,
      successfulDeals: 0,
      totalVolumeBtc: 0,
      totalVolumeLtc: 0,
      totalFees: 0,
    },
  });

  console.log('✅ Initialized bot stats for today');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
