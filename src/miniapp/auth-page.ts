export function renderAuthStartPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect to TraktGram</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
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
    .error { color: #ff5555; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="logo">🎬</div>
    <h1>Connect Trakt</h1>
    <p class="subtitle" id="status">Choose how you want to sign in to TraktGram.</p>
    <div id="actions"></div>
    <div class="footer">TraktGram · Telegram bot for Trakt.tv</div>
  </div>
  <script>
    var webApp = window.Telegram && window.Telegram.WebApp;
    var card = document.getElementById('card');
    var statusElement = document.getElementById('status');
    var actions = document.getElementById('actions');
    if (webApp) {
      try { webApp.expand(); } catch (e) {}
      try { webApp.setHeaderColor('#0a0a0a'); } catch (e) {}
    }

    function callEndpoint(name, input) {
      return new Promise(function (resolve, reject) {
        if (!webApp || !webApp.Serverless || !webApp.initData) {
          reject(new Error('Telegram Serverless is unavailable. Open this page in the latest Telegram app.'));
          return;
        }

        var settled = false;
        var timeout = setTimeout(function () {
          settled = true;
          reject(new Error('Telegram did not respond to the Trakt login request. Close and reopen the Mini App, then try again.'));
        }, 15000);

        try {
          webApp.Serverless.call(name, input, function (error, result) {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error) reject(error);
            else resolve(result);
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    }

    function escapeHtml(value) {
      return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function showRetry(message) {
      statusElement.innerHTML = '<span class="error">' + escapeHtml(message) + '</span>';
      actions.innerHTML = '<a href="/auth/start" class="btn btn-primary">Try again</a>';
    }

    function renderLogin(data) {
      statusElement.textContent = 'Choose how you want to sign in to TraktGram.';
      if (data.username) {
        actions.innerHTML = '<div class="account">'
          + (data.avatarUrl ? '<img class="avatar" src="' + escapeHtml(data.avatarUrl) + '" alt="" />' : '<div class="avatar"></div>')
          + '<div class="info"><div class="name">@' + escapeHtml(data.username)
          + '</div><div class="hint">Currently connected to TraktGram</div></div></div>';
      }

      var primary = document.createElement('a');
      primary.href = data.traktUrl;
      primary.className = 'btn btn-primary';
      primary.textContent = data.username ? 'Continue as @' + data.username : 'Sign in with Trakt';
      primary.addEventListener('click', function (event) {
        event.preventDefault();
        window.location.assign(data.traktUrl);
      });

      var switchAccount = document.createElement('a');
      switchAccount.href = data.switchUrl;
      switchAccount.className = 'btn btn-secondary';
      switchAccount.textContent = 'Use a different Trakt account';
      switchAccount.addEventListener('click', function (event) {
        event.preventDefault();
        window.location.assign(data.switchUrl);
      });
      actions.appendChild(primary);
      actions.appendChild(switchAccount);

      var hint = document.createElement('p');
      hint.className = 'hint-small';
      hint.textContent = 'Trakt will ask you to sign in again so you can connect a different account.';
      actions.appendChild(hint);
    }

    if (!webApp || !webApp.initData) {
      showRetry('Open this page from the TraktGram Mini App in Telegram.');
    } else {
      callEndpoint('oauthStart', {}).then(renderLogin).catch(function (err) {
        showRetry(err && err.message ? err.message : 'Could not start Trakt login.');
      });
    }
  </script>
</body>
</html>`;
}
