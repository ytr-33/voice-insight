# Secret 更新手順: CLAUDE_CODE_OAUTH_TOKEN

PR 自動レビュー（方法1・方法3）は `CLAUDE_CODE_OAUTH_TOKEN` を使う。
初回登録・トークン失効時（CIが認証エラーになったとき）はこの手順で更新する。

## 手順

1. 対話版 `claude`（ターミナル）でトークンを発行
   ```bash
   claude setup-token
   ```
   表示された `sk-ant-oat...` をコピーする。

2. Secret に登録（更新も同じコマンドで上書きされる）
   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo ytr-33/voice-insight
   # プロンプトにトークンを貼り付けて Enter
   ```
   GUI の場合: リポジトリ `Settings > Secrets and variables > Actions`
   → `CLAUDE_CODE_OAUTH_TOKEN` の `Update`（無ければ `New repository secret`）。

3. 反映確認: 登録済みか一覧で確認
   ```bash
   gh secret list --repo ytr-33/voice-insight
   ```
   次の PR 作成・push でレビューが正常に動けば完了。

## メモ

- トークンには有効期限がある。期限切れで CI が落ちたら手順1から再発行する。
- 値は Secret に保存され、コミット・ログには絶対に含めないこと。
- API キー方式に戻す場合は `ANTHROPIC_API_KEY` を登録し、各ワークフローの
  認証行を差し替える（詳細は CLAUDE_REVIEW_SETUP.md）。
