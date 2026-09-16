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
    if (webApp) {
      try { webApp.expand(); } catch (e) {}
      try { if (webApp.setHeaderColor) webApp.setHeaderColor('#0a0a0a'); } catch (e) {}
    }

    function getTelegramId() {
      try {
        var q = new URLSearchParams(location.search);
        var fromQuery = q.get('telegramId');
        if (fromQuery) return fromQuery;
      } catch (e) {}
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
      fetch('/api/miniapp/me', { headers: { 'x-telegram-user-id': tgId } })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = null;
            try { data = JSON.parse(text); } catch (e) {}
            if (!res.ok) {
              var msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
              card.innerHTML = '<div class="error">' + esc(msg) + '</div>';
              return;
            }
            render(card, data);
          });
        })
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
          + 'This is a known issue on Trakt\\'s side.</div></div>';
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

    load();
  </script>
</body>
</html>`;
}