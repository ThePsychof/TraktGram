import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import logger from '../../utils/logger';

function getDateBucket(date: Date, today: Date): string {
  const delta = Math.floor((today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86_400_000);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta <= 7) return 'Last Week';
  return 'Older';
}

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

    const today = new Date();
    const groups: Record<string, string[]> = {};

    for (const it of items) {
      const date = it.watched_at ? new Date(it.watched_at) : null;
      const bucket = date ? getDateBucket(date, new Date()) : 'Unknown';
      const title = it.movie?.title ?? it.show?.title ?? it.title ?? 'Unknown';
      const time = date ? ` ${date.toISOString().slice(11, 16)}` : '';
      groups[bucket] = groups[bucket] || [];
      groups[bucket].push(`• ${title}${time}`);
    }

    const order = ['Today', 'Yesterday', 'Last Week', 'Older', 'Unknown'];
    const lines: string[] = ['📜 Watch History', ''];
    for (const section of order) {
      const entries = groups[section];
      if (!entries || entries.length === 0) continue;
      lines.push(`*${section}*`);
      lines.push(...entries.slice(0, 10));
      lines.push('');
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('history render error', err);
    await ctx.reply('Failed to load history');
  }
}
