# TraktGram

Your Trakt.tv library, inside Telegram.

TraktGram brings your watch history, watchlist, recommendations, ratings, show progress, and Trakt profile into Telegram.

[@TraktGram_bot](https://t.me/TraktGram_bot)

## Features

- Trakt OAuth login and account switching
- Trending movies and shows, search, details, cast, posters, ratings, and personal status
- Watchlist, history, recommendations, collection, calendar, and show progress
- Mark movies and episodes as watched, including custom watch dates
- 5-star ratings with half-star support and Trakt check-ins
- Inline search from any Telegram chat
- Telegram Mini App with profile and watch activity

Commands: `/start` · `/login` · `/me` · `/stats` · `/trending` · `/history` · `/random` · `/help` · `/ping` · `/cancel`

## Stack

TypeScript · grammY (bundled for the Serverless runtime) · Telegram Serverless · SQLite · Trakt API

## Setup and deploy

1. Enable **Serverless** for the bot in [@BotFather](https://t.me/BotFather), then link the project:

   ```powershell
   npx tgcloud login
   ```

2. Build and deploy the modules and Mini App:

   ```powershell
   npm run deploy
   ```

   Use the hosted Mini App URL printed by the CLI as the bot's Main Mini App URL in BotFather. The `/login` deep link opens that Mini App with Telegram-verified user data.

3. Register the hosted Mini App root, `https://app<app_id>.tgcloud.ai/`, as the Trakt application's redirect URI, replacing the host with the URL printed by the CLI. The callback is handled on the root page because the static host canonicalizes nested paths and drops OAuth query parameters.

4. Create the ignored local file `.traktgram-secrets.json` with the Trakt client values:

   ```json
   {
     "TRAKT_CLIENT_ID": "your-client-id",
     "TRAKT_CLIENT_SECRET": "your-client-secret",
     "TRAKT_API_KEY": "your-api-key",
     "OAUTH_REDIRECT_URI": "https://app<app_id>.tgcloud.ai/"
   }
   ```

   Apply the schema, then configure the values through the authenticated setup script:

   ```powershell
   npx tgcloud migrate
   npm run configure
   ```

   The configure script reads the ignored local file and saved CLI token directly, avoiding PowerShell argument-quoting issues and keeping credentials out of command arguments and CLI output. The owner-only endpoint stores credentials in the bot's private SQLite database, never in the deployed source or logs; it rejects Mini App calls. Keep the local file private and remove it after setup.

5. For future schema changes, run `npx tgcloud migrate` and review its prompts before applying them.

The hosted auth page keeps the Telegram Mini App origin and session during the Trakt redirect. It then calls a Serverless endpoint with Telegram's verified `initData`; the endpoint validates the OAuth state and performs the token exchange.
