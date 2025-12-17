# my-shiba 🐕

Slack Bot to display your GitHub contribution graph (草) on demand.

## Features

- 📊 Display GitHub contribution graph by mentioning the bot
- ⚡ Fast response using Cloudflare Workers
- 🔒 Secure Slack request verification

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.dev.vars.example` to `.dev.vars` and fill in your credentials:

```bash
cp .dev.vars.example .dev.vars
```

Required variables:
- `SLACK_BOT_TOKEN`: Your Slack Bot User OAuth Token
- `SLACK_SIGNING_SECRET`: Your Slack App Signing Secret
- `GITHUB_USERNAME`: Your GitHub username

### 3. Run locally

```bash
npm run dev
```

The bot will be available at `http://localhost:8787`

### 4. Deploy to Cloudflare Workers

First, set up your secrets:

```bash
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_SIGNING_SECRET
npx wrangler secret put GITHUB_USERNAME
```

Then deploy:

```bash
npm run deploy
```

## Slack App Configuration

1. Create a new Slack App at https://api.slack.com/apps
2. Add Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
   - `files:write` (required for uploading GitHub stats images)
3. Enable Event Subscriptions
4. Subscribe to bot events:
   - `app_mention`
5. Set Request URL to your Cloudflare Worker URL: `https://my-shiba.<your-subdomain>.workers.dev/slack/events`
6. Install the app to your workspace

## Usage

Mention the bot in any channel:

```
@my-shiba check
```

The bot will reply with your GitHub contribution graph!

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Language**: TypeScript
- **GitHub Graph**: ghchart.rshah.org API
