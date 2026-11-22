// assets/js/quizResultModal.js
// 共用測驗結算對話框：自動套用目前主題配色、字型與主題口吻文案

const THEME_RESULT_COPY = {
    default: {
        perfectTitle: "滿分通關！太厲害了！",
        greatTitle: "表現優異！完成本輪特訓",
        goodTitle: "順利完成本輪練習！",
        keepGoingTitle: "完成練習，繼續加油！",
        gameOverTitle: "生命值耗盡！挑戰結束",
        syncHint: "成績與積點已自動同步至個人學習檔案。",
        alreadyScoredHint: "本篇文章先前已計分，本次不重複發放點數。",
        backLobbyBtn: "返回大廳"
    },
    adventure: {
        perfectTitle: "傳說級完美通關！",
        greatTitle: "漂亮的試煉戰績！",
        goodTitle: "試煉完成，冒險者穩步前行！",
        keepGoingTitle: "試煉結束，整裝再出發！",
        gameOverTitle: "體力耗盡！返回營地休整",
        syncHint: "戰利品積點與試煉次數已寫入冒險者日誌。",
        alreadyScoredHint: "此秘境卷軸已完成過計分，本次不重複發放獎勵。",
        backLobbyBtn: "返回公會"
    },
    cyber: {
        perfectTitle: "S-RANK // 零失誤通關",
        greatTitle: "A+ 評級 // 訓練協議完成",
        goodTitle: "SYNC OK // 完成本輪訓練",
        keepGoingTitle: "訓練結束 // 建議再次掃描複習",
        gameOverTitle: "護盾歸零 // 挑戰連線中止",
        syncHint: "數據積點與練習紀錄已同步至系統檔案。",
        alreadyScoredHint: "此文本節點已領取過獎勵，本次不重複計點。",
        backLobbyBtn: "返回中樞"
    }
};

