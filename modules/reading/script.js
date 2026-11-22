// 直接在模組內引入 Firebase v9 相容版 SDK
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
import { getAccessLimits, openUpgradeGate } from "../../assets/js/accessGate.js";

export default {
    id: "reading",

    init: async function(container) {
        const store = window.UserStore;
        const currentLicenseKey = store
            ? store.getState().userId
            : (localStorage.getItem("boshen_license_key") || "TEST01");

        container.innerHTML = `
            <div class="space-y-4" style="padding-bottom: 40px;">
                <!-- 頂部控制與導覽列 -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between theme-card p-4 rounded-2xl border border-slate-200 shadow-sm gap-3 flex-wrap" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <div class="flex items-center space-x-3 flex-wrap gap-2">
                        <button id="reading-back-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-slate-200">← 返回大廳</button>

                        <!-- 模式切換 Checkbox -->
                        <label class="flex items-center space-x-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 font-bold text-sky-400 text-xs">
                            <input type="checkbox" id="reading-mode-checkbox" checked class="w-4 h-4 text-sky-500 rounded focus:ring-sky-400">
                            <span>下拉選單模式</span>
                        </label>

                        <!-- 難度層級篩選下拉選單 -->
                        <select id="reading-difficulty-filter" class="px-3 py-1.5 border-2 border-slate-700 rounded-xl bg-slate-900 font-bold text-sky-400 text-xs focus:outline-none focus:border-sky-500 shadow-sm">
                            <option value="all">全部難度</option>
                            <option value="elem1">elem1（基礎）</option>
                            <option value="elem2">elem2（中階）</option>
                            <option value="elem3">elem3（進階）</option>
                        </select>

                        <!-- 文章標題清單選單 -->
                        <select id="reading-article-selector" class="w-48 sm:w-60 px-3 py-1.5 border-2 border-slate-700 rounded-xl bg-slate-900 font-bold text-sky-400 text-xs focus:outline-none focus:border-sky-500 shadow-sm truncate">
                            <option value="">載入文章清單中...</option>
                        </select>
                    </div>
                    <h2 class="font-black text-sky-400">📖 雲端克漏字閱讀測驗</h2>
                </div>

                <!-- 測驗內容呈現區 -->
                <div class="theme-card p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <div id="reading-trial-banner" class="hidden flex items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200">
                        <span>🔒 試用版開放 2 篇 elem1 閱讀測驗，開通序號可解鎖全部難度與文章</span>
                        <button type="button" id="reading-upgrade-btn" class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shrink-0 cursor-pointer">輸入序號</button>
                    </div>
                    <div id="reading-content-area" class="space-y-6">
                        <p class="text-slate-400 text-center py-6">⏳ 正在從 Firebase 載入閱讀測驗資料...</p>
                    </div>
                </div>
            </div>
        `;

        container.querySelector("#reading-back-btn").onclick = () => {
            window.location.hash = "lobby";
        };

        if (!firebase.apps.length) {
            firebase.initializeApp({
                databaseURL: "https://chtreadingcompre-default-rtdb.firebaseio.com/"
            });
        }
        const db = firebase.database();

        let allClozeQuizzes = {};
        let filteredArticleKeys = [];
        let currentQuizKey = null;
        let submittedQuizKeys = new Set();

        function shuffleArray(array) {
            let arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        const area = container.querySelector('#reading-content-area');
        const diffFilter = container.querySelector('#reading-difficulty-filter');
        const articleSelector = container.querySelector('#reading-article-selector');
        const modeCheckbox = container.querySelector('#reading-mode-checkbox');

        diffFilter.onchange = () => populateArticleSelector();
        articleSelector.onchange = (e) => switchArticle(e.target.value);
        modeCheckbox.onchange = () => {
            if (currentQuizKey && allClozeQuizzes[currentQuizKey]) {
                renderClozeQuizContent(allClozeQuizzes[currentQuizKey], modeCheckbox.checked);
            }
        };

        try {
            const snapshot = await db.ref('reading_quizzes').once('value');
            const data = snapshot.val();
            if (!data) {
                area.innerHTML = `<p class="text-rose-400 text-center py-6 font-bold">⚠️ 目前 Firebase 中尚未找到「reading_quizzes」節點的資料。</p>`;
                return;
            }
            const accessLimits = getAccessLimits();
            if (accessLimits.isTrial) {
                const targetDiff = (accessLimits.readingDifficulty || "elem1").toLowerCase();
                const elem1Keys = Object.keys(data).filter((k) => {
                    const q = data[k];
                    return q && String(q.difficulty || "").toLowerCase() === targetDiff;
                });
                const trialKeys = elem1Keys.slice(0, accessLimits.readingLimit);
                allClozeQuizzes = {};
                trialKeys.forEach((k) => { allClozeQuizzes[k] = data[k]; });

                diffFilter.innerHTML = `<option value="elem1">elem1 (試用開放 ${trialKeys.length} 篇)</option>`;
                diffFilter.value = "elem1";

                const banner = container.querySelector("#reading-trial-banner");
                if (banner) banner.classList.remove("hidden");
                const upBtn = container.querySelector("#reading-upgrade-btn");
                if (upBtn) upBtn.onclick = () => openUpgradeGate();
            } else {
                allClozeQuizzes = data;
            }
            populateArticleSelector();
        } catch (err) {
            console.error(err);
            area.innerHTML = `<p class="text-rose-400 text-center py-6 font-bold">❌ 載入失敗：${err.message}</p>`;
        }

        function populateArticleSelector() {
            const level = diffFilter.value;
            articleSelector.innerHTML = '';

            const keys = Object.keys(allClozeQuizzes);
            const filteredKeys = keys.filter(key => {
                const quiz = allClozeQuizzes[key];
                if (level === 'all') return true;
                return (quiz.difficulty || '').toLowerCase() === level.toLowerCase();
            });

            if (filteredKeys.length === 0) {
                filteredArticleKeys = [];
                articleSelector.innerHTML = `<option value="">此難度無文章</option>`;
                area.innerHTML = `<p class="text-slate-400 text-center py-6">⚠️ 此難度層級目前沒有文章。</p>`;
                currentQuizKey = null;
                return;
            }

            filteredArticleKeys = filteredKeys;
            filteredKeys.forEach((key, index) => {
                const quiz = allClozeQuizzes[key];
                const option = document.createElement('option');
                option.value = key;
                const diffTag = quiz.difficulty ? `[${quiz.difficulty}] ` : '';
                option.textContent = diffTag + (quiz.Title_E || quiz.Title_C || `第 ${index + 1} 篇`);
                articleSelector.appendChild(option);
            });

            currentQuizKey = filteredKeys[0];
            articleSelector.value = currentQuizKey;
            renderClozeQuizContent(allClozeQuizzes[currentQuizKey], modeCheckbox.checked);
        }

        function switchArticle(quizKey) {
            if (allClozeQuizzes[quizKey]) {
                currentQuizKey = quizKey;
                articleSelector.value = quizKey;
                renderClozeQuizContent(allClozeQuizzes[currentQuizKey], modeCheckbox.checked);
            }
        }

        function getNextArticleKey() {
            if (filteredArticleKeys.length <= 1) return null;
            const currentIdx = filteredArticleKeys.indexOf(currentQuizKey);
            // 優先找尚未作答過的下一篇，若都做過則依序切到下一篇
            for (let offset = 1; offset < filteredArticleKeys.length; offset++) {
                const candidateKey = filteredArticleKeys[(currentIdx + offset) % filteredArticleKeys.length];
                const ddDone = submittedQuizKeys.has(`${candidateKey}_dd`);
                const mcDone = submittedQuizKeys.has(`${candidateKey}_mc`);
                if (!ddDone && !mcDone) return candidateKey;
            }
            return filteredArticleKeys[(currentIdx + 1) % filteredArticleKeys.length];
        }

        function getDifficultyLabel(diff) {
            const d = String(diff || "elem1").toLowerCase();
            if (d === "elem1") return "elem1（基礎）";
            if (d === "elem2") return "elem2（中階）";
            if (d === "elem3") return "elem3（進階）";
            return diff || "基礎";
        }

        function renderClozeQuizContent(quiz, isDropdownMode) {
            let formattedPassage = quiz.essay || "";
            let interactiveQuestionsHtml = '';

            if (isDropdownMode) {
                if (quiz.questions && Array.isArray(quiz.questions)) {
                    quiz.questions.forEach((q) => {
                        let optionsHtml = `<span class="inline-flex items-center flex-wrap gap-1 align-middle"><select id="ans_${q.id}" class="mx-1 px-3 py-1.5 border-2 border-slate-700 rounded-lg bg-slate-900 font-bold text-sky-400 focus:outline-none focus:border-sky-500 shadow-sm">`;
                        optionsHtml += `<option value="">(${q.id}) 請選擇答案</option>`;
                        if (q.options && Array.isArray(q.options)) {
                            let shuffledOpts = shuffleArray(q.options);
                            shuffledOpts.forEach(opt => {
                                optionsHtml += `<option value="${opt}">${opt}</option>`;
                            });
                        }
                        optionsHtml += `</select><span id="ans_badge_${q.id}" class="hidden text-xs font-black px-2 py-0.5 rounded-md"></span></span>`;
                        formattedPassage = formattedPassage.replace(`{${q.blank_key}}`, optionsHtml);
                    });
                }
            } else {
                if (quiz.questions && Array.isArray(quiz.questions)) {
                    quiz.questions.forEach((q) => {
                        let blankTag = `<span class="font-black text-sky-400">(${q.id}) ________</span>`;
                        formattedPassage = formattedPassage.replace(`{${q.blank_key}}`, blankTag);
                    });

                    quiz.questions.forEach((q) => {
                        let optionsHtml = '';
                        if (q.options && Array.isArray(q.options)) {
                            let shuffledOpts = shuffleArray(q.options);
                            shuffledOpts.forEach((opt, optIdx) => {
                                let optLetter = String.fromCharCode(65 + optIdx);
                                optionsHtml += `
                                    <label class="reading-radio-opt flex items-center p-3 rounded-xl border-2 border-slate-700 hover:border-sky-400 cursor-pointer transition font-bold text-sm bg-slate-900 text-slate-200" data-qid="${q.id}" data-val="${opt}">
                                        <input type="radio" name="question_${q.id}" value="${opt}" class="w-4 h-4 text-sky-400 shrink-0">
                                        <span class="ml-3">(${optLetter}) ${opt}</span>
                                    </label>
                                `;
                            });
                        }

                        interactiveQuestionsHtml += `
                            <div class="space-y-3 p-5 bg-slate-900 rounded-xl border border-slate-700" data-question-box="${q.id}">
                                <div class="font-bold text-slate-200 text-base">
                                    第 ${q.id} 題：請選出最適當的答案
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    ${optionsHtml}
                                </div>
                            </div>
                        `;
                    });
                }
            }

            let paragraphs = formattedPassage.split('\n');
            let processedPassageHtml = paragraphs.map(p => {
                if (!p.trim()) return '';
                return `<p class="mb-3" style="text-indent: 2em; line-height: 2.2;">${p.trim()}</p>`;
            }).join('');

            const nextKeyPreview = getNextArticleKey();
            const hasNextArticle = Boolean(nextKeyPreview);

            area.innerHTML = `
                <div class="space-y-6">
                    <div>
                        <h3 class="text-2xl font-black text-sky-400">${quiz.Title_E || '閱讀克漏字測驗'}</h3>
                        <p class="text-xs text-slate-400 mt-1">中文標題：${quiz.Title_C || '未提供'} ｜ 難度：${getDifficultyLabel(quiz.difficulty)}</p>
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <h4 class="font-bold text-slate-300">📖 閱讀文章</h4>
                        </div>
                        <div class="text-slate-200 leading-relaxed text-lg bg-slate-900 p-6 rounded-xl border-2 border-slate-700 shadow-inner">
                            ${processedPassageHtml}
                        </div>
                    </div>

                    ${!isDropdownMode ? `
                        <div class="space-y-4 pt-2">
                            <h4 class="font-bold text-slate-300">✍️ 題目作答</h4>
                            ${interactiveQuestionsHtml}
                        </div>
                    ` : ''}

                    <!-- 交卷按鈕列（交卷後隱藏，改由下方成績結算卡取代） -->
                    <div id="reading-submit-bar" class="flex justify-end border-t border-slate-700 pt-4">
                        <button id="submit-reading-btn" class="w-full sm:w-auto px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl shadow transition cursor-pointer">
                            ✅ 送出交卷並看解析
                        </button>
                    </div>

                    <!-- 交卷後的頁內成績結算卡（取代彈窗，不打斷閱讀解析） -->
                    <div id="reading-score-card" class="hidden p-5 rounded-2xl border-2 border-sky-500/50 bg-slate-900/95 shadow-lg space-y-2">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/40">本篇測驗結算</span>
                                <div id="reading-score-display" class="text-xl font-black text-sky-300 mt-1"></div>
                            </div>
                            <span id="reading-sync-badge" class="text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 px-3 py-1 rounded-full self-start sm:self-center">
                                ✓ 成績已同步
                            </span>
                        </div>
                        <p class="text-xs text-slate-400">上方文章空格已用綠／紅框標示對錯，請檢視下方逐題解析與中文翻譯。</p>
                    </div>

                    <!-- 逐題解析、中文翻譯與收尾操作列 -->
                    <div id="reading-explanation-container" class="hidden space-y-6 pt-2">
                        <div>
                            <h4 class="text-lg font-bold text-slate-200 mb-3">📝 逐題解析</h4>
                            <div id="reading-explanation-list" class="space-y-3"></div>
                        </div>
                        <div class="border-t border-slate-700 pt-4">
                            <h4 class="text-lg font-bold text-slate-200 mb-2">🇹🇼 中文翻譯</h4>
                            <div class="text-slate-300 bg-slate-900 p-5 rounded-xl whitespace-pre-line border border-slate-700 leading-relaxed">${quiz.CHTessay || '暫無中文翻譯'}</div>
                        </div>

                        <!-- 看完解析後的下一步操作列 -->
                        <div class="border-t border-slate-700 pt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                            <button type="button" id="reading-lobby-btn" class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm transition cursor-pointer">
                                🏠 返回學習大廳
                            </button>
                            <button type="button" id="reading-retry-btn" class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-bold text-sm transition cursor-pointer">
                                🔄 重做本篇
                            </button>
                            ${hasNextArticle ? `
                                <button type="button" id="reading-next-article-btn" class="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm shadow transition cursor-pointer">
                                    ➡️ 繼續挑戰下一篇
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            container.querySelector("#submit-reading-btn").onclick = () => {
                submitReadingQuiz(quiz, isDropdownMode);
            };

            const lobbyBtn = container.querySelector("#reading-lobby-btn");
            if (lobbyBtn) {
                lobbyBtn.onclick = () => {
                    window.location.hash = "lobby";
                };
            }

            const retryBtn = container.querySelector("#reading-retry-btn");
            if (retryBtn) {
                retryBtn.onclick = () => {
                    renderClozeQuizContent(quiz, modeCheckbox.checked);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                };
            }

            const nextBtn = container.querySelector("#reading-next-article-btn");
            if (nextBtn) {
                nextBtn.onclick = () => {
                    const nextKey = getNextArticleKey();
                    if (nextKey) {
                        switchArticle(nextKey);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                };
            }
        }

        async function submitReadingQuiz(quiz, isDropdownMode) {
            const questions = quiz?.questions;
            if (!questions || !Array.isArray(questions)) return;

            // 先檢查是否有漏填題目，避免誤按交卷
            let unansweredCount = 0;
            questions.forEach((q) => {
                if (isDropdownMode) {
                    const selectElem = container.querySelector(`#ans_${q.id}`);
                    if (!selectElem || !selectElem.value) unansweredCount++;
                } else {
                    const selectedOption = container.querySelector(`input[name="question_${q.id}"]:checked`);
                    if (!selectedOption) unansweredCount++;
                }
            });
            if (unansweredCount > 0) {
                const proceed = window.confirm(`還有 ${unansweredCount} 題尚未作答，確定要直接交卷看解析嗎？`);
                if (!proceed) return;
            }

            // 隱藏交卷按鈕，避免已看解析卻還留著送出按鈕
            container.querySelector("#reading-submit-bar")?.classList.add("hidden");

            let quizScore = 0;
            let correctCount = 0;
            let totalQuestions = questions.length;
            let pointsPerQuestion = Math.round(100 / totalQuestions);
            let explanationHtml = '';

            questions.forEach((q) => {
                const correctAns = String(q.answer || "").trim();
                let userSelect = "";

                if (isDropdownMode) {
                    const selectElem = container.querySelector(`#ans_${q.id}`);
                    const badgeElem = container.querySelector(`#ans_badge_${q.id}`);
                    userSelect = selectElem ? selectElem.value : "";
                    const isCorrect = (userSelect.trim().toLowerCase() === correctAns.toLowerCase());

                    if (selectElem) {
                        selectElem.disabled = true;
                        selectElem.classList.remove("border-slate-700", "text-sky-400");
                        if (isCorrect) {
                            selectElem.classList.add("border-emerald-500", "bg-emerald-950/60", "text-emerald-300");
                        } else {
                            selectElem.classList.add("border-rose-500", "bg-rose-950/60", "text-rose-300");
                        }
                    }
                    if (badgeElem) {
                        badgeElem.classList.remove("hidden");
                        if (isCorrect) {
                            badgeElem.textContent = "✓";
                            badgeElem.className = "text-xs font-black px-1.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-600 text-emerald-300";
                        } else {
                            badgeElem.textContent = `正解：${correctAns}`;
                            badgeElem.className = "text-xs font-black px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-600 text-emerald-300";
                        }
                    }
                } else {
                    const radios = container.querySelectorAll(`input[name="question_${q.id}"]`);
                    const selectedOption = container.querySelector(`input[name="question_${q.id}"]:checked`);
                    userSelect = selectedOption ? selectedOption.value : "";
                    const isCorrect = (userSelect.trim().toLowerCase() === correctAns.toLowerCase());

                    radios.forEach((r) => {
                        r.disabled = true;
                        const label = r.closest(".reading-radio-opt");
                        if (!label) return;
                        const optVal = String(r.value || "").trim().toLowerCase();
                        label.classList.remove("border-slate-700", "hover:border-sky-400");
                        if (optVal === correctAns.toLowerCase()) {
                            label.classList.add("border-emerald-500", "bg-emerald-950/45", "text-emerald-200");
                        } else if (r.checked && !isCorrect) {
                            label.classList.add("border-rose-500", "bg-rose-950/45", "text-rose-200");
                        } else {
                            label.classList.add("border-slate-800", "opacity-70");
                        }
                    });
                }

                const isCorrect = (userSelect.trim().toLowerCase() === correctAns.toLowerCase());
                if (isCorrect) {
                    quizScore += pointsPerQuestion;
                    correctCount++;
                }

                explanationHtml += `
                    <div class="p-4 rounded-xl border ${isCorrect ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-rose-950/60 border-rose-700 text-rose-200'}">
                        <div class="font-bold mb-1 flex items-center flex-wrap gap-2">
                            <span>第 ${q.id} 題：正確答案為「<span class="text-sky-300 font-black">${correctAns}</span>」</span>
                            ${isCorrect
                                ? '<span class="text-emerald-300 font-black">✅ 答對</span>'
                                : `<span class="text-rose-300 font-black">❌ 你的答案：${userSelect || '未作答'}</span>`}
                        </div>
                        <div class="text-slate-300 text-sm leading-relaxed">${q.explanation || '暫無詳細解析'}</div>
                    </div>
                `;
            });

            // 全部答對時確保顯示 100 分（避免四捨五入誤差）
            if (correctCount === totalQuestions && totalQuestions > 0) {
                quizScore = 100;
            }

            const level = quiz.difficulty || 'elem1';
            const fallbackPoints = window.UserStore
                ? UserStore.calcPracticePoints("reading", correctCount, { level })
                : correctCount * 5;

            let earnedPoints = 0;
            const sessionKey = `${currentQuizKey || quiz.Title_E || 'article'}_${isDropdownMode ? 'dd' : 'mc'}`;
            const alreadySubmitted = submittedQuizKeys.has(sessionKey);
            if (!alreadySubmitted) {
                submittedQuizKeys.add(sessionKey);
                earnedPoints = fallbackPoints;
                try {
                    if (typeof window.recordPracticeResult === "function") {
                        const res = await window.recordPracticeResult(
                            "reading",
                            { correctCount, level },
                            { resetStreakBefore: true }
                        );
                        if (res && typeof res.earnedPoints === "number") {
                            earnedPoints = res.earnedPoints;
                        }
                    } else if (store) {
                        await store.updateProfile((profile) => {
                            profile.points = Number(profile.points || 0) + fallbackPoints;
                            profile.practiceStats.reading = Number(profile.practiceStats.reading || 0) + 1;
                            profile.practiceStats.totalCount = Number(profile.practiceStats.totalCount || 0) + 1;
                            profile.questionStats.reading = Number(profile.questionStats.reading || 0) + 1;
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
                    console.error("閱讀測驗同步失敗:", err);
                }
            }

            const pointsLabel = alreadySubmitted
                ? "本篇已計分，重複練習 +0 點"
                : `獲得 +${earnedPoints} 點`;
            const scoreCard = container.querySelector('#reading-score-card');
            const scoreDisplay = container.querySelector('#reading-score-display');
            const syncBadge = container.querySelector('#reading-sync-badge');

            if (scoreDisplay) {
                scoreDisplay.innerHTML = `${quizScore} 分 <span class="text-sm font-bold text-slate-300 ml-1">（答對 ${correctCount} / ${totalQuestions} 題｜<span class="text-emerald-300">${pointsLabel}</span>）</span>`;
            }
            if (syncBadge) {
                syncBadge.textContent = alreadySubmitted ? "✓ 重複練習模式" : "✓ 成績與點數已同步";
            }
            if (scoreCard) {
                scoreCard.classList.remove('hidden');
            }

            container.querySelector('#reading-explanation-list').innerHTML = explanationHtml;
            container.querySelector('#reading-explanation-container').classList.remove('hidden');

            scoreCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    destroy: function() {
        console.log("Reading module destroyed.");
    }
};