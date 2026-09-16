import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import logger from '../../utils/logger';
import { encodeCallback } from '../../utils/callbackData';

export async function renderEpisodes(
  ctx: Context,
  traktService: TraktService,
  oauthService: OAuthService | undefined,
  showId: number,
  seasonNumber: number,
): Promise<void> {
  try {
    const [show, episodes] = await Promise.all([
      traktService.getItemById('show', showId),
      traktService.getSeasonEpisodes(showId, seasonNumber),
    ]);

    const showTitle = show?.title ?? show?.name ?? 'Show';

    let watchedByEpisode = new Map<number, boolean>();
    let nextEpNumber: number | null = null;

    if (ctx.from && oauthService) {
      const token = await oauthService.getValidAccessToken(ctx.from.id);
      if (token) {
        try {
          const progress = await traktService.getShowProgress(token, showId);
          for (const s of progress?.seasons ?? []) {
            if (s.number !== seasonNumber) continue;
            for (const ep of s.episodes ?? []) {
              if (typeof ep.number === 'number') {
                watchedByEpisode.set(ep.number, !!ep.completed);
              }
            }
          }
          const nextEp = progress?.next_episode;
          if (nextEp && nextEp.season === seasonNumber && typeof nextEp.number === 'number') {
            nextEpNumber = nextEp.number;
          }
        } catch (err) {
          logger.warn('Failed to fetch progress for episodes', err);
        }
      }
    }

    if (!episodes || episodes.length === 0) {
      await ctx.reply(`No episodes found for Season ${seasonNumber}.`);
      return;
    }

    const rows: any[] = [];
    for (const ep of episodes) {
      const epNum = ep.number as number;
      if (typeof epNum !== 'number') continue;
      const title = (ep.title ?? `Episode ${epNum}`).slice(0, 32);
      const watched = watchedByEpisode.get(epNum) === true;
      const isNext = nextEpNumber === epNum;
      const left = `E${String(epNum).padStart(2, '0')}`;
      const right = `${title}${watched ? ' ✅' : isNext ? ' ▶' : ''}`;
      rows.push([
        { text: left, callback_data: encodeCallback('details', { t: 'episode', id: ep.ids?.trakt, from: 'season', sid: showId, sn: seasonNumber }) },
        { text: right, callback_data: encodeCallback('details', { t: 'episode', id: ep.ids?.trakt, from: 'season', sid: showId, sn: seasonNumber }) },
      ]);
    }
    rows.push([
      { text: '⬅️ Seasons', callback_data: encodeCallback('seasons', { id: showId }) },
      { text: '🏠 Home', callback_data: encodeCallback('home') },
    ]);

    const { respondWith } = await import('../navigate');
    await respondWith(ctx, {
      text: `📺 <b>${showTitle}</b>\nSeason ${seasonNumber}\n\nSelect an episode:`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    });
  } catch (err) {
    logger.error('renderEpisodes error', err);
    await ctx.reply('Failed to load episodes.');
  }
}