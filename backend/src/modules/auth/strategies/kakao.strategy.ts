import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

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
      kakaoPhone: _json.kakao_account?.phone_number, // optional backup only
      nickname: username ?? _json.properties?.nickname ?? 'User',
      profileImage: _json.properties?.profile_image,
    });

    done(null, user);
  }
}
