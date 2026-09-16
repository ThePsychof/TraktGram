import { Bot } from 'grammy';
import { registerStart } from './commands/start';
import { registerPing } from './commands/ping';
import { registerHelp } from './commands/help';
import { registerTrending } from './commands/trending';
import { registerLogin } from './commands/login';
import { registerMe } from './commands/me';
import { registerInlineQuery } from './handlers/inline';
import type { TraktService } from './services/trakt';
import type { OAuthService } from './services/oauth';
import logger from './utils/logger';
import { registerStats } from './commands/stats';
import { registerRandom } from './commands/random';
import { parseWatchTimeInput } from './utils/dateParser';
import { registerHistory } from './commands/history';

export async function createBot(
  token: string,
  traktService: TraktService | null,
  oauthService?: OAuthService,
) {
  const bot = new Bot(token);

  registerPing(bot);
  registerHelp(bot);

  if (traktService) {
    registerStart(bot, traktService, oauthService);
    registerTrending(bot, traktService);
    registerInlineQuery(bot, traktService);
  } else {
    logger.warn('TraktService not configured — /start, /trending, and inline mode disabled');
  }

  if (oauthService) {
    registerLogin(bot, oauthService);
    registerMe(bot, oauthService, traktService ?? undefined);
    if (traktService) {
      registerStats(bot, traktService, oauthService);
      registerRandom(bot, traktService, oauthService);
      registerHistory(bot, traktService, oauthService);
    }
  } else {
    logger.warn('OAuthService not configured — /login, /me, /stats, /random, /history disabled');
  }

  if (traktService) {
    try {
      const { registerCallbackHandlers } = await import('./handlers/callbacks');
      registerCallbackHandlers(bot, traktService, oauthService);
    } catch (err) {
      logger.error('Failed to register callback handlers', err);
    }
  }

  // Handle text replies for "Add Another Time" (pending watch time flow)
  if (oauthService && traktService) {
    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (!text || text.startsWith('/')) return;
      if (!ctx.from) return;

      let pending: { type: string; id: number } | null = null;
      try {
        pending = await oauthService.getPendingWatchTime(ctx.from.id);
      } catch {
        return;
      }
      if (!pending) return;

      const parsed = parseWatchTimeInput(text);
      if (!parsed) {
        await ctx.reply(
          '❌ Could not understand that date.\n\nTry:\n• `2024-08-15`\n• `yesterday`\n• `2 days ago`\n• `yesterday 8pm`\n\nOr send /cancel to abort.',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      const now = new Date();
      if (parsed.getTime() > now.getTime()) {
        await ctx.reply('❌ That date is in the future. Send a past date or /cancel.');
        return;
      }

      const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
      if (!accessToken) {
        await oauthService.clearPendingWatchTime(ctx.from.id);
        await ctx.reply('❌ Not connected to Trakt. Use /login.');
        return;
      }

      const payload: any = {};
      const watchedAt = parsed.toISOString();
      if (pending.type === 'movie') {
        payload.movies = [{ ids: { trakt: pending.id }, watched_at: watchedAt }];
      } else if (pending.type === 'episode') {
        payload.episodes = [{ ids: { trakt: pending.id }, watched_at: watchedAt }];
      } else if (pending.type === 'show') {
        payload.shows = [{ ids: { trakt: pending.id }, watched_at: watchedAt }];
      } else {
        await oauthService.clearPendingWatchTime(ctx.from.id);
        await ctx.reply('❌ Unknown item type. Try again.');
        return;
      }

      try {
        await traktService.addHistoryEntry(accessToken, payload);
        await oauthService.clearPendingWatchTime(ctx.from.id);
        const iso = parsed.toISOString();
        const datePart = iso.slice(0, 10);
        const timePart = iso.slice(11, 16);
        await ctx.reply(`✅ Recorded as watched on ${datePart} at ${timePart} UTC.`);
      } catch (err) {
        logger.error('Failed to save watch time', err);
        await ctx.reply('❌ Failed to save. Try again.');
      }
    });

    bot.command('cancel', async (ctx) => {
      if (!ctx.from) return;
      await oauthService.clearPendingWatchTime(ctx.from.id);
      await ctx.reply('Cancelled.');
    });
  }

  bot.catch((err) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}