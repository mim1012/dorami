import { IsString, IsNotEmpty, IsEmail, IsOptional, MaxLength } from 'class-validator';

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    kakaoId: string;
    email?: string;
    name: string;
    role: string;
    profileComplete: boolean;
  };
}

export class AuthSessionSummaryDto {
  id!: string;
  current!: boolean;
  familyId?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  lastUsedAt?: string | null;
  expiresAt!: string;
  revokedAt?: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class TokenPayload {
  sub!: string; // userId (for compatibility)
  userId!: string; // User ID (duplicate of sub for clarity)
  sid?: string; // Session ID for per-device auth session tracking
  email!: string; // User email
  kakaoId!: string;
  name!: string; // User display name
  role!: string;
  profileComplete?: boolean;
  shippingAddressComplete?: boolean;
  type?: string; // 'access' or 'refresh'
  jti?: string; // unique token ID for blacklisting
  iat?: number;
  exp?: number;
}

export class DevLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
