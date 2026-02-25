import { PrismaClient, Role, UserStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.notificationSubscription.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.pointBalance.deleteMany();
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
  await prisma.notice.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.user.deleteMany();

  // ────────────────────────────────────────
  // Admin User
  // ────────────────────────────────────────
  console.log('Creating admin user...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@dorami.shop',
      kakaoId: 'admin_kakao_001',
      name: 'Dorami Admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      depositorName: 'Doremi',
      instagramId: 'doremi.shop',
      shippingAddress: {
        street: '123 Commerce St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        country: 'USA',
      },
    },
  });
  console.log(`Admin user created: ${adminUser.email}`);

  // Test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      kakaoId: 'test_kakao_002',
      name: 'Test Buyer',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      depositorName: 'Test Buyer',
      instagramId: 'test.buyer',
      shippingAddress: {
        street: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'USA',
      },
    },
  });
  console.log(`Test user created: ${testUser.email}`);

  // ────────────────────────────────────────
  // Live Streams (2 upcoming)
  // ────────────────────────────────────────
  console.log('Creating live streams...');

  const now = new Date();

  const stream1 = await prisma.liveStream.create({
    data: {
      streamKey: 'doremi-beauty-live-001',
      userId: adminUser.id,
      title: '2월 뷰티 신상 특집 라이브',
      status: 'PENDING',
      expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3시간 후
    },
  });

  const stream2 = await prisma.liveStream.create({
    data: {
      streamKey: 'doremi-fashion-live-002',
      userId: adminUser.id,
      title: '겨울 패션 아이템 특가 방송',
      status: 'PENDING',
      expiresAt: new Date(now.getTime() + 26 * 60 * 60 * 1000), // 내일
    },
  });

  console.log(`Live streams created: ${stream1.title}, ${stream2.title}`);

  // ────────────────────────────────────────
  // Products (10개)
  // ────────────────────────────────────────
  console.log('Creating products...');

  const products = [
    {
      streamKey: stream1.streamKey,
      name: '글로우 쿠션 파운데이션',
      price: new Decimal(38000),
      quantity: 50,
      colorOptions: ['21호 라이트', '23호 내추럴', '25호 웜'],
      sizeOptions: [],
      shippingFee: new Decimal(3000),
      imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80',
      isNew: true,
      discountRate: new Decimal(20),
      originalPrice: new Decimal(47500),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream1.streamKey,
      name: '벨벳 립 틴트 세트 (3색)',
      price: new Decimal(24000),
      quantity: 80,
      colorOptions: ['로즈 레드', '코랄 피치', '플럼 와인'],
      sizeOptions: [],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500&q=80',
      isNew: true,
      discountRate: new Decimal(0),
      originalPrice: new Decimal(24000),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream1.streamKey,
      name: '히알루론산 수분 세럼 50ml',
      price: new Decimal(29000),
      quantity: 100,
      colorOptions: [],
      sizeOptions: ['50ml', '100ml'],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&q=80',
      isNew: false,
      discountRate: new Decimal(35),
      originalPrice: new Decimal(44600),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream1.streamKey,
      name: '프리미엄 메이크업 브러시 12종',
      price: new Decimal(45000),
      quantity: 30,
      colorOptions: ['블랙', '로즈골드'],
      sizeOptions: [],
      shippingFee: new Decimal(3000),
      imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80',
      isNew: false,
      discountRate: new Decimal(25),
      originalPrice: new Decimal(60000),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream1.streamKey,
      name: '시카 리페어 크림 80ml',
      price: new Decimal(32000),
      quantity: 120,
      colorOptions: [],
      sizeOptions: ['80ml'],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=500&q=80',
      isNew: false,
      discountRate: new Decimal(15),
      originalPrice: new Decimal(37600),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream2.streamKey,
      name: '오버사이즈 캐시미어 코트',
      price: new Decimal(189000),
      quantity: 15,
      colorOptions: ['블랙', '카멜', '그레이'],
      sizeOptions: ['S', 'M', 'L', 'XL'],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=500&q=80',
      isNew: true,
      discountRate: new Decimal(30),
      originalPrice: new Decimal(270000),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream2.streamKey,
      name: '프리미엄 가죽 토트백',
      price: new Decimal(129000),
      quantity: 25,
      colorOptions: ['블랙', '탄', '버건디'],
      sizeOptions: [],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80',
      isNew: false,
      discountRate: new Decimal(0),
      originalPrice: new Decimal(129000),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream2.streamKey,
      name: '울 블렌드 니트 스웨터',
      price: new Decimal(59000),
      quantity: 40,
      colorOptions: ['아이보리', '네이비', '차콜'],
      sizeOptions: ['S', 'M', 'L'],
      shippingFee: new Decimal(3000),
      imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500&q=80',
      isNew: false,
      discountRate: new Decimal(40),
      originalPrice: new Decimal(98300),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream2.streamKey,
      name: '스마트 피트니스 워치 Pro',
      price: new Decimal(199000),
      quantity: 20,
      colorOptions: ['미드나이트 블랙', '실버 화이트'],
      sizeOptions: ['40mm', '44mm'],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
      isNew: true,
      discountRate: new Decimal(10),
      originalPrice: new Decimal(221100),
      status: 'AVAILABLE' as const,
    },
    {
      streamKey: stream2.streamKey,
      name: '무선 노이즈캔슬링 이어폰',
      price: new Decimal(89000),
      quantity: 60,
      colorOptions: ['블랙', '화이트'],
      sizeOptions: [],
      shippingFee: new Decimal(0),
      freeShippingMessage: '무료배송',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
      isNew: false,
      discountRate: new Decimal(30),
      originalPrice: new Decimal(127100),
      status: 'AVAILABLE' as const,
    },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }
  console.log(`${products.length} products created`);

  // ────────────────────────────────────────
  // System Config
  // ────────────────────────────────────────
  console.log('Creating system config...');
  await prisma.systemConfig.create({
    data: {
      id: 'system',
      noticeText: null,
      noticeFontSize: 14,
      noticeFontFamily: 'Pretendard',
    },
  });

  // ────────────────────────────────────────
  // Notification Templates
  // ────────────────────────────────────────
  console.log('Creating notification templates...');
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

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
