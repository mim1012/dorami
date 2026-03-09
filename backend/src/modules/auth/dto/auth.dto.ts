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

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class TokenPayload {
  sub!: string; // userId (for compatibility)
  userId!: string; // User ID (duplicate of sub for clarity)
  email!: string; // User email
  kakaoId!: string;
  name!: string; // User display name
  role!: string;
  profileComplete?: boolean;
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
