import type { OAuthService } from './oauth';
import type { TraktService } from './trakt';

export class UserService {
  constructor(private oauth: OAuthService, private trakt: TraktService) {}

  async getProfile(telegramId: number) {
    const oauthData = await this.oauth.getAuthenticatedUser(telegramId);
    if (!oauthData) return null;
    const access = oauthData.accessToken;
    const stats = await this.trakt.getUserStats(access);
    return { oauth: oauthData, stats };
  }
}
