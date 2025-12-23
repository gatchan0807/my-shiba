# PR作成ガイドライン

## 基本ルール

PR（Pull Request）を作成する際は、**必ず `gh` コマンドを使用すること**。

### ❌ 避けるべき方法
- ブラウザを起動してPRを作成
- GitHub Web UIを手動で操作

### ✅ 推奨される方法
```bash
gh pr create --title "タイトル" --body "説明文" --base main
```

## PR作成の流れ

1. ブランチを作成
```bash
git checkout -b feature/your-feature
```

2. コミット
```bash
git add .
git commit -m "commit message"
```

3. プッシュ
```bash
git push -u origin feature/your-feature
```

4. **`gh` コマンドでPR作成**
```bash
gh pr create \
  --title "タイトル" \
  --body "説明文" \
  --base main
```

## 日本語対応

PR description（説明文）は**必ず日本語で記述**すること。

### 例
```bash
gh pr create \
  --title "fix: 画像のパディングを調整" \
  --body "## 問題

画像の余白が多すぎる問題。

## 修正内容

パディングを非対称に調整しました。" \
  --base main
```

## マージとデプロイ

PRのマージも `gh` コマンドで実施：

```bash
# Squash & Merge
gh pr merge <PR番号> --squash --delete-branch

# マージ後にmainブランチを更新
git checkout main && git pull origin main

# デプロイ
npx wrangler deploy
```

## 理由

- **効率性**: ブラウザ起動は不要で高速
- **自動化**: スクリプトで簡単に自動化可能
- **一貫性**: コマンドラインで全て完結
