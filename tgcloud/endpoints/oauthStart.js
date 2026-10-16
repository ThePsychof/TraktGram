import { oauthStart } from '../lib/app.js';

export default function (input, context) {
  return oauthStart(input, context);
}
