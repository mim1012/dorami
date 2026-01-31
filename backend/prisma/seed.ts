import { PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️  Clearing existing data...');
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.moderationLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.liveStream.deleteMany();
    await prisma.notificationTemplate.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.systemConfig.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create admin user
  console.log('👤 Creating admin user...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@livecommerce.com' },
    update: {},
    create: {
      email: 'admin@livecommerce.com',
      kakaoId: 'admin_kakao_id_seed',
      name: 'Admin User',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      depositorName: 'Admin',
      instagramId: 'admin_instagram',
      shippingAddress: {
        street: '123 Admin Street',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        country: 'USA',
      },
    },
  });
  console.log(`✅ Admin user created: ${adminUser.email}`);

  // Create test user
  console.log('👤 Creating test user...');
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      kakaoId: 'test_kakao_id_seed',
      name: 'Test User',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      depositorName: 'Test User',
      instagramId: 'test_user_ig',
      shippingAddress: {
        street: '456 Test Avenue',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'USA',
      },
    },
  });
  console.log(`✅ Test user created: ${testUser.email}`);

  // Create system config (single-row configuration)
  console.log('⚙️  Creating system configuration...');
  await prisma.systemConfig.upsert({
    where: { id: 'system' },
    update: {},
    create: {
      id: 'system',
      noticeText: null, // No notice by default
      noticeFontSize: 14,
      noticeFontFamily: 'Pretendard',
    },
  });
  console.log('✅ System config created');

  // Create notification templates
  console.log('📧 Creating notification templates...');
  await prisma.notificationTemplate.createMany({
    data: [
      {
        name: 'ORDER_CONFIRMATION',
        type: 'ORDER_CONFIRMATION',
        template: '주문이 완료되었습니다. 주문번호: {{orderNumber}}',
      },
      {
        name: 'PAYMENT_REMINDER',
        type: 'PAYMENT_REMINDER',
        template: '입금 확인 요청: {{depositorName}}님, 주문번호 {{orderNumber}}',
      },
      {
        name: 'PAYMENT_CONFIRMED',
        type: 'PAYMENT_CONFIRMED',
        template: '입금이 확인되었습니다. 곧 배송됩니다.',
      },
      {
        name: 'RESERVATION_PROMOTED',
        type: 'RESERVATION_PROMOTED',
        template: '대기번호 {{reservationNumber}}번이 승격되었습니다. 5분 내 결제해주세요.',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Notification templates created');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
