import { processTelegramUpdate } from '../lib/app.js';

export default function (callbackQuery, context) {
  return processTelegramUpdate({ type: 'callback_query', payload: callbackQuery }, context);
}
