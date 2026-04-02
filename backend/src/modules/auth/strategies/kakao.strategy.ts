import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

// Kakao returns phone_number as "+82 10-1234-5678". Bizgo requires "01012345678".
function normalizeKoreanPhone(phone: string | undefined): string | undefined {
  if (!phone) {
    return undefined;
  }
  const digits = phone.replace(/\D/g, ''); // strip all non-digits
  if (digits.startsWith('82') && digits.length >= 11) {
    return '0' + digits.slice(2); // +82 10... → 010...
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return digits; // already normalized
  }
  return undefined; // non-Korean number (e.g. +1...)
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('KAKAO_CLIENT_ID') as string,
      clientSecret: configService.get('KAKAO_CLIENT_SECRET') as string,
      callbackURL: configService.get('KAKAO_CALLBACK_URL') as string,
      // Scope (phone_number only, no email) is configured in the Kakao Developer Console,
      // not here — passport-kakao StrategyOption does not accept a scope field.
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: null, user: unknown) => void,
  ) {
    const { id, username, _json } = profile;

    const user = await this.authService.validateKakaoUser({
      kakaoId: String(id),
      // email is NOT collected from Kakao (privacy policy: user provides email manually)
      kakaoPhone: normalizeKoreanPhone(_json.kakao_account?.phone_number),
      nickname: username ?? _json.properties?.nickname ?? 'User',
      profileImage: _json.properties?.profile_image,
    });

    done(null, user);
  }
}
