import { processTelegramUpdate } from '../lib/app.js';

export default function (message, context) {
  return processTelegramUpdate({ type: 'message', payload: message }, context);
}
