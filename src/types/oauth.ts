/**
 * OAuth types and interfaces for Trakt authentication
 */

export interface OAuthState {
  telegramId: number;
  token: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

export interface TraktUser {
  username: string;
  email?: string;
  name?: string;
  ids?: {
    trakt?: number;
    slug?: string;
  };
}

export interface StoredOAuthData {
  telegramId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
  username?: string;
  userId?: number;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}
