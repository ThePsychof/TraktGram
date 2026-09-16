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

export interface UserStats {
  moviesWatched: number;
  episodesWatched: number;
  showsWatched: number;
  moviesCollected: number;
  episodesCollected: number;
  ratingsGiven: number;
  movieMinutes: number;
  episodeMinutes: number;
  totalMinutes: number;
  available: boolean;
}

const EMPTY_STATS: UserStats = {
  moviesWatched: 0,
  episodesWatched: 0,
  showsWatched: 0,
  moviesCollected: 0,
  episodesCollected: 0,
  ratingsGiven: 0,
  movieMinutes: 0,
  episodeMinutes: 0,
  totalMinutes: 0,
  available: false,
};

export class TraktService {
  private client: TraktClient;
  private cache = new SimpleCache();

  constructor(private apiKey: string) {
    this.client = new TraktClient(apiKey);
  }

  // ---------- Public (no auth) ----------

  async getTrendingMovies(limit = 5): Promise<TraktTrendingItem[]> {
    return await this.client.request<TraktTrendingItem[]>(`/movies/trending?limit=${limit}&extended=full,images`);
  }

  async getTrendingShows(limit = 5): Promise<any[]> {
    return await this.client.request<any[]>(`/shows/trending?limit=${limit}&extended=full,images`);
  }

  async getShowSeasons(showId: number): Promise<any[]> {
    return await this.client.request<any[]>(`/shows/${showId}/seasons?extended=full,images`);
  }

  async getSeasonEpisodes(showId: number, season: number): Promise<any[]> {
    return await this.client.request<any[]>(`/shows/${showId}/seasons/${season}?extended=full,images`);
  }

  async getEpisodeById(episodeId: number): Promise<any> {
    return await this.client.request<any>(`/episodes/${episodeId}?extended=full,images`);
  }

  async getEpisodeCast(episodeId: number): Promise<any[]> {
    const response = await this.client.request<any>(`/episodes/${episodeId}/people?extended=full`);
    return response.cast ?? [];
  }

  async getItemById(type: 'movie' | 'show', id: number): Promise<any> {
    return await this.client.request<any>(`/${type}s/${id}?extended=full,images`);
  }

  async getItemCast(type: 'movie' | 'show', id: number): Promise<TraktCastEntry[]> {
    const response = await this.client.request<TraktPeopleResponse>(`/${type}s/${id}/people?extended=full`);
    return response.cast ?? [];
  }

  // ---------- User-scoped (require access token) ----------

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

  async getCalendarShows(accessToken: string, days = 7): Promise<any[]> {
    return await this.client.requestAuth<any[]>(`/calendars/my/shows?days=${days}&extended=full,images`, accessToken);
  }

  async getCalendarMovies(accessToken: string, days = 7): Promise<any[]> {
    return await this.client.requestAuth<any[]>(`/calendars/my/movies?days=${days}&extended=full,images`, accessToken);
  }

  async getShowProgress(accessToken: string, showId: number): Promise<any> {
    return await this.client.requestAuth<any>(`/shows/${showId}/progress/watched?hidden_seasons=true`, accessToken);
  }

  async resetShowProgress(accessToken: string, showId: number): Promise<void> {
    await this.client.requestAuth<any>(`/shows/${showId}/progress/watched/reset`, accessToken, 'POST');
  }

  async getUserProfile(accessToken: string): Promise<any> {
    // /users/settings returns { user: {...}, account: {...} }
    // We unwrap and return just the user object.
    const payload = await this.client.requestAuth<any>(`/users/settings`, accessToken);
    const user = payload?.user ?? payload;
    logger.info('getUserProfile', {
      username: user?.username,
      hasAvatar: Boolean(user?.images?.avatar?.full),
    });
    return user;
  }

  /**
   * Fetch stats from Trakt's documented /users/me/stats endpoint.
   *
   * NOTE: As of September 2026, this endpoint is returning 204 No Content
   * for many users. This is a known bug on Trakt's side, confirmed by
   * multiple app developers (see: Infuse, Sept 14 2026). When the endpoint
   * returns empty, we return `available: false` so callers can show an
   * honest message instead of fake zeros.
   */
  async getUserStats(accessToken: string): Promise<UserStats> {
    let raw: any = null;
    try {
      raw = await this.client.requestAuth<any>(`/users/me/stats`, accessToken);
    } catch (err: any) {
      logger.warn('getUserStats request failed', { status: err?.status });
      return { ...EMPTY_STATS };
    }

    if (!raw || typeof raw !== 'object') {
      logger.warn('getUserStats returned empty (Trakt bug)');
      return { ...EMPTY_STATS };
    }

    const movieMinutes = raw?.movies?.minutes ?? 0;
    const episodeMinutes = raw?.episodes?.minutes ?? 0;

    return {
      moviesWatched: raw?.movies?.watched ?? 0,
      episodesWatched: raw?.episodes?.watched ?? 0,
      showsWatched: raw?.shows?.watched ?? 0,
      moviesCollected: raw?.movies?.collected ?? 0,
      episodesCollected: raw?.episodes?.collected ?? 0,
      ratingsGiven: raw?.ratings?.total ?? 0,
      movieMinutes,
      episodeMinutes,
      totalMinutes: movieMinutes + episodeMinutes,
      available: true,
    };
  }

