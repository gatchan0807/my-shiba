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
4. **Event Subscriptions**で、`app_mention`イベントを有効化する
5. Request URLに、デプロイしたWorkerのURL + `/slack/events`を設定
   - 例: `https://my-shiba.<your-subdomain>.workers.dev/slack/events`
6. Install the app to your workspace

## GitHub Actionsによる自動デプロイ

このリポジトリには、`main`ブランチへのpush時に自動的にCloudflare Workersへデプロイするワークフローが含まれています。

### セットアップ手順

1. **GitHubリポジトリのSecretsを設定**

   リポジリの Settings → Secrets and variables → Actions で以下のSecretsを追加：

   - `CLOUDFLARE_API_TOKEN`: Cloudflare API Token
     - https://dash.cloudflare.com/profile/api-tokens から作成
     - "Edit Cloudflare Workers" テンプレートを使用
   
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
     - https://dash.cloudflare.com/ の右側に表示されている
   
   - `SLACK_BOT_TOKEN`: Slack Bot User OAuth Token
   
   - `SLACK_SIGNING_SECRET`: Slack Appの Signing Secret
   
   - `GITHUB_USERNAME`: GitHubのユーザー名（草を表示したい）

2. **デプロイ**

   `main`ブランチにpushするだけで自動的にデプロイされます：

   ```bash
   git push origin main
   ```

   または、GitHub Actions タブから手動でトリガーできます。

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
