// modules/profile/progress.js
// 學習進度統計子模組：相容 UserStore (questionStats / practiceStats) 與舊版 userData.progress

export function renderProgressSection(container, state) {
    if (!container) return;

    const userData = (state && state.userData) || {};
    const store = window.UserStore;
    const storeProfile = store ? store.getState().profile : null;
    const progress = userData.progress || {};
    const qStats = storeProfile?.questionStats || userData.questionStats || {};
    const pStats = storeProfile?.practiceStats || userData.practiceStats || {};

    const vocabCount = Number(
        qStats.vocabulary ?? progress.vocab ?? pStats.vocabulary ?? 0
    ) || 0;

    const sentenceCount = Number(
        qStats.sentences ?? progress.sentence ?? pStats.sentences ?? 0
    ) || 0;

    // 克漏字與閱讀測驗卡片單位為「篇」
    const clozeCount = Number(
        pStats.cloze ?? qStats.cloze ?? progress.cloze ?? 0
    ) || 0;

    const readingCount = Number(
        pStats.reading ?? qStats.reading ?? progress.reading ?? 0
    ) || 0;

    const summedItems = vocabCount + sentenceCount + clozeCount + readingCount;
    const totalCount = Number(pStats.totalCount ?? userData.totalPractice ?? summedItems) || summedItems;

    container.innerHTML = `
        <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
            <div class="flex items-center justify-between pb-3 border-b border-slate-700">
                <div>
                    <h3 class="font-black text-base text-emerald-400">📊 學習進度統計</h3>
                    <p class="text-xs text-slate-400 mt-0.5">各單元已完成的練習題數與回合紀錄</p>
                </div>
                <div class="text-right">
                    <span class="text-[11px] text-slate-400 block">累計總練習</span>
                    <span id="prof-total-practices" class="text-lg font-black text-emerald-300">${totalCount} 次練習</span>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div class="text-xs font-bold text-sky-300">🔤 單字選擇</div>
                    <div id="prog-vocab" class="text-xl font-black text-white">${vocabCount} <span class="text-xs font-normal text-slate-400">題</span></div>
                </div>
                <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div class="text-xs font-bold text-indigo-300">💬 情境句子</div>
                    <div id="prog-sentence" class="text-xl font-black text-white">${sentenceCount} <span class="text-xs font-normal text-slate-400">題</span></div>
                </div>
                <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div class="text-xs font-bold text-amber-300">🧩 克漏字填空</div>
                    <div id="prog-cloze" class="text-xl font-black text-white">${clozeCount} <span class="text-xs font-normal text-slate-400">篇</span></div>
                </div>
                <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div class="text-xs font-bold text-rose-300">📖 閱讀測驗</div>
                    <div id="prog-reading" class="text-xl font-black text-white">${readingCount} <span class="text-xs font-normal text-slate-400">篇</span></div>
                </div>
            </div>
        </div>
    `;
}

export function bindProgressSection() {
    // 學習進度目前為純顯示區塊，無互動事件需綁定
}