# my-shiba 🐕

Slack Bot to display your GitHub contribution graph (草) on demand.

## 開発のストーリー

このプロジェクトは、**完全 AI ペアプログラミング**で作成されました。

「GitHub の草を Slack で見たい」という雑な要望から始まり、
`invalid_blocks`、`invalid_arguments`、WASM の制約など、
数々の技術的な壁を乗り越えて完成しました。

**何より楽しかったのは**、AI に「こうしたい」とざっくり伝えるだけで、
技術調査から実装、デバッグまで全部サポートしてくれること。
自分の欲しいものがシュッと作れる体験は最高でした！

詳しい開発の軌跡は [docs/development-journey.md](docs/development-journey.md) をご覧ください。

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
- **SVG → PNG**: @resvg/resvg-wasm
- **GitHub Grass**: ghchart.rshah.org API

## Development

詳しい開発の経緯と技術的な課題の解決方法は、以下をご覧ください：

📖 [開発の軌跡 (Development Journey)](docs/development-journey.md)

## License

MIT
