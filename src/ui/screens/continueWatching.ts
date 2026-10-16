import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions, buildNavKeyboard } from '../menus';
import logger from '../../utils/logger';
import { encodeCallback } from '../../utils/callbackData';
import { extractPoster } from '../../utils/images';

export async function renderContinueWatching(ctx: Context, traktService: TraktService, oauthService: OAuthService, page = 1) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.', { reply_markup: { inline_keyboard: [[{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }], [{ text: '🏠 Home', callback_data: encodeCallback('home') }]] } });
    return;
  }

  try {
    const found = await traktService.getContinueAt(accessToken, Math.max(0, page - 1));
    if (!found) {
      await ctx.reply('No more items to continue watching.');
      return;
    }
    const { item, index: idx, total } = found;
    page = idx + 1;

    const title = item.show?.title ?? item.movie?.title ?? item.title ?? 'Unknown';
    const episode = item.episode;
    const subtitle = episode ? `S${episode.season}E${episode.number}${episode.title ? ` - ${episode.title}` : ''}` : '';

    const poster = extractPoster(item) ?? undefined;

    const prog = item.progress?.aired ? `\n${item.progress.completed}/${item.progress.aired} episodes watched` : '';
    const caption = `📺 ${title}${subtitle ? `\nNext: ${subtitle}` : ''}${prog}\n\n${idx + 1}/${total}`;

    // Build actions with item-specific ids
    const itemType = item.movie ? 'movie' : item.show ? 'show' : item.type ?? '';
    const itemId = (item.movie?.ids?.trakt ?? item.show?.ids?.trakt ?? item.ids?.trakt) as number | undefined;
    const actions = buildItemActions({ type: itemType, id: itemId });

    const extraParams: Record<string, string | number> = { t: itemType };
    if (itemId !== undefined) {
      extraParams.id = itemId;
    }
    const nav = buildNavKeyboard('continue', page, idx > 0, idx < total - 1, extraParams);

    if (poster) {
      await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] } });
    } else {
      await ctx.reply(caption, { reply_markup: { inline_keyboard: [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] } });
    }
  } catch (error) {
    logger.error('Error rendering Continue Watching', error);
    await ctx.reply('Failed to load Continue Watching. Try again later.');
  }
}

export async function renderContinueList(
  ctx: Context,
  traktService: TraktService,
  oauthService: OAuthService,
  edit = false,
) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.', {
      reply_markup: { inline_keyboard: [[{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }]] },
    });
    return;
  }

  try {
    const candidates = (await traktService.getContinueCandidates(accessToken)).slice(0, 15);
    const allProgress = await Promise.all(
      candidates.map((w) => traktService.getContinueProgress(accessToken, w.show.ids.trakt)),
    );
    const shows: any[] = [];
    const progresses: any[] = [];
    candidates.forEach((w, i) => {
      if (allProgress[i]?.next_episode && shows.length < 10) {
        shows.push(w);
        progresses.push(allProgress[i]);
      }
    });
    if (shows.length === 0) {
      await ctx.reply('No unfinished shows found.');
      return;
    }

    const rows: any[] = [];
    shows.forEach((w, i) => {
      const next = progresses[i]?.next_episode;
      const year = w.show?.year ? ` (${w.show.year})` : '';
      const row: any[] = [{
        text: `📺 ${String(w.show?.title ?? 'Unknown').slice(0, 28)}${year}`,
        callback_data: encodeCallback('next_ep', { id: w.show.ids.trakt }),
      }];
      if (next?.ids?.trakt) {
        const s = String(next.season ?? 0).padStart(2, '0');
        const e = String(next.number ?? 0).padStart(2, '0');
        row.push({
          text: `✅ S${s}E${e}`,
          callback_data: encodeCallback('cw_watched', { e: next.ids.trakt, id: w.show.ids.trakt }),
        });
      }
      rows.push(row);
    });
    rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);

    const text = '▶️ Continue Watching\n\nTap a show for its next episode, or ✅ to mark it watched:';
    if (edit) {
      try {
        await ctx.editMessageText(text, { reply_markup: { inline_keyboard: rows } });
        return;
      } catch {
        // fall through to a new message
      }
    }
    await ctx.reply(text, { reply_markup: { inline_keyboard: rows } });
  } catch (error) {
    logger.error('Error rendering Continue list', error);
    await ctx.reply('Failed to load your recent shows. Try again later.');
  }
}