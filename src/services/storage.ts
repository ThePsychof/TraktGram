import type { StoredOAuthData } from '../types/oauth';
import logger from '../utils/logger';

export interface PendingWatchTime {
  type: string;
  id: number;
  title?: string;
}

export class StorageService {
  constructor(public readonly kv: KVNamespace) {
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

  private getPendingWatchTimeKey(telegramId: number): string {
    return `pending:watchtime:${telegramId}`;
  }

  async storeOAuthData(data: StoredOAuthData): Promise<void> {
    if (!this.kv) {
      logger.warn('KV namespace not available - cannot store OAuth data');
      return;
    }
    try {
      const key = this.getOAuthKey(data.telegramId);
      await this.kv.put(key, JSON.stringify(data));
      logger.info('Stored OAuth data for user', { telegramId: data.telegramId });
    } catch (error) {
      logger.error('Failed to store OAuth data', error);
      throw new Error('Failed to store authentication data');
    }
  }

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

  async deleteOAuthData(telegramId: number): Promise<void> {
    if (!this.kv) return;
    try {
      const key = this.getOAuthKey(telegramId);
      await this.kv.delete(key);
      logger.info('Deleted OAuth data for user', { telegramId });
    } catch (error) {
      logger.error('Failed to delete OAuth data', error);
    }
  }

  async storeOAuthState(state: string, telegramId: number): Promise<void> {
    if (!this.kv) {
      logger.warn('KV namespace not available - cannot store OAuth state');
      return;
    }
    try {
      const key = this.getStateKey(state);
      const expirationTtl = 10 * 60;
      await this.kv.put(key, JSON.stringify({ telegramId, createdAt: Date.now() }), { expirationTtl });
      logger.info('Stored OAuth state', { state: state.slice(0, 8) });
    } catch (error) {
      logger.error('Failed to store OAuth state', error);
      throw new Error('Failed to create login session');
    }
  }

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
      await this.kv.delete(key);
      const data = stateData as { telegramId: number; createdAt: number };
      logger.info('Verified OAuth state', { telegramId: data.telegramId });
      return data.telegramId;
    } catch (error) {
      logger.error('Failed to verify OAuth state', error);
      return null;
    }
  }

  async isAuthenticated(telegramId: number): Promise<boolean> {
    const data = await this.getOAuthData(telegramId);
    if (!data) return false;
    if (data.expiresAt < Date.now()) {
      logger.info('Token expired for user', { telegramId });
      return false;
    }
    return true;
  }

  // ---- Pending watch time (5 minute TTL) ----

  async setPendingWatchTime(telegramId: number, pending: PendingWatchTime): Promise<void> {
    if (!this.kv) return;
    try {
      const key = this.getPendingWatchTimeKey(telegramId);
      await this.kv.put(key, JSON.stringify(pending), { expirationTtl: 300 });
      logger.info('Stored pending watch time', { telegramId, type: pending.type, id: pending.id });
    } catch (error) {
      logger.error('Failed to store pending watch time', error);
      throw new Error('Failed to start watch time flow');
    }
  }

  async getPendingWatchTime(telegramId: number): Promise<PendingWatchTime | null> {
    if (!this.kv) return null;
    try {
      const key = this.getPendingWatchTimeKey(telegramId);
      const raw = await this.kv.get(key, 'json');
      return (raw as PendingWatchTime) ?? null;
    } catch (error) {
      logger.error('Failed to get pending watch time', error);
      return null;
    }
  }

  async clearPendingWatchTime(telegramId: number): Promise<void> {
    if (!this.kv) return;
    try {
      const key = this.getPendingWatchTimeKey(telegramId);
      await this.kv.delete(key);
    } catch (error) {
      logger.error('Failed to clear pending watch time', error);
    }
  }
}