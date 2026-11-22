// modules/profile/cardsSummary.js
// 資源與卡牌收藏摘要子模組：同步 UserStore 讓頂部狀態列與摘要卡片一致

export function renderCardsSummarySection(container, state) {
    if (!container) return;

    const userData = (state && state.userData) || {};
    const store = window.UserStore;
    const storeProfile = store ? store.getState().profile : null;

    const coins = Number(
        storeProfile?.points ?? userData.points ?? userData.coins ?? 0
    ) || 0;

    const totalMetaCards = Number(state?.totalMetaCards) || 0;
    const cardsObj = {
        ...(userData.cards || {}),
        ...(storeProfile?.cards || {})
    };

    let unlockedTypes = 0;
    let totalCopies = 0;
    let duplicateCopies = 0;

    Object.values(cardsObj).forEach(qty => {
        const n = Number(qty) || 0;
        if (n > 0) {
            unlockedTypes++;
            totalCopies += n;
            if (n > 1) {
                duplicateCopies += (n - 1);
            }
        }
    });

    container.innerHTML = `
        <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
            <div class="flex items-center justify-between gap-2">
                <h3 class="font-black text-base text-purple-300">🎒 資源與卡牌收藏摘要</h3>
                <button type="button" id="goto-card-btn"
                    class="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0">
                    前往卡牌圖鑑 →
                </button>
            </div>

            <div class="grid grid-cols-3 gap-3 text-center">
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div class="text-[11px] text-slate-400">持有積點</div>
                    <div class="text-lg font-black text-amber-400 mt-0.5">💰 <span id="prof-coins">${coins}</span></div>
                </div>
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div class="text-[11px] text-slate-400">圖鑑解鎖</div>
                    <div id="prof-card-unlocked" class="text-lg font-black text-purple-300 mt-0.5">${unlockedTypes} / ${totalMetaCards}</div>
                </div>
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div class="text-[11px] text-slate-400">可交換重複卡</div>
                    <div class="text-lg font-black text-emerald-300 mt-0.5"><span id="prof-card-dups">${duplicateCopies}</span> <span class="text-xs font-bold">張</span></div>
                </div>
            </div>
        </div>
    `;
}

export function bindCardsSummarySection(container) {
    if (!container) return;

    const gotoCardBtn = container.querySelector("#goto-card-btn");
    if (gotoCardBtn) {
        gotoCardBtn.onclick = () => {
            window.location.hash = "card";
        };
    }
}