import { Bot } from 'grammy';
import { registerStart } from './commands/start';
import { registerPing } from './commands/ping';
import { registerHelp } from './commands/help';
import { registerTrending } from './commands/trending';
import logger from './utils/logger';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set in environment');

// Create bot instance
const bot = new Bot(token);

// Register command handlers (keeps command logic separated)
registerStart(bot);
registerPing(bot);
registerHelp(bot);
registerTrending(bot);

// Global error handler for unhandled update errors
bot.catch((err) => {
  logger.error('Unhandled bot error', err);
});

export default bot;
