# TraktGram

Telegram client for [Trakt.tv](https://trakt.tv). Cloudflare Workers + Grammy + TypeScript.

**Bot:** [@TraktGram_bot](https://t.me/TraktGram_bot)

## Commands

`/start` `/login` `/me` `/stats` `/trending` `/history` `/random` `/help` `/ping` `/cancel`

Inline: `@TraktGram_bot <title>` in any chat.

## Features

- OAuth login, switch accounts without logging out of trakt.tv
- Trending, watchlist, history, recommendations
- Detail pages: poster, rating, cast, personal status
- Mark watched — now, custom date, or unknown
- Show progress: seasons list, episode list with ✅ / ▶ markers
- Ratings on Trakt's 5-star scale (half steps)
- Check-in ("watching now")
- Mini App: avatar, name, watch time, last 5 items

## Deploy

```bash
npm install

npx wrangler kv namespace create STORE
npx wrangler kv namespace create STORE --preview
# paste the two IDs into wrangler.toml

npx wrangler secret put BOT_TOKEN            --env production
npx wrangler secret put TRAKT_CLIENT_ID      --env production
npx wrangler secret put TRAKT_CLIENT_SECRET  --env production
npx wrangler secret put ADMIN_SECRET         --env production
npx wrangler secret put WEBHOOK_SECRET       --env production

npm run deploy

curl -X POST "https://<your-worker>.workers.dev/admin/set-webhook" \
  -H "x-admin-secret: <ADMIN_SECRET>"
```

Then in [@BotFather](https://t.me/BotFather):
- **Menu Button** → `https://<your-worker>.workers.dev/miniapp`
- **Domain** → `<your-worker>.workers.dev` (hostname only)

Trakt app redirect URI: `https://<your-worker>.workers.dev/auth/callback`

## Stack

| Piece | What |
|---|---|
| Runtime | Cloudflare Workers |
| Bot | Grammy |
| Storage | Cloudflare KV |
| Trakt | OAuth 2.0, API v2 |

## Known issues

**Trakt `/users/me/stats` is broken** (Sept 2026) — returns `204` for many users. Multiple apps affected. Bot shows *"stats temporarily unavailable"* and recovers automatically when Trakt fixes it. **Don't paginate history as a workaround** — Trakt cut the max `limit` to 250 on June 15, 2026, and hammering `/sync/history` trips rate limits.

**Webhook hostname caching** — if Telegram says *"Failed to resolve host"* after a Worker rename, the old hostname has a stale negative DNS cache on Telegram's side. Rename again to get a fresh one.

**Token refresh race** — rare double-refresh near expiration. If users get logged out unexpectedly, that's the cause.

## Structure

```
src/
  bot.ts / index.ts              # Grammy assembly, Worker entry
  commands/                      # slash commands
  handlers/                      # callbacks, inline
  miniapp/                       # HTML, JSON API, auth landing
  services/                      # trakt, oauth, storage, user
  ui/                            # menus, screens, navigate
  utils/ types/
```

GPL3 — see [LICENSE](https://github.com/ThePsychof/TraktGram?tab=GPL-3.0-1-ov-file).
