import type { Context } from 'grammy';

export interface RenderPayload {
  text?: string;
  caption?: string;
  photo?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: any;
}

/**
 * Send a new message, or edit the existing one if we're in a callback context.
 * - Photo → text: delete + send new (Telegram can't strip a photo from a message)
 * - Text → text: edit in place
 * - Photo → photo: edit media in place
 * - Text → photo: edit media in place
 */
export async function respondWith(ctx: Context, payload: RenderPayload): Promise<void> {
  const isCallback = Boolean(ctx.callbackQuery);
  const existingMessage = ctx.callbackQuery?.message;
  const existingHasPhoto = existingMessage && 'photo' in existingMessage;

  if (isCallback && existingMessage) {
    try {
      if (payload.photo) {
        // Replace with (or set) photo
        await ctx.editMessageMedia(
          {
            type: 'photo',
            media: payload.photo,
            caption: payload.caption,
            parse_mode: payload.parse_mode,
          },
          { reply_markup: payload.reply_markup },
        );
        return;
      }

      // Text-only payload
      if (existingHasPhoto) {
        // Telegram can't remove a photo → delete old and send new
        try {
          await ctx.deleteMessage();
        } catch {
          // Message may be too old to delete; still try to send new
        }
        await ctx.reply(payload.text ?? payload.caption ?? '', {
          parse_mode: payload.parse_mode,
          reply_markup: payload.reply_markup,
        });
        return;
      }

      // Existing is text → edit
      await ctx.editMessageText(payload.text ?? payload.caption ?? '', {
        parse_mode: payload.parse_mode,
        reply_markup: payload.reply_markup,
      });
      return;
    } catch (err: any) {
      const desc = String(err?.description ?? err?.message ?? '');
      if (desc.includes('message is not modified')) return;
      // Otherwise fall through to a fresh send
    }
  }

  // Non-callback context (slash command, etc.) → always send new
  if (payload.photo) {
    await ctx.replyWithPhoto(payload.photo, {
      caption: payload.caption,
      parse_mode: payload.parse_mode,
      reply_markup: payload.reply_markup,
    });
  } else {
    await ctx.reply(payload.text ?? payload.caption ?? '', {
      parse_mode: payload.parse_mode,
      reply_markup: payload.reply_markup,
    });
  }
}