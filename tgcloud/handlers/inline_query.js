import { processTelegramUpdate } from '../lib/app.js';

export default function (inlineQuery, context) {
  return processTelegramUpdate({ type: 'inline_query', payload: inlineQuery }, context);
}
