import logging
import uuid
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
import json

load_dotenv(Path(__file__).parent.parent / ".env")

app = FastAPI()
client = OpenAI()  # OPENAI_API_KEY を .env から読み込む

# ログ設定
_LOG_DIR = Path(__file__).parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_handler = RotatingFileHandler(
    _LOG_DIR / "analysis.log",
    maxBytes=5 * 1024 * 1024,  # 5MB
    backupCount=3,
    encoding="utf-8",
)
_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
logger = logging.getLogger("voice_insight")
logger.setLevel(logging.DEBUG)
logger.addHandler(_handler)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

EVAL_SYSTEM_PROMPT = """あなたは話し方のコーチです。
発話内容をPREP（Point→Reason→Example→Point）の観点で評価し、
必ず指定されたJSON形式のみで回答してください。余分なテキストは不要です。

## 採点基準（各項目0〜25点、合計100点満点）

| 項目 | 0点 | 13点 | 25点 |
|------|-----|------|------|
| Point（冒頭の主張） | 結論がない | 結論らしきものがある | 冒頭で明確な結論を述べている |
| Reason（理由） | 理由がない | 理由が曖昧 | 結論を支える理由が明確 |
| Example（具体例） | 具体例がない | 抽象的な例 | 説得力のある具体例がある |
| Point再提示（結論） | まとめがない | 弱いまとめ | 結論を再度明確に述べている |

- PREP要素が適切な順序（Point→Reason→Example→Point）で展開されているかも評価に含めてください。
- scoreはpoint_score + reason_score + example_score + conclusion_scoreの合計値としてください。
- 各要素の _quote フィールドには、発話内容から該当する部分を一字一句そのまま省略せずに引用してください。「...」などで途中を省略することは禁止です。該当箇所がない場合のみ空文字にしてください。"""

EVAL_USER_TEMPLATE = """以下の発話内容を評価してください。

発話内容:
{text}

次のJSON形式で回答してください:
{{
  "score": <4項目の合計点（0〜100の整数）>,
  "score_comment": "<総合点についての一言コメント（30字以内）>",
  "prep": {{
    "point_score": <0〜25の整数>,
    "point_quote": "<発話内容からPointに相当する部分を省略せずそのまま引用（該当なければ空文字、省略・短縮禁止）>",
    "point_tag": "<明確|やや弱い|改善余地 のいずれか>",
    "point_text": "<主張（冒頭）への評価コメント>",
    "reason_score": <0〜25の整数>,
    "reason_quote": "<発話内容からReasonに相当する部分を省略せずそのまま引用（該当なければ空文字、省略・短縮禁止）>",
    "reason_tag": "<明確|やや弱い|改善余地 のいずれか>",
    "reason_text": "<理由への評価コメント>",
    "example_score": <0〜25の整数>,
    "example_quote": "<発話内容からExampleに相当する部分を省略せずそのまま引用（該当なければ空文字、省略・短縮禁止）>",
    "example_tag": "<明確|やや弱い|改善余地 のいずれか>",
    "example_text": "<具体例への評価コメント>",
    "conclusion_score": <0〜25の整数>,
    "conclusion_quote": "<発話内容からPoint再提示に相当する部分を省略せずそのまま引用（該当なければ空文字、省略・短縮禁止）>",
    "conclusion_tag": "<明確|やや弱い|改善余地 のいずれか>",
    "conclusion_text": "<結論（締め）への評価コメント>"
  }},
  "good_points": ["<良い点1>", "<良い点2>"],
  "improvements": ["<改善点1>", "<改善点2>"],
  "suggestions": ["<次回への具体的な改善提案1>", "<次回への具体的な改善提案2>", "<次回への具体的な改善提案3>"]
}}"""


def _log_analysis(req_id: str, text: str, result: dict) -> None:
    prep = result.get("prep", {})
    items = [
        ("Point    ", "point"),
        ("Reason   ", "reason"),
        ("Example  ", "example"),
        ("Conclude ", "conclusion"),
    ]
    lines = [
        f"[{req_id}] ========== ANALYSIS ==========",
        f"[{req_id}] [TRANSCRIPTION]",
        f"[{req_id}] {text}",
        f"[{req_id}] [PREP BREAKDOWN]",
    ]
    for label, key in items:
        score = prep.get(f"{key}_score", "-")
        quote = prep.get(f"{key}_quote") or "（該当なし）"
        lines.append(f"[{req_id}] {label} score={score}/25  quote={quote!r}")
    lines.append(
        f"[{req_id}] [TOTAL] score={result.get('score', '-')}/100  {result.get('score_comment', '')}"
    )
    for line in lines:
        logger.info(line)


@app.post("/api/analyze")
async def analyze(audio: UploadFile = File(...)):
    req_id = uuid.uuid4().hex[:8]
    audio_bytes = await audio.read()

    # Step 1: 文字起こし（NF-02: 日本語のみ）
    try:
        transcription = client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=(audio.filename or "recording.webm", audio_bytes, audio.content_type),
            language="ja",
        )
    except Exception as e:
        logger.error(f"[{req_id}] 文字起こし失敗: {e}")
        raise HTTPException(status_code=502, detail=f"文字起こしに失敗しました: {e}")

    text = transcription.text
    if not text.strip():
        logger.warning(f"[{req_id}] 文字起こし結果が空")
        raise HTTPException(status_code=422, detail="音声からテキストを取得できませんでした。")

    # Step 2: GPT-4o で PREP 構成評価（F-03）
    try:
        response = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": EVAL_SYSTEM_PROMPT},
                {"role": "user", "content": EVAL_USER_TEMPLATE.format(text=text)},
            ],
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"[{req_id}] 構成評価失敗: {e}")
        raise HTTPException(status_code=502, detail=f"構成評価に失敗しました: {e}")

    _log_analysis(req_id, text, result)
    return result


# 静的ファイル（フロントエンド）の配信 — API ルートの後に配置すること
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
