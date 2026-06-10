import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { OAuthService } from '../services/oauth';
import type { TraktService } from '../services/trakt';
import { renderDetails } from '../ui/screens/details';

// Register `/start` command and present Mini App entrypoint.
export function registerStart(
  bot: Bot,
  traktService: TraktService,
  oauthService?: OAuthService,
  miniAppUrl?: string
) {
  bot.command('start', async (ctx) => {
    const text = ctx.message?.text?.trim() ?? '';
    const parts = text.split(' ').filter(Boolean);
    const payload = parts[1];

    if (payload && miniAppUrl) {
      const encodedPayload = encodeURIComponent(payload);
      const url = `${miniAppUrl}?deepLink=${encodedPayload}`;
      const keyboard = new InlineKeyboard().webApp('Open in TraktGram Mini App', url);
      await ctx.reply(
        'Open this item in the TraktGram Mini App for the best Trakt experience.',
        { reply_markup: keyboard }
      );
      return;
    }

    if (payload) {
      const [type, idPart] = payload.split('_');
      const id = Number(idPart);
      if ((type === 'movie' || type === 'show') && !Number.isNaN(id) && id > 0) {
        try {
          await renderDetails(ctx, traktService, oauthService as any, type, id);
          return;
        } catch (err) {
          console.error('Failed to render deep-linked item', err);
        }
      }
    }

    const welcomeText = [
      '🎬 TraktGram',
      '',
      'Open the Mini App for your primary Trakt experience: Continue Watching, Calendar, Watchlist, History, Recommendations, and Profile.',
      '',
      'Use inline search anywhere by typing @TraktGram_Bot followed by a movie or show title.',
    ].join('\n');

    if (miniAppUrl) {
      const keyboard = new InlineKeyboard().webApp('Open TraktGram Mini App', miniAppUrl);
      await ctx.reply(welcomeText, { reply_markup: keyboard });
      return;
    }

    await ctx.reply(welcomeText);
  });
}
