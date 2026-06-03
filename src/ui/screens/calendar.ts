import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { encodeCallback } from '../../utils/callbackData';
import logger from '../../utils/logger';

function getLabelForDate(date: Date, today: Date) {
  const diff = Math.floor((date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7) return 'This Week';
  return 'Upcoming';
}

function formatCalendarItem(item: any) {
  if (item.episode && item.show) {
    const episode = item.episode;
    const show = item.show;
    const season = episode.season ?? '?';
    const number = episode.number ?? '?';
    const title = episode.title ?? 'Episode';
    return `📺 ${show.title || show.name || 'Unknown'} S${season}E${number}: ${title}`;
  }

  if (item.movie) {
    const movie = item.movie;
    return `🎬 ${movie.title || movie.name || 'Unknown'} (${movie.year ?? 'TBD'})`;
  }

  return 'Unknown item';
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toISOString().slice(0, 10);
}

export async function renderCalendar(ctx: Context, traktService: TraktService, oauthService: OAuthService) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }],
          [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
        ],
      },
    });
    return;
  }

  try {
    const [shows, movies] = await Promise.all([
      traktService.getCalendarShows(accessToken, 7),
      traktService.getCalendarMovies(accessToken, 7),
    ]);

    const items = [
      ...(shows || []).map((show: any) => ({
        date: show.first_aired ?? show.episode?.first_aired ?? '',
        text: formatCalendarItem(show),
      })),
      ...(movies || []).map((movie: any) => ({
        date: movie.released ?? movie.movie?.release_date ?? '',
        text: formatCalendarItem(movie),
      })),
    ];

    if (items.length === 0) {
      await ctx.reply('No upcoming items found in your Trakt calendar for the next 7 days.', {
        reply_markup: { inline_keyboard: [[{ text: '🏠 Home', callback_data: encodeCallback('home') }]] },
      });
      return;
    }

    const today = new Date();
    const grouped: Record<string, string[]> = {};
    for (const item of items) {
      const dateLabel = item.date ? getLabelForDate(new Date(item.date), new Date()) : 'Upcoming';
      grouped[dateLabel] = grouped[dateLabel] || [];
      grouped[dateLabel].push(`• ${formatDate(item.date)} — ${item.text}`);
    }

    const lines: string[] = ['📅 Trakt Calendar', ''];
    for (const label of ['Today', 'Tomorrow', 'This Week', 'Upcoming']) {
      if (!grouped[label]) continue;
      lines.push(`*${label}*`);
      lines.push(...grouped[label].slice(0, 6));
      lines.push('');
    }

    const message = lines.slice(0, 60).join('\n');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
        ],
      },
    });
  } catch (err) {
    logger.error('calendar render error', err);
    await ctx.reply('Failed to load Calendar. Try again later.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 Home', callback_data: encodeCallback('home') }]] },
    });
  }
}
