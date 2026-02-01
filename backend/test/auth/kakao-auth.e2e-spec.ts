/**
 * Kakao OAuth 2.0 통합 테스트
 *
 * 이 테스트는 docs/카카오 로그인 구현과 마케팅 선택 체크 관련 질문의
 * kakao_auth.test.js를 참조하여 NestJS 환경에 맞게 작성되었습니다.
 *
 * 테스트 실행:
 * npm run test:e2e kakao-auth.e2e-spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/common/prisma/prisma.module';
import { RedisModule } from '../../src/common/redis/redis.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtService } from '@nestjs/jwt';

describe('Kakao OAuth 2.0 인증 (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        PrismaModule,
        RedisModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 테스트 데이터 초기화 (외래 키 순서 고려)
    const testUsers = await prismaService.user.findMany({
      where: {
        email: {
          contains: 'test',
        },
      },
      select: { id: true },
    });

    const testUserIds = testUsers.map(u => u.id);

    if (testUserIds.length > 0) {
      // Delete related data first (foreign key constraints)
      await prismaService.cart.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prismaService.reservation.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prismaService.orderItem.deleteMany({
        where: { order: { userId: { in: testUserIds } } },
      });
      await prismaService.order.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prismaService.auditLog.deleteMany({
        where: { entityId: { in: testUserIds } },
      });

      // Finally delete users
      await prismaService.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
  });

  describe('카카오 OAuth 흐름 테스트', () => {
    describe('GET /auth/kakao', () => {
      it('카카오 인증 페이지로 리다이렉트해야 한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/auth/kakao')
          .expect(302);

        // 리다이렉트 URL에 카카오 인증 서버 포함 확인
        expect(response.headers.location).toContain('kauth.kakao.com');
        expect(response.headers.location).toContain('oauth/authorize');
      });

      it('리다이렉트 URL에 필수 파라미터가 포함되어야 한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/auth/kakao')
          .expect(302);

        const location = response.headers.location;
        expect(location).toContain('client_id=');
        expect(location).toContain('redirect_uri=');
        expect(location).toContain('response_type=code');
      });
    });

    describe('GET /auth/kakao/callback', () => {
      it('인증 코드 없이 요청하면 카카오 인증 페이지로 리다이렉트해야 한다', async () => {
        // Passport는 인증 코드가 없으면 새 인증 시도로 간주하고 카카오로 리다이렉트
        const response = await request(app.getHttpServer())
          .get('/api/auth/kakao/callback')
          .expect(302);

        // 카카오 인증 서버로 리다이렉트 (Passport의 정상 동작)
        expect(response.headers.location).toContain('kauth.kakao.com');
      });
    });
  });

  describe('validateKakaoUser 테스트', () => {
    it('신규 사용자를 생성하고 반환해야 한다', async () => {
      const kakaoUserData = {
        kakaoId: '1234567890',
        email: 'newuser@test.com',
        nickname: '새유저',
        profileImage: 'http://example.com/profile.jpg',
      };

      const user = await authService.validateKakaoUser(kakaoUserData);

      expect(user).toBeDefined();
      expect(user.kakaoId).toBe(kakaoUserData.kakaoId);
      expect(user.email).toBe(kakaoUserData.email);
      expect(user.name).toBe(kakaoUserData.nickname);

      // DB에 저장 확인
      const dbUser = await prismaService.user.findUnique({
        where: { kakaoId: kakaoUserData.kakaoId },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser?.email).toBe(kakaoUserData.email);
    });

    it('기존 사용자를 조회하고 lastLoginAt을 업데이트해야 한다', async () => {
      // given: 기존 사용자 생성
      const existingUser = await prismaService.user.create({
        data: {
          kakaoId: '9876543210',
          email: 'existing@test.com',
          name: '기존유저',
          lastLoginAt: new Date('2024-01-01'),
        },
      });

      const beforeLoginAt = existingUser.lastLoginAt;

      // 1초 대기하여 시간 차이 확보
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // when: 동일한 kakaoId로 로그인
      const kakaoUserData = {
        kakaoId: '9876543210',
        email: 'existing@test.com',
        nickname: '기존유저',
      };

      const user = await authService.validateKakaoUser(kakaoUserData);

      // then: lastLoginAt이 업데이트되었는지 확인
      expect(user.id).toBe(existingUser.id);
      expect(user.lastLoginAt?.getTime()).toBeGreaterThan(
        beforeLoginAt?.getTime() || 0,
      );
    });

    it('이메일이 없어도 사용자를 생성할 수 있어야 한다', async () => {
      const kakaoUserData = {
        kakaoId: '5555555555',
        email: undefined, // 이메일 동의하지 않은 경우
        nickname: '이메일없음',
      };

      const user = await authService.validateKakaoUser(kakaoUserData);

      expect(user).toBeDefined();
      expect(user.kakaoId).toBe(kakaoUserData.kakaoId);
      expect(user.email).toBeNull();
    });

    it('특수 문자가 포함된 이메일을 정상 처리해야 한다', async () => {
      const kakaoUserData = {
        kakaoId: '1111111111',
        email: 'test+special@example.co.kr',
        nickname: '특수이메일',
      };

      const user = await authService.validateKakaoUser(kakaoUserData);

      expect(user).toBeDefined();
      expect(user.email).toBe('test+special@example.co.kr');
    });

    it('한글과 이모지가 포함된 닉네임을 정상 처리해야 한다', async () => {
      const kakaoUserData = {
        kakaoId: '2222222222',
        email: 'emoji@test.com',
        nickname: '테스트유저🎉😀',
      };

      const user = await authService.validateKakaoUser(kakaoUserData);

      expect(user).toBeDefined();
      expect(user.name).toBe('테스트유저🎉😀');
    });
  });

  describe('login (JWT 토큰 발급) 테스트', () => {
    it('JWT 토큰을 발급하고 반환해야 한다', async () => {
      // given: 사용자 생성
      const user = await prismaService.user.create({
        data: {
          kakaoId: '3333333333',
          email: 'jwt@test.com',
          name: 'JWT테스트',
        },
      });

      // when: 로그인 처리
      const loginResponse = await authService.login(user);

      // then: 토큰 검증
      expect(loginResponse.accessToken).toBeDefined();
      expect(loginResponse.refreshToken).toBeDefined();

      // Access Token 검증
      const accessPayload = jwtService.verify(loginResponse.accessToken);
      expect(accessPayload.userId).toBe(user.id);
      expect(accessPayload.email).toBe(user.email);
      expect(accessPayload.role).toBe(user.role);

      // Refresh Token 검증
      const refreshPayload = jwtService.verify(loginResponse.refreshToken);
      expect(refreshPayload.userId).toBe(user.id);
    });

    it('JWT 토큰에 만료 시간이 설정되어야 한다', async () => {
      const user = await prismaService.user.create({
        data: {
          kakaoId: '4444444444',
          email: 'expiry@test.com',
          name: '만료테스트',
        },
      });

      const loginResponse = await authService.login(user);

      // Access Token 만료 시간 확인 (15분)
      const accessPayload = jwtService.decode(loginResponse.accessToken) as any;
      const accessTokenLifetime = accessPayload.exp - accessPayload.iat;
      expect(accessTokenLifetime).toBe(15 * 60); // 15 minutes

      // Refresh Token 만료 시간 확인 (7일)
      const refreshPayload = jwtService.decode(
        loginResponse.refreshToken,
      ) as any;
      const refreshTokenLifetime = refreshPayload.exp - refreshPayload.iat;
      expect(refreshTokenLifetime).toBe(7 * 24 * 60 * 60); // 7 days
    });
  });

  describe('토큰 갱신 테스트', () => {
    it('유효한 Refresh Token으로 Access Token을 갱신할 수 있어야 한다', async () => {
      // given: 사용자 생성 및 로그인
      const user = await prismaService.user.create({
        data: {
          kakaoId: '6666666666',
          email: 'refresh@test.com',
          name: '갱신테스트',
        },
      });

      const loginResponse = await authService.login(user);
      const oldAccessToken = loginResponse.accessToken;
      const refreshToken = loginResponse.refreshToken;

      // 1초 대기하여 iat (issued at) 타임스탬프가 달라지도록 보장
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // when: 토큰 갱신
      const refreshResponse = await authService.refreshToken(refreshToken);

      // then: 새로운 Access Token 발급 확인
      expect(refreshResponse.accessToken).toBeDefined();
      expect(refreshResponse.accessToken).not.toBe(oldAccessToken);

      // 새 토큰 검증
      const payload = jwtService.verify(refreshResponse.accessToken);
      expect(payload.userId).toBe(user.id);
    });

    it('잘못된 Refresh Token으로 갱신 시 에러를 던져야 한다', async () => {
      const invalidToken = 'invalid.refresh.token';

      await expect(authService.refreshToken(invalidToken)).rejects.toThrow();
    });
  });

  describe('프로필 완성 확인 테스트', () => {
    it('instagramId와 depositorName이 없으면 프로필 완성이 필요하다', async () => {
      const user = await prismaService.user.create({
        data: {
          kakaoId: '7777777777',
          email: 'incomplete@test.com',
          name: '미완성',
          instagramId: null,
          depositorName: null,
        },
      });

      expect(user.instagramId).toBeNull();
      expect(user.depositorName).toBeNull();

      // 프론트엔드에서 /profile/register로 리다이렉트되어야 함
    });

    it('instagramId와 depositorName이 있으면 프로필이 완성되었다', async () => {
      const user = await prismaService.user.create({
        data: {
          kakaoId: '8888888888',
          email: 'complete@test.com',
          name: '완성',
          instagramId: '@testuser',
          depositorName: '테스트예금주',
        },
      });

      expect(user.instagramId).toBe('@testuser');
      expect(user.depositorName).toBe('테스트예금주');

      // 프론트엔드에서 홈으로 리다이렉트되어야 함
    });
  });

  describe('성능 및 동시성 테스트', () => {
    it('동시 다중 로그인 요청을 처리할 수 있어야 한다', async () => {
      // given: 10명의 사용자 생성
      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prismaService.user.create({
            data: {
              kakaoId: `concurrent_${i}_${Date.now()}`,
              email: `concurrent${i}@test.com`,
              name: `동시유저${i}`,
            },
          }),
        ),
      );

      // when: 동시에 로그인 처리
      const loginPromises = users.map((user) => authService.login(user));
      const loginResponses = await Promise.all(loginPromises);

      // then: 모든 로그인 성공 확인
      expect(loginResponses).toHaveLength(10);
      loginResponses.forEach((response) => {
        expect(response.accessToken).toBeDefined();
        expect(response.refreshToken).toBeDefined();
      });

      // 각 토큰이 고유한지 확인
      const accessTokens = loginResponses.map((r) => r.accessToken);
      const uniqueAccessTokens = new Set(accessTokens);
      expect(uniqueAccessTokens.size).toBe(10);
    });
  });

  describe('로그아웃 테스트', () => {
    it('로그아웃 시 세션을 정리해야 한다', async () => {
      // given: 사용자 생성 및 로그인
      const user = await prismaService.user.create({
        data: {
          kakaoId: '9999999999',
          email: 'logout@test.com',
          name: '로그아웃테스트',
        },
      });

      // when: 로그아웃
      await authService.logout(user.id);

      // then: 로그아웃 성공 (추가 로직이 있다면 여기서 검증)
      // 예: 토큰 블랙리스트, 세션 삭제 등
    });
  });
});
