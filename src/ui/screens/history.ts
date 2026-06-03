import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import logger from '../../utils/logger';

export async function renderHistory(ctx: Context, traktService: TraktService, oauthService: OAuthService, page = 1) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.');
    return;
  }

  try {
    const items = await traktService.getHistory(accessToken, '', page, 50);
    if (!items || items.length === 0) {
      await ctx.reply('No history items found.');
      return;
    }

    // Group by date
    const groups: Record<string, string[]> = {};
    for (const it of items) {
      const when = it.watched_at ? new Date(it.watched_at).toISOString().slice(0,10) : 'Unknown';
      const title = it.movie?.title ?? it.show?.title ?? it.title ?? 'Unknown';
      groups[when] = groups[when] || [];
      groups[when].push(`• ${title}`);
    }

    const lines: string[] = [];
    for (const [date, entries] of Object.entries(groups)) {
      lines.push(`${date}`);
      lines.push(...entries);
      lines.push('');
    }

    await ctx.reply(lines.join('\n'));
  } catch (err) {
    logger.error('history render error', err);
    await ctx.reply('Failed to load history');
  }
}
