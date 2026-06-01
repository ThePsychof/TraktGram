#!/bin/bash
# Deployment Setup Script for Cloudflare Worker TraktGram Bot

set -e

echo "🚀 TraktGram Cloudflare Worker Setup"
echo "=================================="
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Authenticate with Cloudflare
echo ""
echo "🔐 Authenticating with Cloudflare..."
echo "Run: npx wrangler login"
echo ""

# Step 3: Get project info
echo "ℹ️  Project Information:"
echo "   Name: traktgram"
echo "   Type: Cloudflare Worker"
echo "   Runtime: Node.js compatible"
echo ""

# Step 4: Set secrets
echo "🔑 Setting environment secrets..."
echo ""
echo "You'll need to set these secrets:"
echo "  1. BOT_TOKEN - Your Telegram bot token"
echo "  2. TRAKT_CLIENT_ID - Your Trakt API key"
echo "  3. TRAKT_CLIENT_SECRET - Your Trakt API secret"
echo "  4. WEBHOOK_SECRET (optional) - Random secret for webhook validation"
echo ""
echo "Generate a webhook secret with:"
echo "  openssl rand -hex 32"
echo ""

# Step 5: Deploy
echo "📤 To deploy, run:"
echo "  npm run deploy"
echo ""

echo "✅ Setup complete!"
echo ""
echo "After deployment:"
echo "1. Get your Worker URL from Cloudflare Dashboard"
echo "2. Set Telegram webhook to: https://your-worker-url/webhook"
echo "   Use Telegram Bot API: setWebhook method or BotFather"
