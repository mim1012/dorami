import { IsString, IsNotEmpty } from 'class-validator';

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    kakaoId: string;
    email?: string;
    name: string;
    role: string;
  };
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class TokenPayload {
  sub: string; // userId (for compatibility)
  userId: string; // User ID (duplicate of sub for clarity)
  email: string; // User email
  kakaoId: string;
  name: string; // User display name
  role: string;
  type?: string; // 'access' or 'refresh'
  jti?: string; // unique token ID for blacklisting
  iat?: number;
  exp?: number;
}
