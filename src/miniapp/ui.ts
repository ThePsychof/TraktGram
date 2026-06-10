export function renderMiniAppPage(deepLink?: string) {
  const encodedDeepLink = deepLink ? `?deepLink=${encodeURIComponent(deepLink)}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TraktGram Mini App</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0d0f14; color: #f5f7fb; }
    header { padding: 16px; background: #141722; box-shadow: inset 0 -1px 0 rgba(255,255,255,.05); }
    h1 { margin: 0; font-size: 1.3rem; }
    p { margin: 8px 0; color: #adc4e0; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    button { border: 0; border-radius: 999px; padding: 10px 16px; background: #1e232e; color: #f5f7fb; cursor: pointer; transition: background .2s ease; }
    button.active, button:hover { background: #2d3445; }
    main { padding: 16px; }
    .card { background: #141722; border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
    .card h2 { margin: 0 0 6px; font-size: 1rem; }
    .card p { margin: 4px 0; line-height: 1.4; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .link-button { background: #2563eb; }
    .small { color: #91a6d4; font-size: .9rem; }
    .hidden { display: none; }
    .status { padding: 12px 16px; background: #171d29; border-radius: 16px; margin-bottom: 16px; }
    .spinner { display: inline-block; width: 18px; height: 18px; border: 3px solid rgba(255,255,255,.15); border-top-color: #5b84ff; border-radius: 50%; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <header>
    <h1>TraktGram Mini App</h1>
    <p id="subtitle">Your primary Trakt experience inside Telegram.</p>
  </header>
  <main>
    <nav id="nav"></nav>
    <section id="status" class="status hidden"></section>
    <section id="screen"></section>
  </main>
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
      status.style.color = isError ? '#ff9e8f' : '#a4c7ff';
      status.textContent = message;
    }

    function clearStatus() {
      status.classList.add('hidden');
      status.textContent = '';
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

    function buildEndpoint(path) {
      const url = new URL(path, location.origin);
      const telegramId = state.telegramId;
      if (telegramId) url.searchParams.set('telegramId', telegramId);
      return url.toString();
    }

    async function fetchJson(path) {
      setStatus('Loading...');
      try {
        const response = await fetch(buildEndpoint(path));
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
        { id: 'continue', label: 'Continue Watching' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'watchlist', label: 'Watchlist' },
        { id: 'history', label: 'History' },
        { id: 'recommendations', label: 'Recommendations' },
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
      if (screen === 'continue') renderContinue();
      if (screen === 'calendar') renderCalendar();
      if (screen === 'watchlist') renderWatchlist();
      if (screen === 'history') renderHistory();
      if (screen === 'recommendations') renderRecommendations();
      if (screen === 'profile') renderProfile();
    }

    function renderItemCard(item, type) {
      const card = document.createElement('article');
      card.className = 'card';

      const title = document.createElement('h2');
      title.textContent = item.title || item.name || 'Untitled';
      card.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'small';
      const year = item.year || item.first_aired?.slice(0, 4) || '';
      meta.textContent = [type.toUpperCase(), year].filter(Boolean).join(' • ');
      card.appendChild(meta);

      const overview = document.createElement('p');
      overview.textContent = item.overview || item.tagline || 'No description available.';
      card.appendChild(overview);

      const row = document.createElement('div');
      row.className = 'row';
      const detailsButton = document.createElement('button');
      detailsButton.textContent = 'Open Details';
      detailsButton.className = 'link-button';
      detailsButton.addEventListener('click', () => showDetails(type, item.ids?.trakt || item.id));
      row.appendChild(detailsButton);
      card.appendChild(row);

      return card;
    }

    function renderList(titleText, items, type) {
      root.innerHTML = '<h2>' + titleText + '</h2>';
      if (!items || items.length === 0) {
        root.innerHTML += '<p>No items found.</p>';
        return;
      }
      items.forEach((item) => {
        const card = renderItemCard(item, type);
        root.appendChild(card);
      });
    }

    async function renderHome() {
      root.innerHTML = '<h2>Home</h2><p>Fetching your personalized Trakt overview...</p>';
      try {
        const trendingPromise = fetchJson('/api/miniapp/public/trending?limit=5');
        const continuePromise = fetchJson('/api/miniapp/user/continue?limit=5');
        const profilePromise = fetchJson('/api/miniapp/user/profile');
        const [trending, continueData, profile] = await Promise.allSettled([trendingPromise, continuePromise, profilePromise]);

        root.innerHTML = '<h2>Home</h2>';
        if (profile.status === 'fulfilled') {
          const summary = document.createElement('div');
          summary.className = 'card';
          summary.innerHTML = '<strong>Welcome, ' + (profile.value.profile.username || 'guest') + '</strong><p class="small">Movies watched: ' + (profile.value.profile.stats.movies?.watched ?? 0) + ' • Episodes watched: ' + (profile.value.profile.stats.episodes?.watched ?? 0) + '</p>';
          root.appendChild(summary);
        }

        const section = document.createElement('section');
        section.innerHTML = '<h3>Continue Watching</h3>';
        root.appendChild(section);
        if (continueData.status === 'fulfilled' && continueData.value.items.length) {
          continueData.value.items.slice(0, 4).forEach((item) => root.appendChild(renderItemCard(item, item.movie ? 'movie' : 'show')));
        } else {
          root.innerHTML += '<p>No active playback items.</p>';
        }

        root.innerHTML += '<h3>Trending</h3>';
        if (trending.status === 'fulfilled' && trending.value.items.length) {
          trending.value.items.slice(0, 4).forEach((item) => root.appendChild(renderItemCard(item.movie || item.show || item, item.type || (item.movie ? 'movie' : 'show'))));
        } else {
          root.innerHTML += '<p>Unable to load trending items.</p>';
        }
      } catch (error) {
        root.innerHTML = '<p>Failed to load home screen.</p>';
      }
    }

    async function renderContinue() {
      root.innerHTML = '<h2>Continue Watching</h2>';
      try {
        const data = await fetchJson('/api/miniapp/user/continue?limit=20');
        if (!data.items.length) {
          root.innerHTML += '<p>No items to continue.</p>';
          return;
        }
        data.items.forEach((item) => root.appendChild(renderItemCard(item, item.movie ? 'movie' : 'show')));
      } catch (error) {
        root.innerHTML += '<p>Unable to fetch continue watching.</p>';
      }
    }

    async function renderCalendar() {
      root.innerHTML = '<h2>Calendar</h2>';
      try {
        const data = await fetchJson('/api/miniapp/user/calendar?days=7');
        const items = [...(data?.shows ?? []), ...(data?.movies ?? [])];
        if (!items.length) {
          root.innerHTML += '<p>No upcoming items in the next 7 days.</p>';
          return;
        }
        items.slice(0, 10).forEach((item) => {
          const card = document.createElement('article');
          card.className = 'card';
          const title = document.createElement('h2');
          const label = item.episode ? (item.show?.title || item.show?.name || 'Show') + ' - S' + item.episode.season + 'E' + item.episode.number : item.movie?.title || item.movie?.name || 'Movie';
          title.textContent = label;
          card.appendChild(title);
          const subtitle = document.createElement('p');
          subtitle.className = 'small';
          subtitle.textContent = item.first_aired || item.released || 'Unknown date';
          card.appendChild(subtitle);
          root.appendChild(card);
        });
      } catch (error) {
        root.innerHTML += '<p>Unable to fetch calendar.</p>';
      }
    }

    async function renderWatchlist() {
      root.innerHTML = '<h2>Watchlist</h2>';
      try {
        const data = await fetchJson('/api/miniapp/user/watchlist?limit=20');
        if (!data.items.length) {
          root.innerHTML += '<p>Your watchlist is empty.</p>';
          return;
        }
        data.items.forEach((item) => root.appendChild(renderItemCard(item.movie || item.show || item, item.movie ? 'movie' : 'show')));
      } catch (error) {
        root.innerHTML += '<p>Unable to fetch watchlist.</p>';
      }
    }

    async function renderHistory() {
      root.innerHTML = '<h2>History</h2>';
      try {
        const data = await fetchJson('/api/miniapp/user/history?limit=20');
        if (!data.items.length) {
          root.innerHTML += '<p>No recent history.</p>';
          return;
        }
        data.items.forEach((item) => {
          const card = document.createElement('article');
          card.className = 'card';
          const title = document.createElement('h2');
          title.textContent = item.movie?.title || item.show?.title || item.title || 'History item';
          card.appendChild(title);
          const subtitle = document.createElement('p');
          subtitle.className = 'small';
          subtitle.textContent = item.watched_at ? new Date(item.watched_at).toLocaleString() : 'Unknown time';
          card.appendChild(subtitle);
          root.appendChild(card);
        });
      } catch (error) {
        root.innerHTML += '<p>Unable to fetch history.</p>';
      }
    }

    async function renderRecommendations() {
      root.innerHTML = '<h2>Recommendations</h2>';
      try {
        const data = await fetchJson('/api/miniapp/user/recommendations?type=movies&page=1&limit=10');
        if (!data.items.length) {
          root.innerHTML += '<p>No recommendations available.</p>';
          return;
        }
        data.items.forEach((item) => root.appendChild(renderItemCard(item.movie || item.show || item, item.movie ? 'movie' : 'show')));
      } catch (error) {
        root.innerHTML += '<p>Unable to fetch recommendations.</p>';
      }
    }

    async function renderProfile() {
      root.innerHTML = '<h2>Profile</h2>';
      try {
        const data = await fetchJson('/api/miniapp/user/profile');
        const profile = data.profile || {};
        const card = document.createElement('article');
        card.className = 'card';
        const watchlistCount = ((profile.stats?.watchlist?.movies ?? 0) + (profile.stats?.watchlist?.shows ?? 0)) || 0;
        const collectionCount = ((profile.stats?.collection?.movies ?? 0) + (profile.stats?.collection?.shows ?? 0)) || 0;
        card.innerHTML = '<h2>' + (profile.username || 'Unknown user') + '</h2>' +
          '<p class="small">Trakt ID: ' + (profile.userId || 'Unknown') + '</p>' +
          '<p>Movies watched: ' + (profile.stats?.movies?.watched ?? 0) + '</p>' +
          '<p>Episodes watched: ' + (profile.stats?.episodes?.watched ?? 0) + '</p>' +
          '<p>Ratings: ' + (profile.stats?.ratings?.total ?? 0) + '</p>' +
          '<p>Watchlist: ' + watchlistCount + '</p>' +
          '<p>Collection: ' + collectionCount + '</p>';
        root.appendChild(card);
      } catch (error) {
        root.innerHTML += '<p>Unable to load profile. Ensure your Trakt account is connected.</p>';
      }
    }

    async function showDetails(type, id) {
      state.screen = 'details';
      renderNav();
      root.innerHTML = '<h2>Loading details...</h2>';
      try {
        const data = await fetchJson('/api/miniapp/public/item/' + type + '/' + id);
        const item = data.item;
        root.innerHTML = '<article class="card"><h2>' + (item.title || item.name || 'Unknown') + '</h2><p class="small">' + type.toUpperCase() + ' • ' + (item.year || item.first_aired?.slice(0,4) || '') + '</p><p>' + (item.overview || 'No description available.') + '</p><div class="row"><button class="link-button" onclick="window.location.reload()">Refresh</button></div></article>';
      } catch (error) {
        root.innerHTML += '<p>Unable to load item details.</p>';
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
