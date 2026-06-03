import logger from '../utils/logger';
import { TraktClient } from './traktClient';
import { SimpleCache } from '../utils/cache';
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
  private client: TraktClient;
  private cache = new SimpleCache();

  constructor(private apiKey: string) {
    this.client = new TraktClient(apiKey);
  }

  async getTrendingMovies(limit = 5): Promise<TraktTrendingItem[]> {
    return await this.client.request<TraktTrendingItem[]>(`/movies/trending?limit=${limit}&extended=full,images`);
  }

  /*
    User-scoped endpoints (require OAuth access token)
  */

  async getWatchlist(accessToken: string, type = 'all', page = 1, limit = 10): Promise<any[]> {
  const qType = type === 'all' ? '' : `/${encodeURIComponent(type)}`;
    const path = `/sync/watchlist${qType}?page=${page}&limit=${limit}&extended=full,images`;
    return await this.client.requestAuth<any[]>(path, accessToken);
  }

  async getHistory(accessToken: string, type = '', page = 1, limit = 20): Promise<any[]> {
    const qType = type ? `/${encodeURIComponent(type)}` : '';
    const path = `/sync/history${qType}?page=${page}&limit=${limit}&extended=full,images`;
    return await this.client.requestAuth<any[]>(path, accessToken);
  }

  async getPlaybackEpisodes(accessToken: string): Promise<any[]> {
    return await this.client.requestAuth<any[]>(`/sync/playback/episodes?extended=full,images`, accessToken);
  }

  async getPlaybackMovies(accessToken: string): Promise<any[]> {
    return await this.client.requestAuth<any[]>(`/sync/playback/movies?extended=full,images`, accessToken);
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
    return await this.client.requestAuth<any>(`/sync/history`, accessToken, 'POST', payload);
  }

  async createCheckin(accessToken: string, payload: any): Promise<any> {
    return await this.client.requestAuth<any>(`/checkin`, accessToken, 'POST', payload);
  }

  async rateItem(accessToken: string, payload: any): Promise<any> {
    return await this.client.requestAuth<any>(`/sync/ratings`, accessToken, 'POST', payload);
  }

  async addToWatchlist(accessToken: string, payload: any): Promise<any> {
    return await this.client.requestAuth<any>(`/sync/watchlist`, accessToken, 'POST', payload);
  }

  async removeFromWatchlist(accessToken: string, payload: any): Promise<any> {
    return await this.client.requestAuth<any>(`/sync/watchlist/remove`, accessToken, 'POST', payload);
  }

  async getRecommendations(accessToken: string, type = 'movies', page = 1, limit = 10): Promise<any[]> {
    const path = `/recommendations/${encodeURIComponent(type)}?page=${page}&limit=${limit}&extended=full,images`;
    return await this.client.requestAuth<any[]>(path, accessToken);
  }

  async getCollection(accessToken: string, type = 'all', page = 1, limit = 10): Promise<any[]> {
    const qType = type === 'all' ? '' : `/${encodeURIComponent(type)}`;
    const path = `/sync/collection${qType}?page=${page}&limit=${limit}&extended=full,images`;
    return await this.client.requestAuth<any[]>(path, accessToken);
  }

  async getCollectionStatus(accessToken: string, type: 'movie' | 'show', id: number): Promise<boolean> {
    try {
      await this.client.requestAuth<any>(`/sync/collection/${type}/${id}`, accessToken);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return false;
      throw error;
    }
  }

  async getCalendarShows(accessToken: string, days = 7): Promise<any[]> {
    return await this.client.requestAuth<any[]>(`/calendars/my/shows?days=${days}&extended=full,images`, accessToken);
  }

  async getCalendarMovies(accessToken: string, days = 7): Promise<any[]> {
    return await this.client.requestAuth<any[]>(`/calendars/my/movies?days=${days}&extended=full,images`, accessToken);
  }

  async getShowProgress(accessToken: string, showId: number): Promise<any> {
    return await this.client.requestAuth<any>(`/shows/${showId}/progress/watched?hidden_seasons=true`, accessToken);
  }

  async getEpisodeById(episodeId: number): Promise<any> {
    return await this.client.request<any>(`/episodes/${episodeId}?extended=full,images`);
  }

  async getEpisodeCast(episodeId: number): Promise<any[]> {
    const response = await this.client.request<any>(`/episodes/${episodeId}/people?extended=full`);
    return response.cast ?? [];
  }

  async getUserStats(accessToken: string): Promise<any> {
    return await this.client.requestAuth<any>(`/users/me/stats`, accessToken);
  }

  async getItemById(type: 'movie' | 'show', id: number): Promise<any> {
    return await this.client.request<any>(`/${type}s/${id}?extended=full,images`);
  }

  async getUserRating(accessToken: string, type: 'movie' | 'show', id: number): Promise<number | null> {
    try {
      const response = await this.client.requestAuth<any>(`/sync/ratings/${type}/${id}`, accessToken);
      return response.rating ?? null;
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return null;
      throw error;
    }
  }

  async getWatchlistStatus(accessToken: string, type: 'movie' | 'show', id: number): Promise<boolean> {
    try {
      await this.client.requestAuth<any>(`/sync/watchlist/${type}/${id}`, accessToken);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return false;
      throw error;
    }
  }

  async getWatchedSummary(accessToken: string, type: 'movie' | 'show', id: number): Promise<any | null> {
    try {
      return await this.client.requestAuth<any>(`/sync/watched/${type}s/${id}`, accessToken);
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return null;
      throw error;
    }
  }

  async getItemCast(type: 'movie' | 'show', id: number): Promise<TraktCastEntry[]> {
    const response = await this.client.request<TraktPeopleResponse>(`/${type}s/${id}/people?extended=full`);
    return response.cast ?? [];
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

    const response = await this.client.request<TraktPeopleResponse>(`/${type}s/${itemId}/people?extended=full`);
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
    return await this.client.request<TraktSearchItem[]>(`/search/${type}?query=${encoded}&limit=${limit}&extended=full,images`);
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
