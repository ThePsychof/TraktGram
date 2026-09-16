export function renderAuthStartPage(opts: {
  traktUrl: string;
  switchUrl: string;
  currentUsername?: string;
  currentAvatarUrl?: string;
}): string {
  const { traktUrl, switchUrl, currentUsername, currentAvatarUrl } = opts;

  const esc = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const accountBlock = currentUsername
    ? `
      <div class="account">
        ${currentAvatarUrl ? `<img class="avatar" src="${esc(currentAvatarUrl)}" alt="" />` : '<div class="avatar"></div>'}
        <div class="info">
          <div class="name">@${esc(currentUsername)}</div>
          <div class="hint">Currently connected to TraktGram</div>
        </div>
      </div>`
    : '';

  const primaryLabel = currentUsername
    ? `Continue as @${esc(currentUsername)}`
    : 'Sign in with Trakt';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect to TraktGram</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a0000 0%, #2a0000 50%, #0a0a0a 100%); color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #141414; border-radius: 16px; padding: 32px 24px; max-width: 400px; width: 100%; border: 1px solid #222; text-align: center; }
    .logo { font-size: 40px; margin-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 8px; font-weight: 700; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
    .account { display: flex; align-items: center; gap: 12px; padding: 12px; background: #0a0a0a; border-radius: 12px; margin-bottom: 20px; text-align: left; border: 1px solid #1f1f1f; }
    .account .avatar { width: 48px; height: 48px; border-radius: 50%; background: #333; flex-shrink: 0; object-fit: cover; }
    .account .info { flex: 1; min-width: 0; }
    .account .info .name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .account .info .hint { font-size: 12px; color: #666; }
    .btn { display: block; width: 100%; padding: 14px 20px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; transition: all 0.2s; border: none; margin-bottom: 10px; }
    .btn-primary { background: #e50000; color: #fff; }
    .btn-primary:hover { background: #ff0000; }
    .btn-secondary { background: #222; color: #fff; }
    .btn-secondary:hover { background: #333; }
    .hint-small { color: #666; font-size: 11px; line-height: 1.5; margin: 4px 0 0; }
    .footer { color: #555; font-size: 11px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🎬</div>
    <h1>Connect Trakt</h1>
    <p class="subtitle">Choose how you want to sign in to TraktGram.</p>
    ${accountBlock}
    <a href="${esc(traktUrl)}" class="btn btn-primary">${primaryLabel}</a>
    <a href="${esc(switchUrl)}" class="btn btn-secondary">Use a different Trakt account</a>
    <p class="hint-small">Trakt will ask you to sign in again so you can connect a different account.</p>
    <div class="footer">TraktGram · Telegram bot for Trakt.tv</div>
  </div>
</body>
</html>`;
}