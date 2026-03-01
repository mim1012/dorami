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
      email: _json.kakao_account?.email,
      nickname: username ?? _json.properties?.nickname ?? 'User',
      profileImage: _json.properties?.profile_image,
    });

    done(null, user);
  }
}
