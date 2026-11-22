// modules/profile/wordMasteryPanel.js
// 個人資料頁：單字熟練門檻設定與手動排除／恢復管理子模組

import {
    DEFAULT_MASTERY_THRESHOLD,
    MIN_MASTERY_THRESHOLD,
    MAX_MASTERY_THRESHOLD,
    isManualExcluded,
    isAutoMastered,
    isUltraBasicWord,
    getMasterySummary,
    saveMasteryThreshold,
    setWordExcluded,
    batchSetWordsExcluded,
    loadSharedWordBank
} from "../../assets/js/wordMastery.js";
import { removeWordsFromAllWrongPools } from "../../assets/js/wrongBook.js";

const PAGE_SIZE = 40;

const modalState = {
    isOpen: false,
    isLoadingWords: false,
    words: [],
    filterTab: "all", // "all" | "basic" | "manual" | "auto"
    searchQuery: "",
    visibleLimit: PAGE_SIZE,
    statusMsg: ""
};

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getFilteredWords(masteryMap, threshold) {
    const q = modalState.searchQuery.trim().toLowerCase();
    const limits = window.AccessGate?.getAccessLimits?.();
    const sourceWords = limits?.isTrial && modalState.words.length > limits.wordLimit
        ? modalState.words.slice(0, limits.wordLimit)
        : modalState.words;

    return sourceWords.filter((item) => {
        const st = Number(masteryMap[item._idKey] || 0);
        if (modalState.filterTab === "basic" && !isUltraBasicWord(item)) return false;
        if (modalState.filterTab === "manual" && !isManualExcluded(st)) return false;
        if (modalState.filterTab === "auto" && !isAutoMastered(st, threshold)) return false;

        if (!q) return true;
        const word = String(item.word || item.單字 || "").toLowerCase();
        const zh = String(item.zh || item.中文解釋 || "").toLowerCase();
        return word.includes(q) || zh.includes(q);
    });
}

function buildWordListRegionHtml(masteryMap, threshold) {
    const filtered = getFilteredWords(masteryMap, threshold);
    const slice = filtered.slice(0, modalState.visibleLimit);
    const basicUnexcludedCount = modalState.filterTab === "basic"
        ? filtered.filter((w) => !isManualExcluded(masteryMap[w._idKey])).length
        : 0;

    const rowsHtml = slice.length === 0
        ? `<div class="text-center text-slate-500 py-8 text-xs">找不到符合條件的單字</div>`
        : slice.map((item) => {
            const word = String(item.word || item.單字 || "").trim();
            const zh = String(item.zh || item.中文解釋 || "").trim();
            const pos = String(item.pos || item.詞性 || "").trim();
            const st = Number(masteryMap[item._idKey] || 0);
            const manual = isManualExcluded(st);
            const auto = isAutoMastered(st, threshold);

            let badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">未熟練</span>`;
            if (manual) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">已手動排除</span>`;
            } else if (auto) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">自動熟練 (${st}/${threshold})</span>`;
            } else if (st > 0) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">累積 ${st}/${threshold}</span>`;
            } else if (st < 0) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">需加強</span>`;
            }

            const isOut = manual || auto;
            return `
                <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-black text-sm text-slate-100">${escapeHtml(word)}</span>
                            ${pos ? `<span class="text-[10px] font-mono text-slate-500">${escapeHtml(pos)}</span>` : ""}
                            ${badgeHtml}
                        </div>
                        <div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(zh)}</div>
                    </div>
                    <button type="button" data-wm-toggle-id="${escapeHtml(item._idKey)}" data-wm-is-out="${isOut ? "1" : "0"}"
                        class="wm-toggle-btn px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                            isOut
                                ? "bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600"
                                : "bg-rose-600/85 hover:bg-rose-500 text-white"
                        }">
                        ${isOut ? "恢復考題" : "排除"}
                    </button>
                </div>
            `;
        }).join("");

    return `
        <div class="flex items-center justify-between gap-2 text-[11px] text-slate-400 flex-wrap">
            <span>符合條件：${filtered.length} 字</span>
            <div class="flex items-center gap-2">
                <span id="wm-modal-status" class="text-emerald-400 font-bold">${escapeHtml(modalState.statusMsg)}</span>
                ${modalState.filterTab === "basic" && basicUnexcludedCount > 0 ? `
                    <button type="button" id="wm-batch-exclude-basic-btn"
                        class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black transition cursor-pointer shrink-0">
                        一鍵排除此類 (${basicUnexcludedCount})
                    </button>
                ` : ""}
            </div>
        </div>

        <div id="wm-word-list" class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            ${rowsHtml}
        </div>

        ${filtered.length > slice.length ? `
            <button type="button" id="wm-load-more-btn"
                class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer">
                載入更多（剩餘 ${filtered.length - slice.length} 字）
            </button>
        ` : ""}
    `;
}

