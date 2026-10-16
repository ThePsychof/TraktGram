import type { TraktService } from '../services/trakt';
import type { OAuthService } from '../services/oauth';

export interface MiniAppApiResponse {
  status: number;
  body: unknown;
}

export interface MiniAppApiInput {
  path: string;
  query?: Record<string, string>;
  method?: string;
  telegramId: number;
}

function jsonResponse(body: unknown, status = 200): MiniAppApiResponse {
  return { status, body };
}

function jsonError(message: string, status = 400): MiniAppApiResponse {
  return jsonResponse({ error: message }, status);
}

function parsePathAndQuery(input: MiniAppApiInput): { pathname: string; query: Map<string, string> } {
  const [pathWithoutHash] = input.path.split('#', 1);
  const [pathname, search = ''] = pathWithoutHash.split('?', 2);
  const query = new Map<string, string>();

  for (const pair of search.split('&')) {
    if (!pair) continue;
    const [rawKey, rawValue = ''] = pair.split('=', 2);
    const decode = (value: string) => {
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        return value;
      }
    };
    query.set(decode(rawKey), decode(rawValue));
  }

  for (const [key, value] of Object.entries(input.query ?? {})) query.set(key, value);
  return { pathname, query };
}

async function requireAccessToken(
  telegramId: number,
  oauthService: OAuthService,
): Promise<string | MiniAppApiResponse> {
  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    return jsonError('Authentication required. Connect via /login or the Mini App.', 401);
  }
  return accessToken;
}

