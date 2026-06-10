import type { TraktService } from '../services/trakt';
import type { OAuthService } from '../services/oauth';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function parseTelegramId(request: Request, url: URL): number | null {
  const headerValue = request.headers.get('x-telegram-user-id');
  if (headerValue) {
    const parsed = Number(headerValue);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  const queryValue = url.searchParams.get('telegramId') ?? url.searchParams.get('telegram_id');
  if (queryValue) {
    const parsed = Number(queryValue);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

async function requireAccessToken(
  telegramId: number,
  oauthService: OAuthService
): Promise<string | Response> {
  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    return jsonError('Authentication required. Connect via /login or the Mini App.', 401);
  }
  return accessToken;
}

export async function handleMiniAppApiRequest(
  request: Request,
  url: URL,
  traktService: TraktService,
  oauthService?: OAuthService
): Promise<Response | null> {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'api' || segments[1] !== 'miniapp') {
    return null;
  }

  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  const scope = segments[2];
  if (scope === 'public') {
    const target = segments[3] ?? '';

    if (target === 'trending') {
      const limit = Number(url.searchParams.get('limit') ?? '8');
      const items = await traktService.getTrendingMovies(limit);
      return jsonResponse({ items });
    }

    if (target === 'search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query) {
        return jsonError('Query parameter q is required.', 400);
      }
      const limit = Number(url.searchParams.get('limit') ?? '20');
      const items = await traktService.searchMulti(query, limit);
      return jsonResponse({ query, items });
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

  if (scope === 'user') {
    if (!oauthService) {
      return jsonError('OAuth not configured on backend.', 500);
    }

    const telegramId = parseTelegramId(request, url);
    if (!telegramId) {
      return jsonError('telegramId is required in header x-telegram-user-id or query.', 400);
    }

    const accessTokenOrResponse = await requireAccessToken(telegramId, oauthService);
    if (accessTokenOrResponse instanceof Response) {
      return accessTokenOrResponse;
    }
    const accessToken = accessTokenOrResponse;
    const target = segments[3] ?? '';

    if (target === 'continue') {
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const items = await traktService.getContinueWatching(accessToken, limit);
      return jsonResponse({ items });
    }

    if (target === 'watchlist') {
      const type = url.searchParams.get('type') ?? 'all';
      const page = Number(url.searchParams.get('page') ?? '1');
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const items = await traktService.getWatchlist(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    if (target === 'history') {
      const type = url.searchParams.get('type') ?? '';
      const page = Number(url.searchParams.get('page') ?? '1');
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const items = await traktService.getHistory(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    if (target === 'recommendations') {
      const type = url.searchParams.get('type') ?? 'movies';
      const page = Number(url.searchParams.get('page') ?? '1');
      const limit = Number(url.searchParams.get('limit') ?? '20');
      const items = await traktService.getRecommendations(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    if (target === 'calendar') {
      const days = Number(url.searchParams.get('days') ?? '7');
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
      const type = url.searchParams.get('type') ?? 'all';
      const page = Number(url.searchParams.get('page') ?? '1');
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const items = await traktService.getCollection(accessToken, type, page, limit);
      return jsonResponse({ items, type, page, limit });
    }

    return jsonError('User mini app route not found.', 404);
  }

  return jsonError('Mini App route not found.', 404);
}
