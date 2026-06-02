import type { StoredOAuthData } from '../types/oauth';
import logger from '../utils/logger';

/**
 * StorageService: Abstraction layer for Cloudflare KV storage
 * Handles persistence of OAuth data for authenticated users
 */
export class StorageService {
  constructor(private kv: KVNamespace) {
    if (!this.kv) {
      logger.warn('KV namespace not initialized - storage will not persist');
    }
  }

  private getOAuthKey(telegramId: number): string {
    return `oauth:${telegramId}`;
  }

  private getStateKey(state: string): string {
    return `state:${state}`;
  }

  /**
   * Store OAuth data for a user
   */
  async storeOAuthData(data: StoredOAuthData): Promise<void> {
    if (!this.kv) {
      logger.warn('KV namespace not available - cannot store OAuth data');
      return;
    }

    try {
      const key = this.getOAuthKey(data.telegramId);
      // Set with 30-day expiration
      const expirationTtl = 30 * 24 * 60 * 60;
      await this.kv.put(key, JSON.stringify(data), { expirationTtl });
      logger.info('Stored OAuth data for user', { telegramId: data.telegramId });
    } catch (error) {
      logger.error('Failed to store OAuth data', error);
      throw new Error('Failed to store authentication data');
    }
  }

  /**
   * Retrieve OAuth data for a user
   */
  async getOAuthData(telegramId: number): Promise<StoredOAuthData | null> {
    if (!this.kv) {
      logger.warn('KV namespace not available - cannot retrieve OAuth data');
      return null;
    }

    try {
      const key = this.getOAuthKey(telegramId);
      const data = await this.kv.get(key, 'json');
      if (data) {
        logger.info('Retrieved OAuth data for user', { telegramId });
        return data as StoredOAuthData;
      }
      return null;
    } catch (error) {
      logger.error('Failed to retrieve OAuth data', error);
      return null;
    }
  }

  /**
   * Delete OAuth data for a user (logout)
   */
  async deleteOAuthData(telegramId: number): Promise<void> {
    if (!this.kv) {
      return;
    }

    try {
      const key = this.getOAuthKey(telegramId);
      await this.kv.delete(key);
      logger.info('Deleted OAuth data for user', { telegramId });
    } catch (error) {
      logger.error('Failed to delete OAuth data', error);
    }
  }

  /**
   * Store OAuth state for CSRF protection
   * State expires after 10 minutes
   */
  async storeOAuthState(state: string, telegramId: number): Promise<void> {
    if (!this.kv) {
      logger.warn('KV namespace not available - cannot store OAuth state');
      return;
    }

    try {
      const key = this.getStateKey(state);
      const expirationTtl = 10 * 60; // 10 minutes
      await this.kv.put(key, JSON.stringify({ telegramId, createdAt: Date.now() }), { expirationTtl });
      logger.info('Stored OAuth state', { state: state.slice(0, 8) });
    } catch (error) {
      logger.error('Failed to store OAuth state', error);
      throw new Error('Failed to create login session');
    }
  }

  /**
   * Verify and consume OAuth state
   * Returns telegramId if valid, null if invalid or expired
   */
  async verifyOAuthState(state: string): Promise<number | null> {
    if (!this.kv) {
      logger.warn('KV namespace not available - cannot verify OAuth state');
      return null;
    }

    try {
      const key = this.getStateKey(state);
      const stateData = await this.kv.get(key, 'json');

      if (!stateData) {
        logger.warn('Invalid or expired OAuth state', { state: state.slice(0, 8) });
        return null;
      }

      // Consume the state by deleting it
      await this.kv.delete(key);

      const data = stateData as { telegramId: number; createdAt: number };
      logger.info('Verified OAuth state', { telegramId: data.telegramId });
      return data.telegramId;
    } catch (error) {
      logger.error('Failed to verify OAuth state', error);
      return null;
    }
  }

  /**
   * Check if a user is authenticated
   */
  async isAuthenticated(telegramId: number): Promise<boolean> {
    const data = await this.getOAuthData(telegramId);
    if (!data) {
      return false;
    }

    // Check if token is expired
    if (data.expiresAt < Date.now()) {
      logger.info('Token expired for user', { telegramId });
      return false;
    }

    return true;
  }
}

// Type definition for KV binding in Cloudflare Workers
declare global {
  interface KVNamespace {
    get(key: string, type: 'json'): Promise<object | null>;
    get(key: string, type?: 'text'): Promise<string | null>;
    put(key: string, value: string | ReadableStream<Uint8Array> | ArrayBuffer, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
  }
}
