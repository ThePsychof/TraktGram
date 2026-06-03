import { SimpleCache } from '../utils/cache';
import logger from '../utils/logger';

export class TraktClient {
  private base = 'https://api.trakt.tv';
  private cache = new SimpleCache();

  constructor(private apiKey: string) {
    if (!this.apiKey) logger.error('TraktClient initialized without api key');
  }

  private getHeaders() {
    if (!this.apiKey) throw new Error('Trakt API key not configured');
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'TraktGram/1.0',
      'trakt-api-version': '2',
      'trakt-api-key': this.apiKey,
    } as Record<string, string>;
  }

  private getAuthHeaders(accessToken?: string) {
    const headers = this.getHeaders();
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  }

  async request<T>(path: string, ttlSeconds = 60 * 5): Promise<T> {
    const cacheKey = `trakt:${path}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const url = `${this.base}${path}`;
    logger.info('TraktClient.request', { url });

    const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
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
      this.cache.set(cacheKey, json, ttlSeconds);
      return json;
    } catch (error) {
      logger.error('Failed to parse JSON from Trakt', error);
      throw new Error('Invalid Trakt response');
    }
  }

  async requestAuth<T>(path: string, accessToken: string, method = 'GET', body?: unknown): Promise<T> {
    const url = `${this.base}${path}`;
    const headers = this.getAuthHeaders(accessToken);
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (!res.ok) {
      logger.error('Trakt authenticated request failed', { url, status: res.status, body: text.slice(0, 1000) });
      const err = new Error(`Trakt API returned ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      logger.error('Failed to parse JSON from authenticated Trakt response', error);
      throw new Error('Invalid Trakt response');
    }
  }
}
