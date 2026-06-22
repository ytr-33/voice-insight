# Codex による PR 自動レビュー設定

このリポジトリには Codex（OpenAI）による PR レビュー／自動対応を複数用意している。
Claude 版（`CLAUDE_REVIEW_SETUP.md`）の Codex 相当版。

## 認証は大きく2系統ある（ここが一番重要）

Codex の使い方によって、用意するものが変わる。

### A. OpenAI API キー方式（GitHub Actions 用 / このリポジトリのワークフロー）

`.github/workflows/codex-*.yml` はすべてこの方式。**API 従量課金**で動く。

1. OpenAI Platform で API キーを発行: https://platform.openai.com/api-keys
   - 課金が有効なアカウント（支払い方法登録済み）が必要。
2. リポジトリの `Settings > Secrets and variables > Actions` に
   **`OPENAI_API_KEY`** という名前で登録する。
3. これだけで `codex-code-review.yml` / `codex-review-cli.yml` / `codex.yml` が動く。

> セキュリティ補足:
> - 公式 Action（`openai/codex-action`）はキーを **安全なプロキシ経由**で Responses API
>   に渡すため、`codex exec` のサブプロセスに生キーが露出しない。**方法1を推奨**。
> - 自前 CLI 版（方法3）はジョブ env に `CODEX_API_KEY` を置くため、リポジトリ由来の
>   コードを実行するジョブと混在させると読み取られる恐れがある。レビュー専用に
>   `--sandbox read-only` で隔離している。

### B. ChatGPT アカウント方式（Codex クラウド連携 / `@codex`）

GitHub Actions を一切書かずに、**ChatGPT の Plus/Pro/Team/Business/Enterprise 枠**で
動かす公式連携。リポジトリ Secret も不要。→ 後述「方法2」。

| | A. API キー方式 | B. ChatGPT アカウント方式 |
|---|---|---|
| 課金 | API 従量課金 | ChatGPT サブスク枠 |
| 必要な Secret | `OPENAI_API_KEY` | 不要 |
| 設定場所 | リポジトリ Secrets + ワークフロー | https://chatgpt.com/codex の設定画面 |
| 使うもの | 本リポジトリの `.yml` | Codex GitHub App |

---

## 方法1: 公式 GitHub Action（自動）

`.github/workflows/codex-code-review.yml`

- `openai/codex-action@v1` を利用。
- PR の `opened` / `synchronize`（push）で自動起動し、差分を `codex exec` でレビューして
  PR にコメント投稿する（`final-message` を `actions/github-script` で投稿）。
- レビュー観点は `prompt` 内で要件 ID（`F-xx` / `NF-xx`）に紐付けてカスタム済み。
- 認証: `OPENAI_API_KEY`（上記 A）。

## 方法2: `@codex` メンション（Codex クラウド連携・半自動）

ワークフロー不要。**Codex GitHub App をインストールするだけ**で使える（上記 B の方式）。

**設定手順:**
1. https://chatgpt.com/codex を開き、Settings で対象リポジトリに対して
   **Code review を ON** にする（GitHub への接続と Codex GitHub App の
   インストールがガイドされる）。
2. 毎 PR を自動レビューしたい場合は **Automatic reviews** も ON にする。
3. 必要なら `AGENTS.md` をリポジトリに置き、レビュー方針を Codex に指示する。

**使い方:** PR コメントに `@codex review` と書くと Codex が 👀 を付けてレビューを返す。
`@codex このバグを直して` のように実装・修正も依頼できる。認証は ChatGPT アカウント枠
（上記 B）で、リポジトリ Secret は不要。

> 補足: `.github/workflows/codex.yml` は「同じ `@codex` メンション体験を **API キー方式**で
> GitHub Actions 上に再現したい場合」の代替。クラウド連携（方法2）を使うなら `codex.yml`
> は不要なので、どちらか一方にする。

## 方法3: CLI を自前で組み込み（自動）

`.github/workflows/codex-review-cli.yml`

- 公式 Action を使わず、`@openai/codex` を npm で入れて `codex exec`（非対話モード）に
  差分を渡し、最終メッセージを `--output-last-message` で受け取り `gh pr comment` で投稿する。
- プロンプト・出力フォーマット・投稿方法を完全に自前で制御したい場合の構成。
- 認証: ジョブ env の `CODEX_API_KEY`（`OPENAI_API_KEY` Secret を割り当て）。

---

## 注意

- 方法1・3はどちらも `pull_request` で起動するため、両方有効だと 1 つの PR で
  **2 回レビューが走り課金も 2 回分**になる。常用時はどちらかに絞るのを推奨。
- 方法2（クラウド連携）と方法1/3 を併用すると、クラウド側 + Actions 側で二重に
  レビューが走る。検証後は運用方針を 1 つに決めること。
- いずれも要件定義書（`documents/10_要件定義/`）の Phase1 制約を観点に組み込んでいる。
