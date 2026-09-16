import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import logger from '../../utils/logger';
import { encodeCallback } from '../../utils/callbackData';

export async function renderSeasons(
  ctx: Context,
  traktService: TraktService,
  oauthService: OAuthService | undefined,
  showId: number,
): Promise<void> {
  try {
    const [show, seasons] = await Promise.all([
      traktService.getItemById('show', showId),
      traktService.getShowSeasons(showId),
    ]);

    const showTitle = show?.title ?? show?.name ?? 'Show';

    let progressBySeason = new Map<number, { completed: number; aired: number }>();
    if (ctx.from && oauthService) {
      const token = await oauthService.getValidAccessToken(ctx.from.id);
      if (token) {
        try {
          const progress = await traktService.getShowProgress(token, showId);
          for (const s of progress?.seasons ?? []) {
            progressBySeason.set(s.number, {
              completed: s.completed ?? 0,
              aired: s.aired ?? 0,
            });
          }
        } catch (err) {
          logger.warn('Failed to fetch show progress', err);
        }
      }
    }

    const realSeasons = (seasons ?? []).filter((s: any) => s.number !== 0);
    if (realSeasons.length === 0) {
      await ctx.reply('No seasons found for this show.');
      return;
    }

    const rows: any[] = [];
    for (const s of realSeasons) {
      const num = s.number as number;
      const count = s.episode_count ?? s.aired_episodes ?? 0;
      const prog = progressBySeason.get(num);
      const right = prog
        ? `${prog.completed}/${prog.aired} ✅`
        : `${count} eps`;
      rows.push([
        { text: `Season ${num}`, callback_data: encodeCallback('season', { id: showId, s: num }) },
        { text: right, callback_data: encodeCallback('season', { id: showId, s: num }) },
      ]);
    }
    rows.push([
      { text: '⬅️ Show', callback_data: encodeCallback('details', { t: 'show', id: showId }) },
      { text: '🏠 Home', callback_data: encodeCallback('home') },
    ]);

    const { respondWith } = await import('../navigate');
    await respondWith(ctx, {
      text: `📺 <b>${showTitle}</b>\n\nSelect a season:`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    });
  } catch (err) {
    logger.error('renderSeasons error', err);
    await ctx.reply('Failed to load seasons.');
  }
}