  async getUserRating(
    accessToken: string,
    type: 'movie' | 'show' | 'episode',
    id: number,
  ): Promise<number | null> {
    try {
      const typePlural = type === 'movie' ? 'movies' : type === 'show' ? 'shows' : 'episodes';
      const itemKey = type === 'movie' ? 'movie' : type === 'show' ? 'show' : 'episode';
      const all = await this.client.requestAuth<any[]>(`/sync/ratings/${typePlural}`, accessToken);
      if (!Array.isArray(all)) return null;
      for (const entry of all) {
        if (entry?.[itemKey]?.ids?.trakt === id) {
          return typeof entry.rating === 'number' ? entry.rating : null;
        }
      }
      return null;
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return null;
      throw error;
    }
  }

  async getWatchlistStatus(
    accessToken: string,
    type: 'movie' | 'show',
    id: number,
  ): Promise<boolean> {
    try {
      const typePlural = type === 'movie' ? 'movies' : 'shows';
      const itemKey = type === 'movie' ? 'movie' : 'show';
      const all = await this.client.requestAuth<any[]>(`/sync/watchlist/${typePlural}`, accessToken);
      if (!Array.isArray(all)) return false;
      for (const entry of all) {
        if (entry?.[itemKey]?.ids?.trakt === id) return true;
      }
      return false;
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return false;
      throw error;
    }
  }

  async getWatchedSummary(
    accessToken: string,
    type: 'movie' | 'show',
    id: number,
  ): Promise<{ plays: number; last_watched_at: string | null } | null> {
    try {
      const typePlural = type === 'movie' ? 'movies' : 'shows';
      const history = await this.client.requestAuth<any[]>(`/sync/history/${typePlural}/${id}`, accessToken);
      if (!Array.isArray(history) || history.length === 0) return null;
      return {
        plays: history.length,
        last_watched_at: history[0]?.watched_at ?? null,
      };
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return null;
      throw error;
    }
  }

  async getEpisodeHistory(accessToken: string, episodeId: number): Promise<any[]> {
    try {
      return await this.client.requestAuth<any[]>(`/sync/history/episodes/${episodeId}`, accessToken);
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).status === 404) return [];
      throw error;
    }
  }

  // ---------- Backwards-compat wrappers around getUserStats ----------

  async getTotalWatchTime(
    accessToken: string,
  ): Promise<{ movies: number; episodes: number; total: number }> {
    const s = await this.getUserStats(accessToken);
    return { movies: s.movieMinutes, episodes: s.episodeMinutes, total: s.totalMinutes };
  }

  async getComputedStats(accessToken: string): Promise<{
    moviesWatched: number;
    episodesWatched: number;
    totalPlays: number;
    ratingsGiven: number;
    available: boolean;
  }> {
    const s = await this.getUserStats(accessToken);
    return {
      moviesWatched: s.moviesWatched,
      episodesWatched: s.episodesWatched,
      totalPlays: s.moviesWatched + s.episodesWatched,
      ratingsGiven: s.ratingsGiven,
      available: s.available,
    };
  }

  // ---------- Cast helpers ----------

  private getItemPath(ids: TraktIds | undefined): string | null {
    if (!ids) return null;
    if (typeof ids.trakt === 'number') return String(ids.trakt);
    if (typeof ids.slug === 'string' && ids.slug.length > 0) return encodeURIComponent(ids.slug);
    return null;
  }

  private async getPeople(type: 'movie' | 'show', ids: TraktIds | undefined): Promise<TraktCastEntry[]> {
    const itemId = this.getItemPath(ids);
    if (!itemId) return [];
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

  // ---------- Search ----------

  private async searchEndpoint(
    type: 'movie' | 'show',
    query: string,
    limit: number,
  ): Promise<TraktSearchItem[]> {
    const encoded = encodeURIComponent(query);
    return await this.client.request<TraktSearchItem[]>(
      `/search/${type}?query=${encoded}&limit=${limit}&extended=full,images`,
    );
  }

  async searchMulti(query: string, limit = 10): Promise<TraktSearchItem[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const cacheKey = `trakt:search:${normalizedQuery}:${limit}`;
    const cached = this.cache.get<TraktSearchItem[]>(cacheKey);
    if (cached) return cached;

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