import logger from '../utils/logger';
import type {
  TraktCastEntry,
  TraktIds,
  TraktEpisodeBase,
  TraktPeopleResponse,
  TraktShowProgress,
} from '../types/trakt';

export class TraktProgressService {
  private base = 'https://api.trakt.tv';

  constructor(private apiKey: string) {
    if (!this.apiKey) {
      logger.error('Trakt API key not set in TraktProgressService constructor');
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
    const url = `${this.base}${path}`;
    const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
    const text = await res.text();

    if (!res.ok) {
      logger.error('TraktProgressService request failed', {
        url,
        status: res.status,
        body: text.slice(0, 1000),
      });
      throw new Error(`Trakt API returned ${res.status}`);
    }

    return JSON.parse(text) as T;
  }

  private async requestAuth<T>(path: string, accessToken: string, method = 'GET', body?: unknown): Promise<T> {
    const url = `${this.base}${path}`;
    const headers = this.getAuthHeaders(accessToken);
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();

    if (!res.ok) {
      logger.error('TraktProgressService authenticated request failed', {
        url,
        status: res.status,
        body: text.slice(0, 1000),
      });
      throw new Error(`Trakt API returned ${res.status}`);
    }

    return JSON.parse(text) as T;
  }

  async getShowProgress(accessToken: string, showId: number): Promise<TraktShowProgress> {
    return await this.requestAuth<TraktShowProgress>(`/shows/${showId}/progress/watched?hidden_seasons=true`, accessToken);
  }

  async getEpisodeDetails(episodeId: number): Promise<TraktEpisodeBase> {
    return await this.request<TraktEpisodeBase>(`/episodes/${episodeId}?extended=full,images`);
  }

  async getEpisodeCast(episodeId: number): Promise<TraktCastEntry[]> {
    const response = await this.request<TraktPeopleResponse>(`/episodes/${episodeId}/people?extended=full`);
    return response.cast ?? [];
  }

  async getShowCast(showId: number): Promise<TraktCastEntry[]> {
    const response = await this.request<TraktPeopleResponse>(`/shows/${showId}/people?extended=full`);
    return response.cast ?? [];
  }

  async removeHistoryEntry(accessToken: string, payload: unknown): Promise<any> {
    return await this.requestAuth<any>('/sync/history/remove', accessToken, 'POST', payload);
  }
}