function buildModalContentHtml(masteryMap, threshold) {
    if (modalState.isLoadingWords) {
        return `<div class="text-center text-slate-400 py-10 text-sm">⏳ 正在載入雲端單字庫...</div>`;
    }

    const tabs = [
        { id: "all", label: "全部" },
        { id: "basic", label: "超基礎／縮寫 (A, A.M.)" },
        { id: "manual", label: "手動排除" },
        { id: "auto", label: "自動熟練" }
    ];

    const tabsHtml = tabs.map((t) => {
        const active = modalState.filterTab === t.id;
        return `
            <button type="button" data-wm-tab="${t.id}"
                class="wm-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    active
                        ? "bg-sky-600 text-white shadow"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }">
                ${t.label}
            </button>
        `;
    }).join("");

    return `
        <div class="space-y-3">
            <div class="flex flex-wrap gap-1.5">${tabsHtml}</div>

            <input type="text" id="wm-search-input" value="${escapeHtml(modalState.searchQuery)}"
                placeholder="搜尋英文或中文（例如 A.M.、a）..."
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400" />

            <div id="wm-list-region" class="space-y-3">
                ${buildWordListRegionHtml(masteryMap, threshold)}
            </div>
        </div>
    `;
}

export function renderWordMasterySection(container, state) {
    if (!container) return;

    const masteryMap = state.wordMastery || {};
    const threshold = state.masteryThreshold || DEFAULT_MASTERY_THRESHOLD;
    const summary = getMasterySummary(modalState.words, masteryMap, threshold);
    const thresholdOptions = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20];
    if (!thresholdOptions.includes(threshold)) {
        thresholdOptions.push(threshold);
        thresholdOptions.sort((a, b) => a - b);
    }

    container.innerHTML = `
        <div class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-4" style="background: #1e293b; color: #f8fafc;">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                    <h3 class="font-black text-base text-sky-300">📚 單字熟練度與考題排除</h3>
                </div>
                <div class="flex items-center flex-wrap gap-2">
                    <label class="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200">
                        <span>累積答對</span>
                        <select id="wm-threshold-select"
                            class="bg-slate-950 border border-slate-600 rounded-lg px-2 py-0.5 text-amber-300 font-black focus:outline-none focus:border-sky-400 cursor-pointer">
                            ${thresholdOptions.map((n) => `<option value="${n}" ${n === threshold ? "selected" : ""}>${n}</option>`).join("")}
                        </select>
                        <span>次自動熟練</span>
                    </label>
                    <button type="button" id="wm-open-manager-btn"
                        class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow">
                        手動排除管理
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3 text-center">
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div class="text-[11px] text-slate-400">自動熟練</div>
                    <div id="prof-wm-auto" class="text-lg font-black text-emerald-400 mt-0.5">${summary.autoMastered} <span class="text-xs font-bold">字</span></div>
                </div>
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div class="text-[11px] text-slate-400">手動排除</div>
                    <div id="prof-wm-manual" class="text-lg font-black text-rose-300 mt-0.5">${summary.manualExcluded} <span class="text-xs font-bold">字</span></div>
                </div>
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div class="text-[11px] text-slate-400">共不納入考題</div>
                    <div id="prof-wm-total-excluded" class="text-lg font-black text-amber-300 mt-0.5">${summary.excludedTotal} <span class="text-xs font-bold">字</span></div>
                </div>
            </div>
        </div>

        <!-- 手動排除管理彈窗 -->
        <div id="wm-manager-modal" class="${modalState.isOpen ? "" : "hidden"} fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div class="theme-card bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-2xl w-full p-5 space-y-4 shadow-2xl" style="background: #1e293b; color: #f8fafc;">
                <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-700">
                    <h4 class="font-black text-base text-sky-300">📚 單字熟練與手動排除清單</h4>
                    <button type="button" id="wm-close-modal-btn"
                        class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer">
                        ✕
                    </button>
                </div>
                <div id="wm-modal-body">
                    ${modalState.isOpen ? buildModalContentHtml(masteryMap, threshold) : ""}
                </div>
            </div>
        </div>
    `;
}

