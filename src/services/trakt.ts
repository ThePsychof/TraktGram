import logger from '../utils/logger';
import type { TraktTrendingItem } from '../types/trakt';

/*
  TraktService: encapsulates all Trakt API communication.
  - Uses `fetch` and required headers for Trakt API v2.
  - Exposes `getTrendingMovies(limit)` which returns typed items.
*/
export class TraktService {
  private base = 'https://api.trakt.tv';

  constructor(private apiKey: string) {
    if (!this.apiKey) {
      logger.error('Trakt API key not set in TraktService constructor');
    }
  }

  private getHeaders() {
    if (!this.apiKey) {
      throw new Error('Trakt API key not configured');
    }
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'TraktGram/1.0',
      'trakt-api-version': '2',
      'trakt-api-key': this.apiKey,
    } as Record<string, string>;
  }

  async getTrendingMovies(limit = 5): Promise<TraktTrendingItem[]> {
    const url = `${this.base}/movies/trending?limit=${limit}`;
    const headers = this.getHeaders();
    logger.info('Sending request to Trakt', { url, headers });

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
      });

      const responseUrl = res.url;
      const status = res.status;
      const statusText = res.statusText;
      const responseHeaders = Object.fromEntries(res.headers.entries());
      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      const body = await res.text();
      const bodySample = body.slice(0, 1000);
      const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml') || body.trim().startsWith('<');

      const responseInfo = {
        url,
        responseUrl,
        status,
        statusText,
        headers: responseHeaders,
        contentType,
        bodySample,
        isHtml,
      };

      if (!res.ok) {
        logger.error('Trakt API returned non-ok response', responseInfo);
        const htmlReason = isHtml ? 'HTML response detected instead of JSON.' : 'Non-JSON response detected.';
        throw new Error(`Trakt API returned ${status} ${statusText}. ${htmlReason}`);
      }

      if (isHtml) {
        logger.error('Trakt API returned HTML instead of JSON', responseInfo);
        throw new Error('Trakt API returned HTML instead of JSON');
      }

      try {
        return JSON.parse(body) as TraktTrendingItem[];
      } catch (parseErr) {
        logger.error('Trakt API returned invalid JSON', {
          ...responseInfo,
          parseError: parseErr,
        });
        throw new Error('Trakt API returned invalid JSON');
      }
    } catch (err) {
      logger.error('Failed to fetch trending movies from Trakt', err);
      throw new Error('Unable to fetch trending movies right now. Try again later.');
    }
  }
}
