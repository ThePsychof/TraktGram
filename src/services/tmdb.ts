import { SimpleCache } from '../utils/cache';
import type { TmdbDetails } from '../types/tmdb';
import type { TraktIds } from '../types/trakt';
import logger from '../utils/logger';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export class TmdbService {
  private cache = new SimpleCache();

  constructor(private apiKey: string | undefined) {
    if (!this.apiKey) {
      logger.warn('TMDb API key is not configured. Poster lookups will be limited.');
    }
  }

  private getHeaders() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'TraktGram/1.0',
    } as Record<string, string>;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const cacheKey = `tmdb:${url}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.apiKey) {
      throw new Error('TMDb API key not configured');
    }

    const urlWithKey = url.includes('?') ? `${url}&api_key=${this.apiKey}` : `${url}?api_key=${this.apiKey}`;
    logger.info('Fetching TMDb URL', { url: urlWithKey });

    const res = await fetch(urlWithKey, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn('TMDb request failed', { status: res.status, body });
      throw new Error(`TMDb ${res.status}`);
    }

    const json = await res.json() as T;
    this.cache.set(cacheKey, json, 60 * 60);
    return json;
  }

  private async findDetailsByTmdbId(id: number, type: 'movie' | 'show'): Promise<TmdbDetails | null> {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const url = `${BASE_URL}/${endpoint}/${id}?append_to_response=credits`; 

    try {
      return await this.fetchJson<TmdbDetails>(url);
    } catch (error) {
      logger.warn('TMDb details fetch failed', error);
      return null;
    }
  }

  private async findDetailsByExternalId(externalId: string, source: 'imdb_id' | 'tvdb_id', type: 'movie' | 'show'): Promise<TmdbDetails | null> {
    const url = `${BASE_URL}/find/${encodeURIComponent(externalId)}?external_source=${source}`;

    try {
      const response = await this.fetchJson<Record<string, unknown>>(url);
      const results = type === 'movie' ? response.movie_results as Array<Record<string, unknown>> : response.tv_results as Array<Record<string, unknown>>;
      const details = Array.isArray(results) && results.length > 0 ? results[0] : null;
      if (!details || typeof details.id !== 'number') {
        return null;
      }
      return this.findDetailsByTmdbId(details.id, type);
    } catch (error) {
      logger.warn('TMDb external lookup failed', error);
      return null;
    }
  }

  async findDetailsByTraktIds(ids: TraktIds | undefined, type: 'movie' | 'show'): Promise<TmdbDetails | null> {
    const cacheKey = `tmdb-trakt:${type}:${JSON.stringify(ids ?? {})}`;
    const cached = this.cache.get<TmdbDetails | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let details: TmdbDetails | null = null;
    const tmdbId = ids && typeof ids.tmdb === 'number' ? ids.tmdb : ids && typeof ids.tmdb === 'string' ? Number(ids.tmdb) : undefined;
    const imdbId = ids && typeof ids.imdb === 'string' ? ids.imdb : undefined;
    const tvdbId = ids && typeof ids.tvdb === 'string' ? ids.tvdb : undefined;

    if (tmdbId && Number.isFinite(tmdbId)) {
      details = await this.findDetailsByTmdbId(tmdbId, type);
    }

    if (!details && imdbId) {
      details = await this.findDetailsByExternalId(imdbId, 'imdb_id', type);
    }

    if (!details && type === 'show' && tvdbId) {
      details = await this.findDetailsByExternalId(tvdbId, 'tvdb_id', type);
    }

    this.cache.set(cacheKey, details, 60 * 10);
    return details;
  }

  async getPosterUrlForTraktItem(ids: TraktIds | undefined, type: 'movie' | 'show'): Promise<string | undefined> {
    try {
      const details = await this.findDetailsByTraktIds(ids, type);
      const path = details?.poster_path ?? details?.backdrop_path;
      if (!path) {
        return undefined;
      }
      return this.buildImageUrl(path, 'w500');
    } catch (error) {
      logger.warn('Unable to resolve poster URL', error);
      return undefined;
    }
  }

  buildImageUrl(path: string, size = 'w500'): string {
    return `${IMAGE_BASE}/${size}${path}`;
  }
}
