/* =========================================================
   Voice Insight — Phase1
   ========================================================= */

(function () {
  "use strict";

  // --- State ---
  let mediaRecorder = null;
  let audioChunks = [];
  let timerId = null;
  const MAX_SECONDS = 5 * 60; // F-01: 録音上限5分

  const screens = document.querySelectorAll(".screen");
  const recordStates = document.querySelectorAll("#screen-record .record-state");
  const navButtons = document.querySelectorAll(".demo-nav-btn");

  // --- Screen / state helpers ---
  function showScreen(name) {
    screens.forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setRecordState(state) {
    recordStates.forEach((el) => { el.hidden = el.dataset.state !== state; });
    stopTimer();
  }

  function syncNav(screen, recordReset) {
    navButtons.forEach((btn) => {
      let match = btn.dataset.goto === screen;
      if (screen === "record") {
        match = btn.dataset.goto === "record" && btn.dataset.reset === recordReset;
      }
      btn.classList.toggle("is-current", match);
    });
  }

  // --- Timer (F-01: 5分で自動停止) ---
  function startTimer() {
    const elapsedEl = document.getElementById("timer-elapsed");
    let sec = 0;
    elapsedEl.textContent = "00:00";
    timerId = setInterval(() => {
      sec += 1;
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      elapsedEl.textContent = `${m}:${s}`;
      if (sec >= MAX_SECONDS) stopRecordingAndAnalyze();
    }, 1000);
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // --- MediaRecorder (F-01) ---
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start();
      showScreen("recording");
      startTimer();
      syncNav("recording");
    } catch {
      showScreen("denied");
      syncNav("denied");
    }
  }

  function stopRecordingAndAnalyze() {
    stopTimer();
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      stopStream();
      callAnalyzeApi(blob);
    };
    mediaRecorder.stop();
    showScreen("processing");
    syncNav("processing");
  }

  function stopStream() {
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }
  }

  // --- API 呼び出し (F-02 / F-03) ---
  async function callAnalyzeApi(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderResult(data);
      showScreen("result");
      syncNav("result");
    } catch {
      showScreen("error");
      syncNav("error");
    }
  }

  // --- 評価結果の描画 (F-04) ---
  function renderResult(data) {
    // 総合点
    const scoreEl = document.querySelector(".score-value");
    const scoreRingEl = document.querySelector(".score-ring");
    const scoreCommentEl = document.querySelector(".score-comment");
    if (scoreEl) scoreEl.textContent = data.score ?? "-";
    if (scoreRingEl) scoreRingEl.style.setProperty("--score", data.score ?? 0);
    if (scoreCommentEl) scoreCommentEl.textContent = data.score_comment ?? "";

    // PREP 観点の評価
    const prepKeys = ["point", "reason", "example", "conclusion"];
    const prepItems = document.querySelectorAll(".prep-item");
    prepKeys.forEach((key, i) => {
      const item = prepItems[i];
      if (!item || !data.prep) return;
      const score = data.prep[`${key}_score`] ?? 0;
      const tagText = data.prep[`${key}_tag`] ?? "";
      const tagEl = item.querySelector(".prep-tag");
      const barEl = item.querySelector(".prep-bar span");
      const textEl = item.querySelector(".prep-text");
      if (tagEl) {
        tagEl.textContent = tagText;
        tagEl.className = "prep-tag " + (tagText === "明確" ? "tag-good" : "tag-warn");
      }
      if (barEl) barEl.style.width = `${score * 4}%`;
      if (textEl) textEl.textContent = data.prep[`${key}_text`] ?? "";
    });

    // 良い点 / 改善点
    renderList(".good-card .bullet-list", data.good_points);
    renderList(".improve-card .bullet-list", data.improvements);

    // 改善提案
    const suggestUl = document.querySelector(".suggest-list");
    if (suggestUl && data.suggestions) {
      suggestUl.innerHTML = data.suggestions
        .map((s, i) => `<li><span class="suggest-num">${i + 1}</span><p>${s}</p></li>`)
        .join("");
    }
  }

  function renderList(selector, items) {
    const ul = document.querySelector(selector);
    if (!ul || !items) return;
    ul.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
  }

  // --- イベント結線 ---
  document.getElementById("btn-start").addEventListener("click", startRecording);
  document.getElementById("btn-stop").addEventListener("click", stopRecordingAndAnalyze);

  // data-goto ボタン（デモナビ・再録音など）
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.goto;
      const reset = btn.dataset.reset;
      if (target === "record") {
        showScreen("record");
        setRecordState(reset || "idle");
        syncNav("record", reset || "idle");
      } else {
        showScreen(target);
        syncNav(target);
      }
    });
  });

  // マイク権限の変更を監視（許可→不許可になったら denied 画面へ）
  async function watchMicPermission() {
    if (!navigator.permissions) return;
    try {
      const status = await navigator.permissions.query({ name: "microphone" });
      status.onchange = () => {
        if (status.state === "denied") {
          stopTimer();
          stopStream();
          mediaRecorder = null;
          showScreen("denied");
          syncNav("denied");
        }
      };
    } catch {
      // Permissions API が未対応のブラウザでは無視
    }
  }

  // 初期表示
  setRecordState("idle");
  syncNav("record", "idle");
  watchMicPermission();
})();
