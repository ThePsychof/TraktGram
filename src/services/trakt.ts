import { SimpleCache } from '../utils/cache';
import logger from '../utils/logger';
import type { TraktSearchItem, TraktTrendingItem } from '../types/trakt';

/*
  TraktService: encapsulates all Trakt API communication.
  - Uses `fetch` and required headers for Trakt API v2.
  - Exposes trending and search helpers.
*/
export class TraktService {
  private base = 'https://api.trakt.tv';
  private cache = new SimpleCache();

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

  private async request<T>(path: string): Promise<T> {
    const cacheKey = `trakt:${path}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${this.base}${path}`;
    const headers = this.getHeaders();
    logger.info('Sending request to Trakt', { url });

    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const bodyText = await res.text();
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml') || bodyText.trim().startsWith('<');

    if (!res.ok) {
      logger.error('Trakt API returned non-ok response', { url, status: res.status, statusText: res.statusText, body: bodyText.slice(0, 1000) });
      throw new Error(`Trakt API returned ${res.status}`);
    }

    if (isHtml) {
      logger.error('Trakt API returned HTML instead of JSON', { url, contentType, bodySample: bodyText.slice(0, 1000) });
      throw new Error('Trakt returned invalid content type');
    }

    try {
      const json = JSON.parse(bodyText) as T;
      this.cache.set(cacheKey, json, 60 * 5);
      return json;
    } catch (error) {
      logger.error('Failed to parse JSON from Trakt', error);
      throw new Error('Invalid Trakt response');
    }
  }

  async getTrendingMovies(limit = 5): Promise<TraktTrendingItem[]> {
    return await this.request<TraktTrendingItem[]>(`/movies/trending?limit=${limit}`);
  }

  private async searchEndpoint(type: 'movie' | 'show', query: string, limit: number): Promise<TraktSearchItem[]> {
    const encoded = encodeURIComponent(query);
    return await this.request<TraktSearchItem[]>(`/search/${type}?query=${encoded}&limit=${limit}&extended=full`);
  }

  async searchMulti(query: string, limit = 10): Promise<TraktSearchItem[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const cacheKey = `trakt:search:${normalizedQuery}:${limit}`;
    const cached = this.cache.get<TraktSearchItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const [movies, shows] = await Promise.all([
      this.searchEndpoint('movie', normalizedQuery, Math.ceil(limit / 2)),
      this.searchEndpoint('show', normalizedQuery, Math.ceil(limit / 2)),
    ]);

    const results = [...movies, ...shows]
      .filter((item) => item.type === 'movie' || item.type === 'show')
      .slice(0, limit);

    this.cache.set(cacheKey, results, 60 * 5);
    return results;
  }
}
