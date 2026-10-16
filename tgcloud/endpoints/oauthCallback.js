import { oauthCallback } from '../lib/app.js';

export default function (input, context) {
  return oauthCallback(input, context);
}
