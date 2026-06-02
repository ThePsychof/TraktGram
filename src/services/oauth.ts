import type {
  OAuthState,
  OAuthTokenResponse,
  OAuthCallbackParams,
  StoredOAuthData,
  TraktUser,
  RefreshTokenResponse,
} from '../types/oauth';
import type { StorageService } from './storage';
import logger from '../utils/logger';

/**
 * OAuthService: Handles complete OAuth 2.0 flow with Trakt
 * - Generates secure state parameters
 * - Exchanges authorization codes for tokens
 * - Manages token refresh
 * - Verifies user credentials
 */
export class OAuthService {
  private readonly TRAKT_AUTH_URL = 'https://trakt.tv/oauth/authorize';
  private readonly TRAKT_TOKEN_URL = 'https://api.trakt.tv/oauth/token';
  private readonly TRAKT_API_URL = 'https://api.trakt.tv';

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
    private storage: StorageService
  ) {
    if (!this.clientId || !this.clientSecret) {
      logger.error('OAuth credentials not configured');
    }
  }

  /**
   * Generate a secure random token for OAuth state parameter
   * Uses crypto for secure randomness
   */
  private async generateSecureToken(): Promise<string> {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create an OAuthState with Telegram user ID and secure token
   */
  async createOAuthState(telegramId: number): Promise<string> {
    const token = await this.generateSecureToken();
    const state = `${telegramId}_${token}`;

    // Store state for validation during callback
    await this.storage.storeOAuthState(state, telegramId);

    return state;
  }

  /**
   * Generate the Trakt OAuth authorization URL
   */
  async generateAuthorizationUrl(telegramId: number): Promise<string> {
    const state = await this.createOAuthState(telegramId);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });

    return `${this.TRAKT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    const payload = {
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    };

    logger.info('Exchanging authorization code for tokens');

    const response = await fetch(this.TRAKT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TraktGram/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Failed to exchange authorization code', {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      throw new Error(`OAuth token exchange failed: ${response.status}`);
    }

    const tokenData = (await response.json()) as OAuthTokenResponse;
    logger.info('Successfully exchanged authorization code for tokens');

    return tokenData;
  }

  /**
   * Refresh expired access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const payload = {
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    };

    logger.info('Refreshing access token');

    const response = await fetch(this.TRAKT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TraktGram/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Failed to refresh access token', {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokenData = (await response.json()) as RefreshTokenResponse;
    logger.info('Successfully refreshed access token');

    return tokenData;
  }

  /**
   * Get user settings and info from Trakt API
   * Validates the access token and retrieves user information
   */
  async getUserInfo(accessToken: string): Promise<TraktUser> {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'TraktGram/1.0',
      'trakt-api-version': '2',
      'trakt-api-key': this.clientId,
      Authorization: `Bearer ${accessToken}`,
    };

    logger.info('Fetching user info from Trakt');

    const response = await fetch(`${this.TRAKT_API_URL}/users/settings`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Failed to fetch user info', {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const user = (await response.json()) as TraktUser;
    logger.info('Successfully fetched user info', { username: user.username });

    return user;
  }

  /**
   * Complete OAuth flow: validate state, exchange code, get user info, store data
   */
  async handleCallback(params: OAuthCallbackParams): Promise<StoredOAuthData> {
    // Validate state parameter (CSRF protection)
    const telegramId = await this.storage.verifyOAuthState(params.state);
    if (!telegramId) {
      throw new Error('Invalid or expired state parameter');
    }

    logger.info('Processing OAuth callback', { telegramId });

    // Exchange code for tokens
    const tokenData = await this.exchangeCodeForTokens(params.code);

    // Get user info to verify token works
    const userInfo = await this.getUserInfo(tokenData.access_token);

    // Calculate expiration time
    const expiresAt = Date.now() + tokenData.expires_in * 1000;

    // Create storage object
    const oauthData: StoredOAuthData = {
      telegramId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      createdAt: Date.now(),
      username: userInfo.username,
      userId: userInfo.ids?.trakt,
    };

    // Store in KV
    await this.storage.storeOAuthData(oauthData);

    logger.info('Successfully completed OAuth flow', {
      telegramId,
      username: userInfo.username,
    });

    return oauthData;
  }

  /**
   * Get valid access token for a user, refreshing if necessary
   */
  async getValidAccessToken(telegramId: number): Promise<string | null> {
    const oauthData = await this.storage.getOAuthData(telegramId);
    if (!oauthData) {
      return null;
    }

    // Check if token is still valid
    if (oauthData.expiresAt > Date.now()) {
      return oauthData.accessToken;
    }

    // Token expired, refresh it
    logger.info('Access token expired, refreshing', { telegramId });

    try {
      const newTokenData = await this.refreshAccessToken(oauthData.refreshToken);

      const expiresAt = Date.now() + newTokenData.expires_in * 1000;

      // Update stored data with new tokens
      const updatedData: StoredOAuthData = {
        ...oauthData,
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token,
        expiresAt,
      };

      await this.storage.storeOAuthData(updatedData);

      logger.info('Successfully refreshed access token', { telegramId });
      return newTokenData.access_token;
    } catch (error) {
      logger.error('Failed to refresh access token', error);
      // Token refresh failed, delete stored data to force re-login
      await this.storage.deleteOAuthData(telegramId);
      return null;
    }
  }

  /**
   * Get authenticated user data
   */
  async getAuthenticatedUser(telegramId: number): Promise<StoredOAuthData | null> {
    return await this.storage.getOAuthData(telegramId);
  }

  /**
   * Logout user by deleting their OAuth data
   */
  async logout(telegramId: number): Promise<void> {
    await this.storage.deleteOAuthData(telegramId);
    logger.info('User logged out', { telegramId });
  }
}
