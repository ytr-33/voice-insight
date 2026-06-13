/* =========================================================
   Voice Insight — Phase1 デモ用スクリプト
   実際の録音・文字起こし・AI評価は行わない。
   画面遷移とダミーの演出だけを再現し、完成イメージを伝える。
   ========================================================= */

(function () {
  "use strict";

  const screens = document.querySelectorAll(".screen");
  const recordStates = document.querySelectorAll("#screen-record .record-state");
  const navButtons = document.querySelectorAll(".demo-nav-btn");

  let timerId = null;
  let processingTimers = [];

  /* ---- 画面切り替え ---- */
  function showScreen(name) {
    screens.forEach((s) => {
      s.classList.toggle("is-active", s.dataset.screen === name);
    });
    // デモナビの現在地ハイライト（録音系は個別状態で更新するのでここでは触らない）
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---- 録音画面の状態切り替え（idle / recording / denied） ---- */
  function setRecordState(state) {
    recordStates.forEach((el) => {
      el.hidden = el.dataset.state !== state;
    });
    stopTimer();
    if (state === "recording") startTimer();
  }

  /* ---- ダミータイマー（最大5分で自動停止して分析へ） ---- */
  function startTimer() {
    const elapsedEl = document.getElementById("timer-elapsed");
    const MAX = 5 * 60; // 5分
    let sec = 0;
    elapsedEl.textContent = "00:00";
    timerId = setInterval(() => {
      sec += 1;
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      elapsedEl.textContent = `${m}:${s}`;
      if (sec >= MAX) {
        stopTimer();
        goToProcessing();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  /* ---- 処理中演出（文字起こし → 評価 → 結果） ---- */
  function goToProcessing() {
    showScreen("processing");
    syncNav("processing");

    const stepTranscribe = document.querySelector('.step[data-step="transcribe"]');
    const stepEvaluate = document.querySelector('.step[data-step="evaluate"]');

    // リセット
    clearProcessingTimers();
    [stepTranscribe, stepEvaluate].forEach((el) => el.classList.remove("is-active", "is-done"));

    stepTranscribe.classList.add("is-active");

    processingTimers.push(
      setTimeout(() => {
        stepTranscribe.classList.remove("is-active");
        stepTranscribe.classList.add("is-done");
        stepEvaluate.classList.add("is-active");
      }, 1800)
    );

    processingTimers.push(
      setTimeout(() => {
        stepEvaluate.classList.remove("is-active");
        stepEvaluate.classList.add("is-done");
      }, 3600)
    );

    processingTimers.push(
      setTimeout(() => {
        showScreen("result");
        syncNav("result");
      }, 4300)
    );
  }

  function clearProcessingTimers() {
    processingTimers.forEach((t) => clearTimeout(t));
    processingTimers = [];
  }

  /* ---- デモナビの現在地表示 ---- */
  function syncNav(screen, recordReset) {
    navButtons.forEach((btn) => {
      let match = btn.dataset.goto === screen;
      // 録音画面はサブ状態（idle / recording / denied）まで一致させる
      if (screen === "record") {
        match = btn.dataset.goto === "record" && btn.dataset.reset === recordReset;
      }
      btn.classList.toggle("is-current", match);
    });
  }

  /* ---- イベント結線 ---- */

  // 録音開始
  document.getElementById("btn-start").addEventListener("click", () => {
    setRecordState("recording");
    syncNav("record", "recording");
  });

  // 停止して分析
  document.getElementById("btn-stop").addEventListener("click", () => {
    setRecordState("idle");
    goToProcessing();
  });

  // data-goto を持つボタン（結果/エラー/ナビ/再録音など）
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearProcessingTimers();
      const target = btn.dataset.goto;
      const reset = btn.dataset.reset; // 録音画面のサブ状態

      if (target === "record") {
        showScreen("record");
        setRecordState(reset || "idle");
        syncNav("record", reset || "idle");
      } else if (target === "processing") {
        goToProcessing();
      } else {
        showScreen(target);
        syncNav(target);
      }
    });
  });

  // 初期表示
  setRecordState("idle");
  syncNav("record", "idle");
})();
