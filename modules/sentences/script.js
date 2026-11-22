// 直接在模組內引入 Firebase v9 相容版 SDK
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
import { showQuizResultModal } from "../../assets/js/quizResultModal.js";
import { getAccessLimits, openUpgradeGate } from "../../assets/js/accessGate.js";
import {
    DEFAULT_MASTERY_THRESHOLD,
    loadWordMasteryState,
    recordWordAttempt,
    setWordExcluded,
    getMasterySummary,
    buildFilteredQuizPool,
    loadSharedWordBank,
    getCachedSentence,
    fetchSentencesOnDemand
} from "../../assets/js/wordMastery.js";
import {
    POOL_RECOGNITION,
    createEmptyWrongBook,
    loadWrongBook,
    recordWrongWord,
    batchApplyWrongReview,
    removeWordsFromAllWrongPools,
    getWrongPoolCount,
    getWrongPoolWords,
    showWrongReviewModal
} from "../../assets/js/wrongBook.js";

export default {
    id: "sentences",

    init: async function(container) {
        const store = window.UserStore;
        const currentLicenseKey = store
            ? store.getState().userId
            : (localStorage.getItem("boshen_license_key") || "TEST01");

        container.innerHTML = `
            <div class="space-y-4" style="padding-bottom: 40px;">
                <!-- 頂部控制與返回列 -->
                <div class="flex items-center justify-between theme-card p-4 rounded-2xl border border-slate-200 shadow-sm" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <button id="sen-back-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-slate-200">← 返回學習大廳</button>
                    <div class="font-black text-sm text-sky-400" id="sen-status-title">💬 生活情境句子選擇題 - 連線中...</div>
                    <div class="flex items-center space-x-3">
                        <div id="sen-lives-container" class="hidden text-lg tracking-widest" title="剩餘生命">❤️❤️❤️</div>
                        <div class="text-sm font-bold text-slate-300">✓ <span id="sen-stat-correct">0</span> / ✗ <span id="sen-stat-wrong">0</span></div>
                    </div>
                </div>

                <!-- 測驗設定與執行畫面容器 -->
                <div id="sen-main-area" class="theme-card p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6" style="background: #1e293b; border-color: #334155; color: #f8fafc;">

                    <!-- 初始設定面板 -->
                    <div id="sen-config-panel" class="space-y-4">
                        <h3 class="text-xl font-black text-slate-100">💬 生活情境句子測驗設定</h3>
                        <div id="sen-trial-banner" class="hidden flex items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200">
                            <span>🔒 試用版開放前 50 個單字，開通序號可解鎖全部 2,000+ 單字</span>
                            <button type="button" id="sen-upgrade-btn" class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shrink-0 cursor-pointer">輸入序號</button>
                        </div>

                        <div class="space-y-2 pt-2">
                            <p class="text-xs text-slate-400 font-bold">題數 / 挑戰模式：</p>
                            <label class="flex items-center p-3 rounded-xl border border-slate-700 hover:border-sky-400 cursor-pointer font-bold text-sm bg-slate-900 text-slate-200">
                                <input type="radio" name="sen-count" value="10" checked class="w-4 h-4 text-sky-400">
                                <span class="ml-3">10 題情境特訓</span>
                            </label>
                            <label class="flex items-center p-3 rounded-xl border border-slate-700 hover:border-sky-400 cursor-pointer font-bold text-sm bg-slate-900 text-slate-200">
                                <input type="radio" name="sen-count" value="20" class="w-4 h-4 text-sky-400">
                                <span class="ml-3">20 題綜合挑戰</span>
                            </label>
                            <label class="flex items-center p-3 rounded-xl border border-rose-900 cursor-pointer font-bold text-sm bg-rose-950/40 text-rose-300">
                                <input type="radio" name="sen-count" value="infinite" class="w-4 h-4 text-rose-500">
                                <span class="ml-3">❤️ 無限題 (三條命挑戰模式)</span>
                            </label>
                            <label id="sen-wrong-mode-label" class="flex items-center justify-between p-3 rounded-xl border border-amber-800/70 cursor-pointer font-bold text-sm bg-amber-950/30 text-amber-200">
                                <span class="flex items-center">
                                    <input type="radio" name="sen-count" value="wrong" id="sen-wrong-radio" class="w-4 h-4 text-amber-400">
                                    <span class="ml-3">📌 認讀錯題複習（最多 10 題）</span>
                                </span>
                                <span id="sen-wrong-count-badge" class="text-xs font-mono text-amber-300">載入中...</span>
                            </label>
                        </div>

                        <label class="flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-900/80 text-xs font-bold text-slate-200 cursor-pointer">
                            <span class="flex items-center gap-2">
                                <input type="checkbox" id="sen-exclude-mastered" checked class="w-4 h-4 accent-emerald-500">
                                <span>排除已熟練與手動略過單字</span>
                            </span>
                            <span id="sen-mastery-summary" class="text-[11px] text-emerald-400">載入中...</span>
                        </label>

                        <button id="sen-start-btn" class="w-full py-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl shadow transition text-base cursor-pointer">
                            🚀 開始情境句子測驗
                        </button>
                    </div>

                    <!-- 實際測驗進行畫面 (預設隱藏) -->
                    <div id="sen-quiz-panel" class="hidden space-y-6">
                        <div id="sen-question-content" class="space-y-4 min-h-[200px]"></div>
                        <div id="sen-feedback-box" class="p-4 rounded-xl font-medium text-sm min-h-[56px] flex items-center opacity-0 transition-opacity duration-200 bg-slate-900 border border-slate-700 text-slate-300">
                            請作答...
                        </div>
                        <div class="flex justify-end pt-2">
                            <button id="sen-btn-submit" class="w-full sm:w-auto px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl shadow transition cursor-pointer">送出答案</button>
                            <button id="sen-btn-next" class="hidden w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow transition cursor-pointer">下一題 →</button>
                        </div>
                    </div>

                </div>
            </div>
        `;

        container.querySelector("#sen-back-btn").onclick = () => {
            window.location.hash = "lobby";
        };

        let WORD_DATABASE = [];
        let WORD_MASTERY = {};
        let WRONG_BOOK = createEmptyWrongBook();
        let MASTERY_THRESHOLD = DEFAULT_MASTERY_THRESHOLD;
        let activeQuizPool = [];
        let excludeMastered = true;
        let quizCountSetting = '10';
        let quizList = [];
        let sessionReviewLog = [];
        let currentIndex = 0;
        let score = 0;
        let wrongCount = 0;
        let lives = 3;
        let answered = false;
        let currentCorrectAnswer = "";
        let sessionSettled = false;

        const getActiveUserId = () => (store ? store.getState().userId : currentLicenseKey);

        if (!firebase.apps.length) {
            firebase.initializeApp({
                databaseURL: "https://chtreadingcompre-default-rtdb.firebaseio.com/"
            });
        }
        const db = firebase.database();

        const statusTitle = container.querySelector("#sen-status-title");
        const masterySummaryEl = container.querySelector("#sen-mastery-summary");
        statusTitle.textContent = "⏳ 正在載入題庫...";

        function refreshMasterySummaryUI() {
            if (!masterySummaryEl) return;
            const summary = getMasterySummary(WORD_DATABASE, WORD_MASTERY, MASTERY_THRESHOLD);
            masterySummaryEl.textContent = `可考 ${summary.remaining} 字｜已排除 ${summary.excludedTotal} 字（滿 ${MASTERY_THRESHOLD} 次熟練）`;
        }

        function refreshWrongBookUI() {
            const badge = container.querySelector("#sen-wrong-count-badge");
            const radio = container.querySelector("#sen-wrong-radio");
            const label = container.querySelector("#sen-wrong-mode-label");
            const cnt = getWrongPoolCount(WORD_DATABASE, WRONG_BOOK, POOL_RECOGNITION);
            if (badge) badge.textContent = cnt > 0 ? `${cnt} 題` : "目前無錯題";
            if (radio) {
                radio.disabled = cnt === 0;
                if (cnt === 0 && radio.checked) {
                    const fallbackRadio = container.querySelector('input[name="sen-count"][value="10"]');
                    if (fallbackRadio) fallbackRadio.checked = true;
                }
            }
            if (label) {
                label.classList.toggle("opacity-50", cnt === 0);
            }
        }

        try {
            const accessLimits = getAccessLimits();
            const [words, masteryState, wrongBook] = await Promise.all([
                loadSharedWordBank(db, {
                    trialOnly: accessLimits.isTrial,
                    limit: accessLimits.wordLimit
                }),
                loadWordMasteryState(getActiveUserId(), db),
                loadWrongBook(getActiveUserId(), db)
            ]);
            WORD_DATABASE = Array.isArray(words) ? words : [];
            if (accessLimits.isTrial) {
                const banner = container.querySelector("#sen-trial-banner");
                if (banner) banner.classList.remove("hidden");
                const upBtn = container.querySelector("#sen-upgrade-btn");
                if (upBtn) upBtn.onclick = () => openUpgradeGate();
            }
            WORD_MASTERY = masteryState.masteryMap || {};
            WRONG_BOOK = wrongBook || createEmptyWrongBook();
            MASTERY_THRESHOLD = masteryState.threshold || DEFAULT_MASTERY_THRESHOLD;
            statusTitle.textContent = `💬 生活情境句子選擇題 (共 ${WORD_DATABASE.length} 筆${accessLimits.isTrial ? '｜試用版' : ''})`;
            refreshMasterySummaryUI();
            refreshWrongBookUI();
        } catch (err) {
            console.error(err);
            statusTitle.textContent = "❌ 資料載入失敗";
        }

        container.querySelector("#sen-start-btn").onclick = async () => {
            if (WORD_DATABASE.length === 0) {
                alert("資料仍在載入中，請稍候！");
                return;
            }

            const countRadios = container.querySelectorAll('input[name="sen-count"]');
            for (let r of countRadios) { if (r.checked) quizCountSetting = r.value; }

            if (quizCountSetting === 'wrong') {
                const wrongWords = getWrongPoolWords(WORD_DATABASE, WRONG_BOOK, POOL_RECOGNITION, 10);
                if (wrongWords.length === 0) {
                    alert("目前沒有待複習的認讀錯題！");
                    refreshWrongBookUI();
                    return;
                }
                activeQuizPool = wrongWords;
            } else {
                excludeMastered = Boolean(container.querySelector("#sen-exclude-mastered")?.checked ?? true);
                activeQuizPool = buildFilteredQuizPool(WORD_DATABASE, WORD_MASTERY, MASTERY_THRESHOLD, !excludeMastered);
                if (activeQuizPool.length === 0) {
                    alert("目前所有單字皆已熟練或手動排除！請取消勾選「排除已熟練與手動略過單字」進行總複習，或至個人資料頁調整。");
                    return;
                }
            }

            if (store && typeof store.resetStreakPoints === "function") {
                await store.resetStreakPoints();
            }

            container.querySelector("#sen-config-panel").classList.add("hidden");
            container.querySelector("#sen-quiz-panel").classList.remove("hidden");

            startQuizSession();
        };

        function shuffleArray(array) {
            let arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function fetchSentencesForBatch(startIndex, count, callback) {
            let endIndex = Math.min(startIndex + count, quizList.length);
            let idsToFetch = [];

            for (let i = startIndex; i < endIndex; i++) {
                let wObj = quizList[i];
                let idKey = wObj?._idKey;
                if (idKey && !getCachedSentence(idKey)) {
                    idsToFetch.push(idKey);
                }
            }

            if (idsToFetch.length === 0) {
                if (callback) callback();
                return;
            }

            fetchSentencesOnDemand(db, idsToFetch)
                .then(() => {
                    if (callback) callback();
                })
                .catch(err => {
                    console.error("按需撈取例句失敗:", err);
                    if (callback) callback();
                });
        }

        function startQuizSession() {
            score = 0;
            wrongCount = 0;
            lives = 3;
            currentIndex = 0;
            sessionSettled = false;
            sessionReviewLog = [];

            let limit = 10;
            if (quizCountSetting === 'wrong') {
                const wrongPool = [...activeQuizPool];
                limit = Math.min(10, wrongPool.length);
                quizList = shuffleArray(wrongPool).slice(0, limit);
            } else {
                const pool = activeQuizPool.length > 0
                    ? [...activeQuizPool]
                    : buildFilteredQuizPool(WORD_DATABASE, WORD_MASTERY, MASTERY_THRESHOLD, !excludeMastered);
                limit = (quizCountSetting === 'infinite')
                    ? Math.min(10, pool.length)
                    : Math.min(parseInt(quizCountSetting) || 10, pool.length);
                quizList = shuffleArray(pool.slice(0, Math.max(limit, Math.floor(pool.length * 0.5)))).slice(0, limit);
            }

            if (quizCountSetting === 'infinite') {
                container.querySelector("#sen-lives-container").classList.remove('hidden');
                updateLivesDisplay();
            } else {
                container.querySelector("#sen-lives-container").classList.add('hidden');
            }

            // 先載入前 3 題立即開考，其餘題目於背景預載（兼顧速度與按需載入）
            const initialBatch = Math.min(3, limit);
            statusTitle.textContent = "⏳ 正在從雲端載入情境例句...";
            fetchSentencesForBatch(0, initialBatch, () => {
                statusTitle.textContent = quizCountSetting === 'wrong'
                    ? `📌 生活情境句子｜認讀錯題複習`
                    : `💬 生活情境句子選擇題`;
                renderQuestion();
                if (limit > initialBatch) {
                    fetchSentencesForBatch(initialBatch, limit - initialBatch);
                }
            });
        }

        function updateLivesDisplay() {
            let hearts = "";
            for (let i = 0; i < 3; i++) {
                hearts += (i < lives) ? "❤️" : "🖤";
            }
            container.querySelector("#sen-lives-container").textContent = hearts;
        }

        async function settleSentencesSession() {
            if (sessionSettled) return 0;
            sessionSettled = true;

            const fallbackPoints = window.UserStore
                ? UserStore.calcPracticePoints("sentences", score)
                : score * 5;

            let earnedPoints = fallbackPoints;

            try {
                if (typeof window.recordPracticeResult === "function") {
                    const res = await window.recordPracticeResult("sentences", { correctCount: score });
                    if (res && typeof res.earnedPoints === "number") {
                        earnedPoints = res.earnedPoints;
                    }
                } else if (store) {
                    await store.updateProfile((profile) => {
                        profile.points = Number(profile.points || 0) + fallbackPoints;
                        profile.practiceStats.sentences = Number(profile.practiceStats.sentences || 0) + 1;
                        profile.practiceStats.totalCount = Number(profile.practiceStats.totalCount || 0) + 1;
                        profile.questionStats.sentences = Number(profile.questionStats.sentences || 0) + score;
                    });
                }

                const activeId = store ? store.getState().userId : currentLicenseKey;
                const latestPoints = store ? store.getState().profile.points : null;
                if (activeId && activeId !== "GUEST" && activeId !== "50TEST" && typeof latestPoints === "number") {
                    await db.ref(`licenses/${activeId}`).update({ coins: latestPoints });
                }

                if (typeof window.forceSyncHeaderFromStore === "function") {
                    window.forceSyncHeaderFromStore();
                }
            } catch (err) {
                console.error("情境句子練習同步失敗:", err);
            }

            return earnedPoints;
        }

        function getSmartDistractors(correctVal, correctPos) {
            let pool = WORD_DATABASE.filter(w => {
                let itemVal = String(w.word || w.單字 || "").trim();
                let pItem = String(w.pos || w.詞性 || "").trim();
                return itemVal.toLowerCase() !== correctVal.toLowerCase() && pItem === correctPos;
            });

            if (pool.length < 3) {
                const restPool = WORD_DATABASE.filter(w => {
                    let itemVal = String(w.word || w.單字 || "").trim();
                    return itemVal.toLowerCase() !== correctVal.toLowerCase() && !pool.includes(w);
                });
                pool = pool.concat(restPool);
            }

            pool = shuffleArray(pool);
            let options = [correctVal];
            for (let i = 0; i < 3 && i < pool.length; i++) {
                let val = String(pool[i].word || pool[i].單字 || "").trim();
                if (val && !options.includes(val)) options.push(val);
            }
            return shuffleArray(options);
        }

        function renderQuestion() {
            answered = false;
            const q = quizList[currentIndex % quizList.length];
            const totalStr = quizCountSetting === 'infinite' ? '∞' : quizList.length;

            container.querySelector("#sen-stat-correct").textContent = score;
            container.querySelector("#sen-stat-wrong").textContent = wrongCount;

            const submitBtn = container.querySelector("#sen-btn-submit");
            const nextBtn = container.querySelector("#sen-btn-next");
            submitBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden');

            const feedback = container.querySelector("#sen-feedback-box");
            feedback.style.opacity = '0';
            feedback.className = "p-4 rounded-xl font-medium text-sm min-h-[56px] flex items-center bg-slate-900 border border-slate-700 text-slate-300";
            feedback.innerHTML = "請作答...";

            const word = String(q.word || q.單字 || "").trim();
            const pos = q.pos || q.詞性 || "";

            let cachedSens = getCachedSentence(q._idKey) || {};
            let availableSentences = [];
            for (let i = 1; i <= 5; i++) {
                let sText = cachedSens[`sen${i}`];
                let sZh = cachedSens[`sen_zh${i}`];
                if (sText && String(sText).trim() !== "") {
                    availableSentences.push({ sentence: String(sText).trim(), zh: String(sZh || "").trim() });
                }
            }

            let selectedSen = {
                sentence: `Always practice (${word}) in your daily life.`,
                zh: `在日常生活中隨時練習 ${word}。`
            };

            if (availableSentences.length > 0) {
                selectedSen = availableSentences[Math.floor(Math.random() * availableSentences.length)];
            }

            const match = selectedSen.sentence.match(/\(([^)]+)\)/);
            currentCorrectAnswer = match ? match[1] : word;
            let maskedSentence = selectedSen.sentence.replace(/\([^)]+\)/, '(_____)');
            const options = getSmartDistractors(currentCorrectAnswer, pos);

            const qContainer = container.querySelector("#sen-question-content");
            qContainer.innerHTML = `
                <div>
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="text-xs bg-blue-950 text-blue-300 px-3 py-1 rounded-full font-black border border-blue-800">生活情境句子測驗 (${currentIndex + 1}/${totalStr})</span>
                        <button type="button" id="sen-exclude-word-btn" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 hover:bg-rose-900/70 text-slate-300 hover:text-rose-200 border border-slate-700 transition cursor-pointer">
                            🚫 不再考此字
                        </button>
                    </div>
                    <h3 class="text-lg font-black mt-3 text-slate-100">請依據上下文與中文提示，選出最適當的單字填入空格：</h3>
                    <p class="text-xs text-sky-300 mt-1">💡 中文翻譯：${selectedSen.zh}</p>
                </div>
                <div class="p-5 bg-slate-900 rounded-xl border border-slate-700 text-base sm:text-lg font-bold tracking-wide text-emerald-400">
                    ${maskedSentence}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    ${options.map((opt, i) => `
                        <label class="flex items-center p-4 rounded-xl border-2 border-slate-700 hover:border-blue-500 cursor-pointer transition font-bold bg-slate-900 text-slate-200">
                            <input type="radio" name="sen-quiz-opt" value="${opt}" class="w-4 h-4 text-blue-500">
                            <span class="ml-3">(${String.fromCharCode(65 + i)}) ${opt}</span>
                        </label>
                    `).join('')}
                </div>
            `;

            const excludeBtn = qContainer.querySelector("#sen-exclude-word-btn");
            if (excludeBtn && q._idKey) {
                excludeBtn.onclick = async () => {
                    excludeBtn.disabled = true;
                    await setWordExcluded(getActiveUserId(), db, q._idKey, true, WORD_MASTERY);
                    await removeWordsFromAllWrongPools(getActiveUserId(), db, q._idKey, WRONG_BOOK);
                    activeQuizPool = activeQuizPool.filter(w => w._idKey !== q._idKey);
                    excludeBtn.textContent = "✓ 已排除";
                    excludeBtn.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700";
                    refreshMasterySummaryUI();
                    refreshWrongBookUI();
                };
            }
        }

        container.querySelector("#sen-btn-submit").onclick = async () => {
            if (answered) return;
            const selected = container.querySelector('input[name="sen-quiz-opt"]:checked');
            const feedback = container.querySelector("#sen-feedback-box");

            if (!selected) {
                alert("請先選擇一個選項！");
                return;
            }

            answered = true;
            feedback.style.opacity = '1';

            const currentQ = quizList[currentIndex % quizList.length];
            let userVal = selected.value.trim().toLowerCase();
            let correctBase = currentCorrectAnswer.trim().toLowerCase();
            let isCorrect = (userVal === correctBase) || (userVal === correctBase + 's') || (userVal === correctBase + 'es');

            const attemptRes = currentQ?._idKey
                ? await recordWordAttempt(getActiveUserId(), db, currentQ._idKey, isCorrect, WORD_MASTERY, MASTERY_THRESHOLD)
                : { justMastered: false };
            if (attemptRes.justMastered) {
                activeQuizPool = activeQuizPool.filter(w => w._idKey !== currentQ._idKey);
            }

            // 錯題紀錄：錯題模式先記錄本輪對錯供結束勾選整理；一般模式答錯即寫入「認錯池」
            if (currentQ?._idKey) {
                if (quizCountSetting === 'wrong') {
                    sessionReviewLog.push({
                        idKey: currentQ._idKey,
                        word: String(currentQ.word || currentQ.單字 || "").trim(),
                        zh: String(currentQ.zh || currentQ.中文解釋 || "").trim(),
                        isCorrect
                    });
                } else if (!isCorrect) {
                    await recordWrongWord(getActiveUserId(), db, POOL_RECOGNITION, currentQ._idKey, WRONG_BOOK);
                    refreshWrongBookUI();
                }
            }
            refreshMasterySummaryUI();

            if (isCorrect) {
                score++;
                container.querySelector("#sen-stat-correct").textContent = score;
                feedback.className = "p-4 rounded-xl font-medium text-sm min-h-[56px] flex items-center bg-emerald-950 border border-emerald-700 text-emerald-200 font-bold";
                feedback.innerHTML = attemptRes.justMastered
                    ? `✓ 回答正確！🎉 已累積答對 ${MASTERY_THRESHOLD} 次，標記為熟練（後續不再出題）`
                    : `✓ 回答正確！自動前往下一題...`;

                setTimeout(() => {
                    nextQuestionFlow();
                }, attemptRes.justMastered ? 1100 : 750);
            } else {
                wrongCount++;
                container.querySelector("#sen-stat-wrong").textContent = wrongCount;

                if (quizCountSetting === 'infinite') {
                    lives--;
                    updateLivesDisplay();
                }

                feedback.className = "p-4 rounded-xl font-medium text-sm min-h-[56px] flex items-center bg-rose-950 border border-rose-700 text-rose-200 font-bold";
                feedback.innerHTML = `✗ 回答錯誤，正確答案為：<span class="underline ml-1 font-black">${currentCorrectAnswer}</span>`;

                if (quizCountSetting === 'infinite' && lives <= 0) {
                    setTimeout(async () => {
                        const earned = await settleSentencesSession();
                        await showQuizResultModal({
                            unitName: "生活情境句子選擇題",
                            mode: "infinite",
                            score,
                            wrongCount,
                            totalQuestions: score + wrongCount,
                            earnedPoints: earned,
                            primaryText: "再挑戰一次"
                        });
                        refreshMasterySummaryUI();
                        refreshWrongBookUI();
                        container.querySelector("#sen-quiz-panel")?.classList.add("hidden");
                        container.querySelector("#sen-config-panel")?.classList.remove("hidden");
                    }, 1000);
                } else {
                    container.querySelector("#sen-btn-submit").classList.add('hidden');
                    container.querySelector("#sen-btn-next").classList.remove('hidden');
                }
            }
        };

        container.querySelector("#sen-btn-next").onclick = () => {
            nextQuestionFlow();
        };

        async function nextQuestionFlow() {
            if (quizCountSetting !== 'infinite' && currentIndex >= quizList.length - 1) {
                if (quizCountSetting === 'wrong' && sessionReviewLog.length > 0) {
                    const decisions = await showWrongReviewModal({
                        poolLabel: "認讀錯題複習",
                        items: sessionReviewLog
                    });
                    await batchApplyWrongReview(getActiveUserId(), db, POOL_RECOGNITION, decisions, WRONG_BOOK);
                    refreshWrongBookUI();
                }

                const earned = await settleSentencesSession();
                await showQuizResultModal({
                    unitName: quizCountSetting === 'wrong' ? "生活情境句子｜認讀錯題複習" : "生活情境句子選擇題",
                    mode: "normal",
                    score,
                    wrongCount,
                    totalQuestions: quizList.length,
                    earnedPoints: earned,
                    primaryText: "再練一次"
                });
                refreshMasterySummaryUI();
                refreshWrongBookUI();
                container.querySelector("#sen-quiz-panel")?.classList.add("hidden");
                container.querySelector("#sen-config-panel")?.classList.remove("hidden");
            } else {
                currentIndex++;
                if (quizCountSetting === 'infinite' && currentIndex >= quizList.length - 3) {
                    let refillBase = activeQuizPool.length > 0 ? activeQuizPool : WORD_DATABASE;
                    let moreWords = shuffleArray(refillBase).slice(0, 10);
                    quizList = quizList.concat(moreWords);
                    fetchSentencesForBatch(quizList.length - moreWords.length, moreWords.length, () => {
                        renderQuestion();
                    });
                } else {
                    let q = quizList[currentIndex % quizList.length];
                    if (q && q._idKey && !getCachedSentence(q._idKey)) {
                        fetchSentencesForBatch(currentIndex, 1, () => {
                            renderQuestion();
                        });
                    } else {
                        renderQuestion();
                    }
                }
            }
        }
    },

    destroy: function() {
        console.log("Sentences module destroyed.");
    }
};