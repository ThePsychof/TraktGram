import logger from '../utils/logger';
import type { TraktTrendingItem } from '../types/trakt';

/*
  TraktService: encapsulates all Trakt API communication.
  - Uses `fetch` and required headers for Trakt API v2.
  - Exposes `getTrendingMovies(limit)` which returns typed items.
*/
export class TraktService {
  private base = 'https://api.trakt.tv';

  constructor(private clientId: string) {
    if (!this.clientId) {
      logger.error('TRAKT_CLIENT_ID is not set in environment');
    }
  }

  private getHeaders() {
    if (!this.clientId) {
      throw new Error('Trakt API key not configured');
    }
    return {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.clientId,
    } as Record<string, string>;
  }

  async getTrendingMovies(limit = 5): Promise<TraktTrendingItem[]> {
    const url = `${this.base}/movies/trending?limit=${limit}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const body = await res.text();
        logger.error('Trakt API error', res.status, body);
        throw new Error('Trakt API returned an error');
      }

      return (await res.json()) as TraktTrendingItem[];
    } catch (err) {
      logger.error('Failed to fetch trending movies from Trakt', err);
      throw new Error('Unable to fetch trending movies right now. Try again later.');
    }
  }
}
