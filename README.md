# Voice Insight

ブラウザ上で話した内容を AI が分析し、PREP（Point→Reason→Example→Point）観点で構成を評価する音声分析 Web アプリ。

## 必要な環境

- Python 3.11 以上（ローカル起動の場合）
- dev container
- OpenAI API キー

## 起動方法（VS Code Dev Container）

リポジトリを VS Code で開き、「Reopen in Container」を選択。
コンテナ起動後、ターミナルで以下を実行:
レポジトリフォルダ直下に.envファイルを用意し、open aiのapiキーを記入する。OPENAI_API_KEY=sk-... 

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

ポート 8000 は自動転送されるため、ブラウザで http://localhost:8000 にアクセス。

## 使い方

1. 録音画面でマイクのアクセスを許可し、「録音開始」を押す（最大 5 分）
2. 「録音停止」を押すと自動で文字起こし → PREP 評価が始まる
3. 評価結果画面で総合点・PREP 各観点の評価・改善提案を確認する
