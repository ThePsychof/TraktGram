import { renderAuthStartPage } from './auth-page';
import { renderMiniAppPage } from './ui';

export const pages = {
  miniapp: renderMiniAppPage(),
  oauth: renderAuthStartPage(),
};
