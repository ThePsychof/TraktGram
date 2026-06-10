export function renderMiniAppPage(deepLink?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trakt</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000; color: #fff; }
    header { background: #1a1a1a; padding: 12px 16px; border-bottom: 1px solid #222; position: sticky; top: 0; z-index: 100; }
    header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.5px; color: #e50000; }
    main { max-width: 100%; }
    nav { display: flex; gap: 6px; padding: 12px 16px 0; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid #222; }
    nav::-webkit-scrollbar { display: none; }
    nav button { background: transparent; border: none; color: #999; padding: 8px 12px; cursor: pointer; font-size: 13px; white-space: nowrap; flex-shrink: 0; transition: all 0.2s; font-weight: 500; }
    nav button:hover { color: #fff; }
    nav button.active { color: #e50000; border-bottom: 2px solid #e50000; }
    .content { padding: 16px; max-width: 900px; margin: 0 auto; }
    .status { padding: 12px 16px; background: #1a1a1a; border-radius: 4px; margin-bottom: 16px; color: #999; font-size: 13px; }
    .status.error { color: #ff6b6b; }
    .hidden { display: none; }
    .card { background: #141414; border-radius: 6px; padding: 16px; margin-bottom: 12px; border: 1px solid #222; transition: all 0.2s; }
    .card:hover { border-color: #333; }
    .card h2 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
    .card p { margin: 4px 0; color: #999; font-size: 13px; line-height: 1.5; }
    .card .meta { color: #666; font-size: 12px; }
    .card .actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn { background: #e50000; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn:hover { background: #ff0000; }
    .btn-secondary { background: #2a2a2a; color: #fff; }
    .btn-secondary:hover { background: #3a3a3a; }
    .list-item { background: #0a0a0a; border-left: 3px solid #e50000; padding: 12px 16px; margin-bottom: 8px; border-radius: 2px; cursor: pointer; transition: all 0.2s; }
    .list-item:hover { background: #141414; border-left-color: #ff0000; }
    .item-title { font-size: 14px; font-weight: 500; }
    .item-meta { font-size: 12px; color: #666; margin-top: 4px; }
    .section-title { margin: 20px 0 12px; font-size: 14px; font-weight: 600; color: #999; }
    .empty { text-align: center; padding: 40px 20px; color: #666; font-size: 13px; }
    .profile-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
    .stat { background: #0a0a0a; padding: 12px; border-radius: 4px; text-align: center; border: 1px solid #222; }
    .stat-value { font-size: 20px; font-weight: 700; color: #e50000; }
    .stat-label { font-size: 11px; color: #666; margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>trakt</h1>
  </header>
  <nav id="nav"></nav>
  <div class="content">
    <section id="status" class="status hidden"></section>
    <section id="screen"></section>
  </div>
  <script>
    const webApp = window.Telegram?.WebApp ?? null;
    if (webApp) {
      webApp.expand();
    }

    const root = document.getElementById('screen');
    const nav = document.getElementById('nav');
    const status = document.getElementById('status');
    const state = {
      screen: 'home',
      telegramId: null,
      deepLink: '${deepLink ?? ''}',
    };

    function setStatus(message, isError = false) {
      status.classList.remove('hidden');
      status.classList.toggle('error', isError);
      status.textContent = message;
    }

    function clearStatus() {
      status.classList.add('hidden');
    }

    function parseTelegramId() {
      const query = new URLSearchParams(location.search);
      const fromQuery = query.get('telegramId');
      if (fromQuery && Number(fromQuery) > 0) {
        return fromQuery;
      }
      const initUser = webApp?.initDataUnsafe?.user;
      return initUser?.id ? String(initUser.id) : null;
    }

    async function fetchJson(path) {
      setStatus('Loading...');
      try {
        const url = new URL(path, location.origin);
        const isUserEndpoint = url.pathname.includes('/api/miniapp/user/');
        
        if (isUserEndpoint && !state.telegramId) {
          throw new Error('telegramId is required in header x-telegram-user-id or query.');
        }
        
        const options = {
          headers: {}
        };
        if (state.telegramId) {
          options.headers['x-telegram-user-id'] = state.telegramId;
        }
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || response.statusText || 'Request failed');
        }
        const json = await response.json();
        clearStatus();
        return json;
      } catch (error) {
        setStatus(error.message || 'Network error', true);
        throw error;
      }
    }

    function renderNav() {
      nav.innerHTML = '';
      const items = [
        { id: 'home', label: 'Home' },
        { id: 'trending', label: 'Trending' },
        { id: 'continue', label: 'Watching' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'watchlist', label: 'Watchlist' },
        { id: 'history', label: 'History' },
        { id: 'profile', label: 'Profile' },
      ];
      items.forEach((item) => {
        const button = document.createElement('button');
        button.textContent = item.label;
        button.className = state.screen === item.id ? 'active' : '';
        button.addEventListener('click', () => navigate(item.id));
        nav.appendChild(button);
      });
    }

    function navigate(screen) {
      state.screen = screen;
      renderNav();
      if (screen === 'home') renderHome();
      if (screen === 'trending') renderTrending();
      if (screen === 'continue') renderContinue();
      if (screen === 'calendar') renderCalendar();
      if (screen === 'watchlist') renderWatchlist();
      if (screen === 'history') renderHistory();
      if (screen === 'profile') renderProfile();
    }

    function renderItemCard(item, type, compact = true) {
      if (compact) {
        const div = document.createElement('div');
        div.className = 'list-item';
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = item.title || item.name || 'Untitled';
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        const year = item.year || item.first_aired?.slice(0, 4) || '';
        meta.textContent = [type.toUpperCase(), year].filter(Boolean).join(' • ');
        div.appendChild(title);
        div.appendChild(meta);
        div.addEventListener('click', () => showDetails(type, item.ids?.trakt || item.id));
        return div;
      }
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('h2');
      title.textContent = item.title || item.name || 'Untitled';
      card.appendChild(title);
      const meta = document.createElement('p');
      meta.className = 'meta';
      const year = item.year || item.first_aired?.slice(0, 4) || '';
      meta.textContent = [type.toUpperCase(), year].filter(Boolean).join(' • ');
      card.appendChild(meta);
      if (item.overview || item.tagline) {
        const overview = document.createElement('p');
        overview.textContent = item.overview || item.tagline || '';
        card.appendChild(overview);
      }
      const actions = document.createElement('div');
      actions.className = 'actions';
      const detailsButton = document.createElement('button');
      detailsButton.className = 'btn';
      detailsButton.textContent = 'View';
      detailsButton.addEventListener('click', () => showDetails(type, item.ids?.trakt || item.id));
      actions.appendChild(detailsButton);
      card.appendChild(actions);
      return card;
    }

    function renderList(titleText, items, type, compact = true) {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">' + titleText + '</h2>';
      if (!items || items.length === 0) {
        root.innerHTML += '<div class="empty">No items</div>';
        return;
      }
      items.forEach((item) => {
        const card = renderItemCard(item, type, compact);
        root.appendChild(card);
      });
    }

    async function renderHome() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Home</h2><div class="status">Loading...</div>';
      try {
        const trendingPromise = fetchJson('/api/miniapp/public/trending?limit=5');
        const continuePromise = fetchJson('/api/miniapp/user/continue?limit=5').catch(() => ({ items: [] }));
        const [trending, continueData] = await Promise.allSettled([trendingPromise, continuePromise]);
        root.innerHTML = '';
        
        const trendingData = trending.status === 'fulfilled' ? trending.value : { items: [] };
        if (trendingData.items && trendingData.items.length > 0) {
          const title = document.createElement('h2');
          title.className = 'section-title';
          title.textContent = 'Trending Now';
          root.appendChild(title);
          trendingData.items.forEach((item) => {
            root.appendChild(renderItemCard(item, item.type === 'show' ? 'show' : 'movie', true));
          });
        }

        const continueDataItems = continueData.status === 'fulfilled' ? continueData.value : { items: [] };
        if (continueDataItems.items && continueDataItems.items.length > 0) {
          const title = document.createElement('h2');
          title.className = 'section-title';
          title.textContent = 'Continue Watching';
          root.appendChild(title);
          continueDataItems.items.forEach((item) => {
            root.appendChild(renderItemCard(item, 'show', true));
          });
        }

        if (root.children.length === 0) {
          root.innerHTML = '<div class="empty">No data available</div>';
        }
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load home</div>';
      }
    }

    async function renderTrending() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Trending</h2><div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/public/trending?limit=20');
        renderList('Trending', data.items, 'movie', true);
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load trending</div>';
      }
    }

    async function renderContinue() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Continue Watching</h2><div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/user/continue?limit=20');
        renderList('Continue Watching', data.items, 'show', true);
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load continue watching</div>';
      }
    }

    async function renderCalendar() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Calendar</h2><div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/user/calendar');
        if (!data.items || data.items.length === 0) {
          root.innerHTML = '<div class="empty">No upcoming episodes</div>';
          return;
        }
        root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Upcoming Episodes</h2>';
        data.items.slice(0, 20).forEach((item) => {
          const div = document.createElement('div');
          div.className = 'list-item';
          const title = document.createElement('div');
          title.className = 'item-title';
          const label = item.episode ? (item.show?.title || item.show?.name || 'Show') + ' - S' + item.episode.season + 'E' + item.episode.number : (item.movie?.title || item.movie?.name || 'Movie');
          title.textContent = label;
          const meta = document.createElement('div');
          meta.className = 'item-meta';
          meta.textContent = item.first_aired || item.released || 'Unknown date';
          div.appendChild(title);
          div.appendChild(meta);
          root.appendChild(div);
        });
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load calendar</div>';
      }
    }

    async function renderWatchlist() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Watchlist</h2><div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/user/watchlist');
        renderList('Watchlist', data.items, 'movie', true);
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load watchlist</div>';
      }
    }

    async function renderHistory() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">History</h2><div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/user/history');
        renderList('History', data.items, 'history', true);
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load history</div>';
      }
    }

    async function renderProfile() {
      root.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">Profile</h2><div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/user/profile');
        const profile = data.profile || {};
        const watchlistCount = ((profile.stats?.watchlist?.movies ?? 0) + (profile.stats?.watchlist?.shows ?? 0)) || 0;
        const collectionCount = ((profile.stats?.collection?.movies ?? 0) + (profile.stats?.collection?.shows ?? 0)) || 0;
        root.innerHTML = '<div class="card"><h2>' + (profile.username || 'Unknown user') + '</h2><p class="meta">Trakt ID: ' + (profile.userId || 'Unknown') + '</p><div class="profile-stats"><div class="stat"><div class="stat-value">' + (profile.stats?.movies?.watched ?? 0) + '</div><div class="stat-label">Movies watched</div></div><div class="stat"><div class="stat-value">' + (profile.stats?.episodes?.watched ?? 0) + '</div><div class="stat-label">Episodes watched</div></div><div class="stat"><div class="stat-value">' + watchlistCount + '</div><div class="stat-label">Watchlist</div></div><div class="stat"><div class="stat-value">' + (profile.stats?.ratings?.total ?? 0) + '</div><div class="stat-label">Ratings</div></div></div></div>';
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load profile</div>';
      }
    }

    async function showDetails(type, id) {
      root.innerHTML = '<div class="status">Loading...</div>';
      try {
        const data = await fetchJson('/api/miniapp/public/item/' + type + '/' + id);
        const item = data.item;
        root.innerHTML = '<div class="card"><h2>' + (item.title || item.name || 'Unknown') + '</h2><p class="meta">' + type.toUpperCase() + ' • ' + (item.year || item.first_aired?.slice(0,4) || '') + '</p><p>' + (item.overview || 'No description available.') + '</p><div class="actions"><button class="btn" onclick="navigate(\\\"home\\\")\">Back</button></div></div>';
      } catch (error) {
        root.innerHTML = '<div class="empty">Unable to load details</div>';
      }
    }

    function initialize() {
      state.telegramId = parseTelegramId();
      renderNav();
      if (state.deepLink) {
        const [type, id] = state.deepLink.split('_');
        if (type && id) {
          showDetails(type, id);
          return;
        }
      }
      navigate('home');
    }

    document.addEventListener('DOMContentLoaded', initialize);
  </script>
</body>
</html>`;
}
