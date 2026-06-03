import { SimpleCache } from '../utils/cache';
import logger from '../utils/logger';
import type {
  TraktCastEntry,
  TraktIds,
  TraktPeopleResponse,
  TraktSearchItem,
  TraktTrendingItem,
} from '../types/trakt';

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

  private getAuthHeaders(accessToken?: string) {
    const headers = this.getHeaders();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
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
    return await this.request<TraktTrendingItem[]>(`/movies/trending?limit=${limit}&extended=full,images`);
  }

  /*
    User-scoped endpoints (require OAuth access token)
  */

  async getWatchlist(accessToken: string, type = 'all', page = 1, limit = 10): Promise<any[]> {
    const qType = type === 'all' ? '' : `/${encodeURIComponent(type)}`;
    const path = `/sync/watchlist${qType}?page=${page}&limit=${limit}&extended=full,images`;
    const url = `${this.base}${path}`;
    const cacheKey = `trakt:watchlist:${type}:${page}:${limit}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const res = await fetch(url, { method: 'GET', headers: this.getAuthHeaders(accessToken) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed fetching watchlist', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt watchlist returned ${res.status}`);
    }
    const json = await res.json();
    this.cache.set(cacheKey, json, 60 * 2);
    return json;
  }

  async getHistory(accessToken: string, type = '', page = 1, limit = 20): Promise<any[]> {
    const qType = type ? `/${encodeURIComponent(type)}` : '';
    const path = `/sync/history${qType}?page=${page}&limit=${limit}&extended=full,images`;
    const url = `${this.base}${path}`;
    const res = await fetch(url, { method: 'GET', headers: this.getAuthHeaders(accessToken) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed fetching history', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt history returned ${res.status}`);
    }
    return await res.json();
  }

  async getPlaybackEpisodes(accessToken: string): Promise<any[]> {
    const path = `/sync/playback/episodes`;
    const url = `${this.base}${path}?extended=full,images`;
    const res = await fetch(url, { method: 'GET', headers: this.getAuthHeaders(accessToken) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed fetching playback episodes', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt playback episodes returned ${res.status}`);
    }
    return await res.json();
  }

  async getPlaybackMovies(accessToken: string): Promise<any[]> {
    const path = `/sync/playback/movies`;
    const url = `${this.base}${path}?extended=full,images`;
    const res = await fetch(url, { method: 'GET', headers: this.getAuthHeaders(accessToken) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed fetching playback movies', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt playback movies returned ${res.status}`);
    }
    return await res.json();
  }

  async getContinueWatching(accessToken: string, limit = 20): Promise<any[]> {
    const [episodes, movies] = await Promise.all([
      this.getPlaybackEpisodes(accessToken),
      this.getPlaybackMovies(accessToken),
    ]);
    const combined = [...(episodes || []), ...(movies || [])];
    return combined.slice(0, limit);
  }

  async addHistoryEntry(accessToken: string, payload: any): Promise<any> {
    const path = `/sync/history`;
    const url = `${this.base}${path}`;
    const res = await fetch(url, { method: 'POST', headers: this.getAuthHeaders(accessToken), body: JSON.stringify(payload) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed adding history', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt history add returned ${res.status}`);
    }
    return await res.json();
  }

  async createCheckin(accessToken: string, payload: any): Promise<any> {
    const url = `${this.base}/checkin`;
    const res = await fetch(url, { method: 'POST', headers: this.getAuthHeaders(accessToken), body: JSON.stringify(payload) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed creating checkin', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt checkin returned ${res.status}`);
    }
    return await res.json();
  }

  async rateItem(accessToken: string, payload: any): Promise<any> {
    const url = `${this.base}/sync/ratings`;
    const res = await fetch(url, { method: 'POST', headers: this.getAuthHeaders(accessToken), body: JSON.stringify(payload) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed saving rating', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt ratings returned ${res.status}`);
    }
    return await res.json();
  }

  async addToWatchlist(accessToken: string, payload: any): Promise<any> {
    const url = `${this.base}/sync/watchlist`;
    const res = await fetch(url, { method: 'POST', headers: this.getAuthHeaders(accessToken), body: JSON.stringify(payload) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed adding to watchlist', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt watchlist add returned ${res.status}`);
    }
    return await res.json();
  }

  async removeFromWatchlist(accessToken: string, payload: any): Promise<any> {
    const url = `${this.base}/sync/watchlist/remove`;
    const res = await fetch(url, { method: 'POST', headers: this.getAuthHeaders(accessToken), body: JSON.stringify(payload) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed removing from watchlist', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt watchlist remove returned ${res.status}`);
    }
    return await res.json();
  }

  async getRecommendations(accessToken: string, type = 'movies', page = 1, limit = 10): Promise<any[]> {
    const path = `/recommendations/${encodeURIComponent(type)}?page=${page}&limit=${limit}&extended=full,images`;
    const url = `${this.base}${path}`;
    const res = await fetch(url, { method: 'GET', headers: this.getAuthHeaders(accessToken) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed fetching recommendations', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt recommendations returned ${res.status}`);
    }
    return await res.json();
  }

  async getUserStats(accessToken: string): Promise<any> {
    const url = `${this.base}/users/me/stats`;
    const res = await fetch(url, { method: 'GET', headers: this.getAuthHeaders(accessToken) });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Failed fetching user stats', { status: res.status, body: body.slice(0, 1000) });
      throw new Error(`Trakt user stats returned ${res.status}`);
    }
    return await res.json();
  }

  private getItemPath(ids: TraktIds | undefined): string | null {
    if (!ids) {
      return null;
    }
    if (typeof ids.trakt === 'number') {
      return String(ids.trakt);
    }
    if (typeof ids.slug === 'string' && ids.slug.length > 0) {
      return encodeURIComponent(ids.slug);
    }
    return null;
  }

  private async getPeople(type: 'movie' | 'show', ids: TraktIds | undefined): Promise<TraktCastEntry[]> {
    const itemId = this.getItemPath(ids);
    if (!itemId) {
      return [];
    }

    const response = await this.request<TraktPeopleResponse>(`/${type}s/${itemId}/people?extended=full`);
    return response.cast ?? [];
  }

  async getCastForItem(item: TraktSearchItem): Promise<TraktCastEntry[]> {
    if (item.type === 'movie' && item.movie) {
      return await this.getPeople('movie', item.movie.ids);
    }
    if (item.type === 'show' && item.show) {
      return await this.getPeople('show', item.show.ids);
    }
    return [];
  }

  private async searchEndpoint(type: 'movie' | 'show', query: string, limit: number): Promise<TraktSearchItem[]> {
    const encoded = encodeURIComponent(query);
    return await this.request<TraktSearchItem[]>(`/search/${type}?query=${encoded}&limit=${limit}&extended=full,images`);
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
