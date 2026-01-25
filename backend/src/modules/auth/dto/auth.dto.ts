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
  sub: string; // userId
  kakaoId: string;
  role: string;
  iat?: number;
  exp?: number;
}