function getActiveThemeId() {
    const domTheme = document.documentElement?.dataset?.theme;
    if (domTheme && THEME_RESULT_COPY[domTheme]) return domTheme;
    const storeTheme = window.UserStore?.getTheme?.();
    if (storeTheme && THEME_RESULT_COPY[storeTheme]) return storeTheme;
    return "default";
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function showQuizResultModal(options = {}) {
    const {
        unitName = "測驗練習",
        mode = "normal", // "normal" | "infinite" | "reading"
        score = 0,
        wrongCount = 0,
        totalQuestions = 0,
        scorePercent = null,
        earnedPoints = 0,
        alreadySubmitted = false,
        primaryText = "再練一次",
        secondaryText = null,
        onPrimary = null,
        onSecondary = null
    } = options;

    const existing = document.getElementById("quiz-result-modal");
    if (existing) existing.remove();

    const themeId = getActiveThemeId();
    const copy = THEME_RESULT_COPY[themeId] || THEME_RESULT_COPY.default;

    const total = totalQuestions > 0 ? totalQuestions : Math.max(score + wrongCount, score);
    const accuracy = scorePercent !== null
        ? Math.max(0, Math.min(100, Math.round(Number(scorePercent) || 0)))
        : (total > 0 ? Math.round((score / total) * 100) : 0);

    let icon = "✨";
    let headline = copy.goodTitle;
    let rankBadge = "PASS";

    if (mode === "infinite") {
        icon = score >= 10 ? "🔥" : "💔";
        headline = copy.gameOverTitle;
        rankBadge = score >= 15 ? "LEGEND" : score >= 8 ? "GREAT" : "ENDLESS";
    } else if (accuracy === 100 && total > 0) {
        icon = "🏆";
        headline = copy.perfectTitle;
        rankBadge = "PERFECT";
    } else if (accuracy >= 80) {
        icon = "🎉";
        headline = copy.greatTitle;
        rankBadge = "GREAT";
    } else if (accuracy >= 50) {
        icon = "✨";
        headline = copy.goodTitle;
        rankBadge = "GOOD";
    } else {
        icon = "💪";
        headline = copy.keepGoingTitle;
        rankBadge = "KEEP GOING";
    }

    const storeSnap = window.UserStore?.getState?.();
    const currentTotalPoints = storeSnap?.profile?.points;
    const currentTotalPractice = storeSnap?.profile?.practiceStats?.totalCount;

    const primaryLabel = primaryText || "確定";
    const secondaryLabel = secondaryText || copy.backLobbyBtn;
    const pointsText = alreadySubmitted ? "+0" : `+${Number(earnedPoints) || 0}`;
    const subHint = alreadySubmitted ? copy.alreadyScoredHint : copy.syncHint;

    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.id = "quiz-result-modal";
        modal.className = "quiz-result-backdrop";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        modal.innerHTML = `
            <div class="quiz-result-dialog">
                <div class="quiz-result-header">
                    <span class="quiz-result-unit-tag">${escapeHtml(unitName)}</span>
                    <span class="quiz-result-rank-badge">${escapeHtml(rankBadge)}</span>
                </div>

                <div class="quiz-result-hero">
                    <div class="quiz-result-icon">${icon}</div>
                    <h3 class="quiz-result-title">${escapeHtml(headline)}</h3>
                    <p class="quiz-result-subtitle">${escapeHtml(subHint)}</p>
                </div>

                <!-- 正確率進度條 -->
                <div class="quiz-result-progress-wrap">
                    <div class="quiz-result-progress-meta">
                        <span>${mode === "reading" ? "測驗分數" : "本次正確率"}</span>
                        <strong class="quiz-result-mono">${accuracy}${mode === "reading" ? " 分" : "%"}</strong>
                    </div>
                    <div class="quiz-result-progress-track">
                        <div class="quiz-result-progress-fill" style="width: ${accuracy}%;"></div>
                    </div>
                </div>

                <!-- 數據摘要三欄卡 -->
                <div class="quiz-result-stats-grid">
                    <div class="quiz-result-stat">
                        <span class="quiz-result-stat-label">${mode === "infinite" ? "答對題數" : "答對 / 總題"}</span>
                        <strong class="quiz-result-stat-val quiz-result-mono">
                            ${mode === "infinite" ? `${score} 題` : `${score} / ${total}`}
                        </strong>
                    </div>
                    <div class="quiz-result-stat quiz-result-stat-accent">
                        <span class="quiz-result-stat-label">本次獲得</span>
                        <strong class="quiz-result-stat-val quiz-result-mono">${pointsText} 點</strong>
                    </div>
                    <div class="quiz-result-stat">
                        <span class="quiz-result-stat-label">${mode === "infinite" ? "答錯題數" : "目前總點數"}</span>
                        <strong class="quiz-result-stat-val quiz-result-mono">
                            ${mode === "infinite"
                                ? `${wrongCount} 題`
                                : (currentTotalPoints !== undefined ? `${currentTotalPoints} 點` : `${score} 分`)}
                        </strong>
                    </div>
                </div>

                ${currentTotalPractice !== undefined ? `
                    <div class="quiz-result-footer-meta">
                        <span>累計總練習：<strong class="quiz-result-mono">${currentTotalPractice}</strong> 次</span>
                        ${currentTotalPoints !== undefined && mode === "infinite"
                            ? `<span>目前總點數：<strong class="quiz-result-mono">${currentTotalPoints}</strong> 點</span>`
                            : ""}
                    </div>
                ` : ""}

                <div class="quiz-result-actions">
                    <button type="button" id="quiz-result-secondary-btn" class="quiz-result-btn-secondary">
                        ${escapeHtml(secondaryLabel)}
                    </button>
                    <button type="button" id="quiz-result-primary-btn" class="quiz-result-btn-primary">
                        ${escapeHtml(primaryLabel)}
                    </button>
                </div>
            </div>
        `;

        const cleanup = (action) => {
            document.removeEventListener("keydown", handleKeydown);
            modal.remove();
            resolve(action);
        };

        const handleKeydown = (e) => {
            if (e.key === "Escape") {
                cleanup("dismiss");
            } else if (e.key === "Enter") {
                if (typeof onPrimary === "function") onPrimary();
                cleanup("primary");
            }
        };

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                if (typeof onPrimary === "function") onPrimary();
                cleanup("backdrop");
            }
        });

        const primaryBtn = modal.querySelector("#quiz-result-primary-btn");
        const secondaryBtn = modal.querySelector("#quiz-result-secondary-btn");

        primaryBtn.onclick = () => {
            if (typeof onPrimary === "function") onPrimary();
            cleanup("primary");
        };

        secondaryBtn.onclick = () => {
            if (typeof onSecondary === "function") {
                onSecondary();
            } else {
                window.location.hash = "lobby";
            }
            cleanup("secondary");
        };

        document.addEventListener("keydown", handleKeydown);
        document.body.appendChild(modal);
        primaryBtn.focus();
    });
}

if (typeof window !== "undefined") {
    window.showQuizResultModal = showQuizResultModal;
}
