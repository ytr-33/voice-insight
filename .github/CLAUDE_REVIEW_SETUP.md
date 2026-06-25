# Claude による PR 自動レビュー設定

このリポジトリには Claude による PR レビューを 3 通り用意している。

## 共通の前提: Secrets / GitHub App

いずれの方法も Anthropic の認証が必要。**本リポジトリは OAuth トークン方式（サブスク枠）を採用**している。

- **OAuth トークン方式（採用中）**: 対話版 `claude`（ターミナル）で
  `claude setup-token` を実行し、表示されたトークンを
  `Settings > Secrets and variables > Actions` に `CLAUDE_CODE_OAUTH_TOKEN` として登録する。
  Claude Pro/Max のサブスク枠で動作し、API 従量課金は発生しない。
  ```bash
  claude setup-token
  gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo ytr-33/voice-insight
  ```
- **API キー方式（代替）**: `ANTHROPIC_API_KEY` を Secrets に登録し、各ワークフローの
  `claude_code_oauth_token` 行を `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`
  （CLI 版は env を `ANTHROPIC_API_KEY`）に差し替える。API 利用分が課金される。

GitHub App は対話版 `claude`（ターミナル）で `/install-github-app` を実行すると、
インストールと Secret 登録をガイドしてくれる。

---

## 方法1: 公式 GitHub Action（自動）

`.github/workflows/claude-code-review.yml`

- `anthropics/claude-code-action@v1` を利用。
- PR の `opened` / `synchronize`（push）で自動起動し、差分をレビューして
  インラインコメントを投稿する。
- レビュー観点は `prompt` 内で要件 ID（`F-xx` / `NF-xx`）に紐付けてカスタム済み。

## 方法2: `@claude` メンション（対話的・半自動）

ワークフロー不要。GitHub App をインストールするだけで使える。

**設定手順:**
1. 対話版 `claude` のターミナルで `/install-github-app` を実行
   （または https://github.com/apps/claude から対象リポジトリにインストール）。
2. `ANTHROPIC_API_KEY`（または OAuth トークン）を Secrets に登録。
3. インストール時に作成される `.github/workflows/claude.yml`（`@claude` トリガー用）を
   マージする。

**使い方:** PR・Issue・レビューコメントに `@claude このPRをレビューして` のように
メンションすると Claude が応答する。完全自動ではなく人がトリガーする方式で、
レビューだけでなく修正コミットの依頼にも使える。方法1と併用可。

## 方法3: CLI を自前で組み込み（自動）

`.github/workflows/claude-review-cli.yml`

- 公式 Action を使わず、`@anthropic-ai/claude-code` を npm で入れて
  `claude -p`（headless mode）に差分を渡し、`gh pr comment` で結果を投稿する。
- プロンプト・出力フォーマット・投稿方法を完全に自前で制御したい場合の構成。

---

## 注意

- 方法1・3はどちらも `pull_request` で起動するため、両方有効だと 1 つの PR で
  **2 回レビューが走り課金も 2 回分**になる。常用時はどちらかに絞るのを推奨。
- いずれも要件定義書（`documents/10_要件定義/`）の Phase1 制約を観点に組み込んでいる。