export async function handleMiniAppApiRequest(
  input: MiniAppApiInput,
  traktService: TraktService,
  oauthService?: OAuthService,
): Promise<MiniAppApiResponse | null> {
  const { pathname, query } = parsePathAndQuery(input);
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'api' || segments[1] !== 'miniapp') {
    return null;
  }

  if (input.method && input.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  // ---- /api/miniapp/me ----
  if (segments[2] === 'me') {
    if (!oauthService) {
      return jsonError('OAuth not configured on backend.', 500);
    }

    const telegramId = input.telegramId;

    const accessToken = await oauthService.getValidAccessToken(telegramId);
    if (!accessToken) {
      return jsonError('Not connected. Use /login first.', 401);
    }

    try {
      const [profile, stats, history] = await Promise.all([
        traktService.getUserProfile(accessToken).catch(() => null),
        traktService.getUserStats(accessToken),
        traktService.getHistory(accessToken, '', 1, 5).catch(() => []),
      ]);

      const oauthData = await oauthService.getAuthenticatedUser(telegramId);
      const rawAvatarUrl =
        oauthData?.avatarUrl ??
        profile?.images?.avatar?.full ??
        profile?.images?.avatar ??
        (typeof profile?.images?.avatar === 'string' ? profile.images.avatar : undefined);

      // Proxy through our own origin so Telegram's WebView will load it.
      const avatarUrl = rawAvatarUrl ?? null;

      const recentHistory = (history ?? []).map((entry: any) => {
        const kind = entry.type;
        let title = 'Unknown';
        if (kind === 'movie' && entry.movie) {
          title = `${entry.movie.title ?? 'Unknown'}${entry.movie.year ? ` (${entry.movie.year})` : ''}`;
        } else if (kind === 'episode' && entry.episode) {
          const s = entry.episode.season ?? 0;
          const n = entry.episode.number ?? 0;
          const show = entry.show?.title ?? entry.show?.name ?? 'Unknown';
          title = `${show} S${String(s).padStart(2, '0')}E${String(n).padStart(2, '0')}`;
        }
        return {
          title,
          watchedAt: entry.watched_at ?? null,
        };
      });

      return jsonResponse({
        profile: {
          username: profile?.username ?? null,
          name: profile?.name ?? profile?.username ?? null,
          avatar: avatarUrl ?? null,
        },
        watchTime: {
          movies: stats.movieMinutes,
          episodes: stats.episodeMinutes,
          total: stats.totalMinutes,
        },
        stats: {
          moviesWatched: stats.moviesWatched,
          episodesWatched: stats.episodesWatched,
          totalPlays: stats.moviesWatched + stats.episodesWatched,
          ratingsGiven: stats.ratingsGiven,
          available: stats.available,
        },
        recentHistory,
      });
    } catch (err) {
      return jsonError('Failed to load profile data.', 500);
    }
  }

  // ---- /api/miniapp/public/* ----
  const scope = segments[2];
  if (scope === 'public') {
    const target = segments[3] ?? '';

    if (target === 'trending') {
      const limit = Number(query.get('limit') ?? '8');
      const items = await traktService.getTrendingMovies(limit);
      return jsonResponse({ items });
    }

    if (target === 'search') {
      const searchQuery = query.get('q')?.trim();
      if (!searchQuery) {
        return jsonError('Query parameter q is required.', 400);
      }
      const limit = Number(query.get('limit') ?? '20');
      const items = await traktService.searchMulti(searchQuery, limit);
      return jsonResponse({ query: searchQuery, items });
    }

    if (target === 'item') {
      const type = segments[4] as 'movie' | 'show' | 'episode';
      const id = Number(segments[5]);
      if (!type || !id || Number.isNaN(id)) {
        return jsonError('Invalid item route. Use /api/miniapp/public/item/{movie|show}/{id}.', 400);
      }
      if (type === 'episode') {
        const item = await traktService.getEpisodeById(id);
        return jsonResponse({ item });
      }
      const item = await traktService.getItemById(type, id);
      return jsonResponse({ item });
    }

    return jsonError('Public mini app route not found.', 404);
  }

  // ---- /api/miniapp/user/* ----
  if (scope === 'user') {
    if (!oauthService) {
      return jsonError('OAuth not configured on backend.', 500);
    }

    const telegramId = input.telegramId;

    const accessTokenOrResponse = await requireAccessToken(telegramId, oauthService);
    if (typeof accessTokenOrResponse !== 'string') {
      return accessTokenOrResponse;
    }
    const accessToken = accessTokenOrResponse;
    const target = segments[3] ?? '';

    if (target === 'continue') {
      const limit = Number(query.get('limit') ?? '50');
      const items = await traktService.getContinueWatching(accessToken, limit);
      return jsonResponse({ items });
    }

    if (target === 'watchlist') {
      const type = query.get('type') ?? 'all';
      const page = Number(query.get('page') ?? '1');
      const limit = Number(query.get('limit') ?? '50');
      const items = await traktService.getWatchlist(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    if (target === 'history') {
      const type = query.get('type') ?? '';
      const page = Number(query.get('page') ?? '1');
      const limit = Number(query.get('limit') ?? '50');
      const items = await traktService.getHistory(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    if (target === 'recommendations') {
      const type = query.get('type') ?? 'movies';
      const page = Number(query.get('page') ?? '1');
      const limit = Number(query.get('limit') ?? '20');
      const items = await traktService.getRecommendations(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    if (target === 'calendar') {
      const days = Number(query.get('days') ?? '7');
      const [shows, movies] = await Promise.all([
        traktService.getCalendarShows(accessToken, days),
        traktService.getCalendarMovies(accessToken, days),
      ]);
      return jsonResponse({ days, shows, movies });
    }

    if (target === 'profile') {
      const oauthData = await oauthService.getAuthenticatedUser(telegramId);
      if (!oauthData) {
        return jsonError('No connected Trakt account found for this user.', 404);
      }
      const stats = await traktService.getUserStats(accessToken);
      const profile = {
        username: oauthData.username,
        userId: oauthData.userId,
        connectedAt: oauthData.createdAt,
        stats,
      };
      return jsonResponse({ profile });
    }

    if (target === 'collection') {
      const type = query.get('type') ?? 'all';
      const page = Number(query.get('page') ?? '1');
      const limit = Number(query.get('limit') ?? '50');
      const items = await traktService.getCollection(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    return jsonError('User mini app route not found.', 404);
  }

  return jsonError('Mini App route not found.', 404);
}