export function bindWordMasterySection(container, ctx) {
    if (!container) return;

    const rerenderSelf = () => {
        const st = ctx.getState();
        renderWordMasterySection(container, st);
        bindWordMasterySection(container, ctx);
    };

    const thresholdSelect = container.querySelector("#wm-threshold-select");
    if (thresholdSelect) {
        thresholdSelect.onchange = async () => {
            const st = ctx.getState();
            const nextVal = Math.min(MAX_MASTERY_THRESHOLD, Math.max(MIN_MASTERY_THRESHOLD, Number(thresholdSelect.value) || DEFAULT_MASTERY_THRESHOLD));
            const saved = await saveMasteryThreshold(st.licenseKey, ctx.db, nextVal);
            st.masteryThreshold = saved;
            rerenderSelf();
        };
    }

    const openBtn = container.querySelector("#wm-open-manager-btn");
    if (openBtn) {
        openBtn.onclick = async () => {
            modalState.isOpen = true;
            modalState.visibleLimit = PAGE_SIZE;
            modalState.statusMsg = "";

            const limits = window.AccessGate?.getAccessLimits?.() || { isTrial: false, wordLimit: 50 };
            const needReload = modalState.words.length === 0 || (!limits.isTrial && modalState.words.length <= limits.wordLimit);
            if (needReload) {
                modalState.isLoadingWords = true;
                rerenderSelf();
                try {
                    modalState.words = await loadSharedWordBank(ctx.db, {
                        trialOnly: limits.isTrial,
                        limit: limits.wordLimit
                    });
                } catch (err) {
                    console.error(err);
                    alert("❌ 載入單字庫失敗：" + err.message);
                } finally {
                    modalState.isLoadingWords = false;
                }
            }
            rerenderSelf();
        };
    }

    const modalEl = container.querySelector("#wm-manager-modal");
    const closeBtn = container.querySelector("#wm-close-modal-btn");
    const closeModal = () => {
        modalState.isOpen = false;
        modalState.statusMsg = "";
        rerenderSelf();
    };
    if (closeBtn) closeBtn.onclick = closeModal;
    if (modalEl) {
        modalEl.onclick = (e) => {
            if (e.target === modalEl) closeModal();
        };
    }

    if (!modalState.isOpen) return;

    const st = ctx.getState();
    const masteryMap = st.wordMastery || (st.wordMastery = {});
    const threshold = st.masteryThreshold || DEFAULT_MASTERY_THRESHOLD;

    const refreshListRegionOnly = () => {
        const region = container.querySelector("#wm-list-region");
        if (!region) return;
        region.innerHTML = buildWordListRegionHtml(masteryMap, threshold);
        bindListRegionEvents();
    };

    const refreshSummaryBadges = () => {
        const summary = getMasterySummary(modalState.words, masteryMap, threshold);
        const autoEl = container.querySelector("#prof-wm-auto");
        const manualEl = container.querySelector("#prof-wm-manual");
        const totalEl = container.querySelector("#prof-wm-total-excluded");
        if (autoEl) autoEl.innerHTML = `${summary.autoMastered} <span class="text-xs font-bold">字</span>`;
        if (manualEl) manualEl.innerHTML = `${summary.manualExcluded} <span class="text-xs font-bold">字</span>`;
        if (totalEl) totalEl.innerHTML = `${summary.excludedTotal} <span class="text-xs font-bold">字</span>`;
    };

    function bindListRegionEvents() {
        const loadMoreBtn = container.querySelector("#wm-load-more-btn");
        if (loadMoreBtn) {
            loadMoreBtn.onclick = () => {
                modalState.visibleLimit += PAGE_SIZE;
                refreshListRegionOnly();
            };
        }

        const batchBtn = container.querySelector("#wm-batch-exclude-basic-btn");
        if (batchBtn) {
            batchBtn.onclick = async () => {
                const targets = getFilteredWords(masteryMap, threshold)
                    .filter((w) => !isManualExcluded(masteryMap[w._idKey]))
                    .map((w) => w._idKey);
                if (targets.length === 0) return;

                batchBtn.disabled = true;
                batchBtn.textContent = "處理中...";
                await batchSetWordsExcluded(st.licenseKey, ctx.db, targets, true, masteryMap);
                await removeWordsFromAllWrongPools(st.licenseKey, ctx.db, targets);
                modalState.statusMsg = `✅ 已批次排除 ${targets.length} 個單字`;
                refreshSummaryBadges();
                refreshListRegionOnly();
            };
        }

        container.querySelectorAll(".wm-toggle-btn").forEach((btn) => {
            btn.onclick = async () => {
                const idKey = btn.getAttribute("data-wm-toggle-id");
                const isOut = btn.getAttribute("data-wm-is-out") === "1";
                if (!idKey) return;

                btn.disabled = true;
                await setWordExcluded(st.licenseKey, ctx.db, idKey, !isOut, masteryMap);
                if (!isOut) {
                    await removeWordsFromAllWrongPools(st.licenseKey, ctx.db, idKey);
                }
                modalState.statusMsg = isOut ? "✅ 已恢復納入考題" : "✅ 已手動排除";
                refreshSummaryBadges();
                refreshListRegionOnly();
            };
        });
    }

    container.querySelectorAll(".wm-tab-btn").forEach((btn) => {
        btn.onclick = () => {
            modalState.filterTab = btn.getAttribute("data-wm-tab") || "all";
            modalState.visibleLimit = PAGE_SIZE;
            modalState.statusMsg = "";
            rerenderSelf();
        };
    });

    const searchInput = container.querySelector("#wm-search-input");
    if (searchInput) {
        searchInput.oninput = (e) => {
            modalState.searchQuery = e.target.value || "";
            modalState.visibleLimit = PAGE_SIZE;
            modalState.statusMsg = "";
            refreshListRegionOnly();
        };
    }

    bindListRegionEvents();
}
