import 'dotenv/config';
import bot from './bot';
import logger from './utils/logger';

/*
  Entrypoint: initialize and start the bot.
  Uses `dotenv` to load environment variables from `.env`.
*/
(async () => {
  try {
    logger.info('Starting Traktgram bot...');
    await bot.init();
    // `start()` keeps running until stopped; await it to propagate errors
    await bot.start();
  } catch (err) {
    logger.error('Fatal error starting bot:', err);
    process.exit(1);
  }
})();
