export function renderMiniAppPage(_deepLink?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TraktGram</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 24px 16px; min-height: 100vh; }
    .card { max-width: 480px; margin: 0 auto; background: #141414; border-radius: 16px; padding: 24px; border: 1px solid #222; }
    .avatar { width: 96px; height: 96px; border-radius: 50%; background: #333; margin: 0 auto 16px; display: block; object-fit: cover; }
    .avatar-fallback { width: 96px; height: 96px; border-radius: 50%; background: #222; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #666; }
    .name { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .handle { text-align: center; color: #888; font-size: 14px; margin-bottom: 24px; }
    .stat { text-align: center; padding: 20px; background: #0a0a0a; border-radius: 12px; margin-bottom: 24px; border: 1px solid #1f1f1f; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #e50000; }
    .stat-sub { color: #666; font-size: 12px; margin-top: 6px; }
    .stat-unavailable { color: #888; font-size: 12px; line-height: 1.5; }
    h3 { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px; }
    .history-item { display: flex; align-items: center; padding: 10px 12px; background: #0a0a0a; border-radius: 8px; margin-bottom: 6px; border-left: 3px solid #e50000; }
    .history-item .title { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history-item .date { color: #666; font-size: 11px; margin-left: 8px; flex-shrink: 0; }
    .loading, .error { text-align: center; padding: 40px; color: #666; }
    .error { color: #ff5555; }
    .note { font-size: 11px; color: #666; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="loading">Loading…</div>
  </div>
  <script>
    var webApp = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    var card = document.getElementById('card');
    var oauthParams = new URLSearchParams(location.search);
    var hasOAuthResponse = ['code', 'state', 'error', 'error_description'].some(function (key) {
      return oauthParams.has(key);
    });
    var isLoginLaunch = location.pathname === '/' && webApp && webApp.initDataUnsafe
      && webApp.initDataUnsafe.start_param === 'login';
    if (webApp) {
      try { webApp.expand(); } catch (e) {}
      try { if (webApp.setHeaderColor) webApp.setHeaderColor('#0a0a0a'); } catch (e) {}
    }

    if (isLoginLaunch && !hasOAuthResponse) {
      location.replace('/auth/start');
    }

    function getTelegramId() {
      try {
        var u = webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.user;
        if (u && u.id) return String(u.id);
      } catch (e) {}
      try {
        var raw = webApp && webApp.initData;
        if (raw) {
          var params = new URLSearchParams(raw);
          var userJson = params.get('user');
          if (userJson) {
            var parsed = JSON.parse(userJson);
            if (parsed && parsed.id) return String(parsed.id);
          }
        }
      } catch (e) {}
      return null;
    }

    function callEndpoint(name, input) {
      return new Promise(function (resolve, reject) {
        if (!webApp || !webApp.Serverless) {
          reject(new Error('Open this from the Telegram Mini App.'));
          return;
        }
        webApp.Serverless.call(name, input, function (error, result) {
          if (error) reject(error);
          else resolve(result);
        });
      });
    }

    function finishOAuthCallback() {
      var code = oauthParams.get('code');
      var state = oauthParams.get('state');
      var error = oauthParams.get('error');
      history.replaceState(null, '', '/');

      if (error) {
        card.innerHTML = '<div class="error">'
          + (error === 'access_denied'
            ? 'Trakt sign-in was cancelled. Reopen /login to try again.'
            : 'Trakt returned an authorization error. Check your Trakt app settings.')
          + '</div>';
        return;
      }
      if (!code || !state) {
        card.innerHTML = '<div class="error">Trakt returned without the required authorization details. Verify the redirect URI in your Trakt app settings.</div>';
        return;
      }

      card.innerHTML = '<div class="loading">Finishing Trakt connection…</div>';
      callEndpoint('oauthCallback', { code: code, state: state })
        .then(function () {
          card.innerHTML = '<div class="name">Your Trakt account is connected.</div>'
            + '<div class="handle">Return to the TraktGram bot to continue.</div>';
          if (webApp && webApp.close) webApp.close();
        })
        .catch(function (err) {
          card.innerHTML = '<div class="error">' + esc(err && err.message ? err.message : 'Trakt login failed.') + '</div>';
        });
    }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatTime(m) {
      var n = Number(m);
      if (!n || !isFinite(n) || n <= 0) return '0m';
      var d = Math.floor(n / 1440);
      var h = Math.floor((n % 1440) / 60);
      var mn = n % 60;
      var parts = [];
      if (d) parts.push(d + 'd');
      if (h) parts.push(h + 'h');
      if (mn) parts.push(mn + 'm');
      return parts.join(' ') || '0m';
    }

    function load() {
      var card = document.getElementById('card');
      var tgId = getTelegramId();
      if (!tgId) {
        card.innerHTML = '<div class="error">Open this from inside Telegram.</div>';
        return;
      }
      callEndpoint('miniappApi', { path: '/api/miniapp/me', method: 'GET' })
        .then(function (data) { render(card, data); })
        .catch(function (err) {
          var msg = (err && err.message) ? err.message : 'unknown error';
          card.innerHTML = '<div class="error">Request failed: ' + esc(msg) + '</div>';
        });
    }

    function render(card, data) {
      if (!data || typeof data !== 'object') {
        card.innerHTML = '<div class="error">Malformed response.</div>';
        return;
      }
      var p = data.profile || {};
      var wt = data.watchTime || { movies: 0, episodes: 0, total: 0 };
      var stats = data.stats || { available: false };
      var hist = Array.isArray(data.recentHistory) ? data.recentHistory : [];

      var avatarHtml;
      if (p.avatar) {
        avatarHtml = '<img class="avatar" src="' + esc(p.avatar) + '" alt="" />';
      } else {
        avatarHtml = '<div class="avatar-fallback">👤</div>';
      }

      var name = esc(p.name || p.username || 'Unknown');
      var handle = p.username ? '@' + esc(p.username) : '';

      var statHtml;
      if (stats.available === false) {
        statHtml = '<div class="stat"><div class="stat-label">Total watched</div>'
          + '<div class="stat-unavailable">⚠️ Trakt stats are temporarily unavailable.<br>'
          + 'Please try again later.</div></div>';
      } else {
        statHtml = '<div class="stat"><div class="stat-label">Total watched</div>'
          + '<div class="stat-value">' + formatTime(wt.total) + '</div>'
          + '<div class="stat-sub">Movies ' + formatTime(wt.movies)
          + ' · Episodes ' + formatTime(wt.episodes) + '</div></div>';
      }

      var histHtml = '<h3>Recent</h3>';
      if (!hist.length) {
        histHtml += '<div class="loading" style="padding:20px 0;">No recent activity.</div>';
      } else {
        for (var i = 0; i < hist.length; i++) {
          var item = hist[i] || {};
          var title = esc(item.title || 'Unknown');
          var date = item.watchedAt ? esc(String(item.watchedAt).slice(0, 10)) : '';
          histHtml += '<div class="history-item"><div class="title">' + title
            + '</div><div class="date">' + date + '</div></div>';
        }
      }

      card.innerHTML = avatarHtml
        + '<div class="name">' + name + '</div>'
        + '<div class="handle">' + handle + '</div>'
        + statHtml
        + histHtml;
    }

    if (hasOAuthResponse) finishOAuthCallback();
    else if (!isLoginLaunch) load();
  </script>
</body>
</html>`;
}