// assets/js/wrongBook.js
// 雲端雙池錯題記憶引擎（認錯 recognition／拼錯 spelling）＋ 錯題考後訂正勾選彈窗
// 僅記錄 _idKey、count 與 lastWrongAt，不將題目／例句原文寫入 localStorage

export const POOL_RECOGNITION = "recognition"; // 單字選擇、情境句子（認讀類）
export const POOL_SPELLING = "spelling";       // 克漏字填空（拼寫類）

const WRONG_BOOK_STORAGE_PREFIX = "boshen_wrong_book_";

function normalizePoolMap(rawPool) {
    const out = {};
    if (!rawPool || typeof rawPool !== "object") return out;
    Object.keys(rawPool).forEach((idKey) => {
        const item = rawPool[idKey];
        if (!item) return;
        if (typeof item === "number") {
            if (item > 0) out[idKey] = { count: item, lastWrongAt: 0 };
        } else if (typeof item === "object") {
            out[idKey] = {
                count: Math.max(1, Number(item.count || 1)),
                lastWrongAt: Number(item.lastWrongAt || 0)
            };
        }
    });
    return out;
}

export function createEmptyWrongBook() {
    return {
        [POOL_RECOGNITION]: {},
        [POOL_SPELLING]: {}
    };
}

function normalizeWrongBook(raw) {
    return {
        [POOL_RECOGNITION]: normalizePoolMap(raw?.[POOL_RECOGNITION]),
        [POOL_SPELLING]: normalizePoolMap(raw?.[POOL_SPELLING])
    };
}

function isLocalOnlyUser(uid) {
    return !uid || uid === "GUEST" || uid === "50TEST";
}

export function getCachedWrongBook(uid) {
    if (!uid) return createEmptyWrongBook();
    try {
        const raw = localStorage.getItem(`${WRONG_BOOK_STORAGE_PREFIX}${uid}`);
        if (!raw) return createEmptyWrongBook();
        return normalizeWrongBook(JSON.parse(raw));
    } catch {
        return createEmptyWrongBook();
    }
}

export function saveCachedWrongBook(uid, wrongBook) {
    if (!uid) return;
    try {
        localStorage.setItem(`${WRONG_BOOK_STORAGE_PREFIX}${uid}`, JSON.stringify(normalizeWrongBook(wrongBook)));
    } catch (err) {
        console.warn("[WrongBook] localStorage write failed:", err);
    }
}

/**
 * 讀取指定帳號 ID 的雲端錯題本（users/{uid}/wrongBook 為主，licenses/{uid}/wrongBook 為降級備援）
 */
export async function loadWrongBook(uid, db) {
    const cleanUid = String(uid || "50TEST").trim().toUpperCase();
    let book = getCachedWrongBook(cleanUid);

    if (!db || isLocalOnlyUser(cleanUid)) {
        return book;
    }

    let remoteRaw = null;
    try {
        const snap = await db.ref(`users/${cleanUid}/wrongBook`).once("value");
        if (snap.exists()) remoteRaw = snap.val();
    } catch (err) {
        console.warn("[WrongBook] Read users/wrongBook failed, trying licenses/:", err);
    }

    if (remoteRaw === null) {
        try {
            const licSnap = await db.ref(`licenses/${cleanUid}/wrongBook`).once("value");
            if (licSnap.exists()) remoteRaw = licSnap.val();
        } catch (err) {
            console.warn("[WrongBook] Fallback read licenses/wrongBook failed:", err);
        }
    }

    if (remoteRaw !== null) {
        book = normalizeWrongBook(remoteRaw);
        saveCachedWrongBook(cleanUid, book);
    }

    return book;
}

async function writePoolPatch(uid, db, pool, patch) {
    if (!db || isLocalOnlyUser(uid) || !patch || Object.keys(patch).length === 0) return;

    try {
        await db.ref(`users/${uid}/wrongBook/${pool}`).update(patch);
    } catch (err) {
        console.warn(`[WrongBook] Write users/wrongBook/${pool} failed:`, err);
    }

    try {
        await db.ref(`licenses/${uid}/wrongBook/${pool}`).update(patch);
    } catch (err) {
        console.warn(`[WrongBook] Write licenses/wrongBook/${pool} failed:`, err);
    }
}

/**
 * 記錄答錯單字（一般模式答錯時立即寫入對應池）
 */
export async function recordWrongWord(uid, db, pool, idKey, wrongBook) {
    if (!idKey || !wrongBook) return;
    const cleanUid = String(uid || "50TEST").trim().toUpperCase();
    const targetPool = pool === POOL_SPELLING ? POOL_SPELLING : POOL_RECOGNITION;
    if (!wrongBook[targetPool]) wrongBook[targetPool] = {};

    const prev = wrongBook[targetPool][idKey];
    const nextEntry = {
        count: Math.max(1, Number(prev?.count || 0) + 1),
        lastWrongAt: Date.now()
    };
    wrongBook[targetPool][idKey] = nextEntry;
    saveCachedWrongBook(cleanUid, wrongBook);

    await writePoolPatch(cleanUid, db, targetPool, { [idKey]: nextEntry });
    return nextEntry;
}

/**
 * 依錯題整理彈窗的使用者勾選結果，批次移出或保留於錯題池
 * items: [{ idKey, removeFromWrongBook, isCorrect }]
 */
export async function batchApplyWrongReview(uid, db, pool, reviewDecisions = [], wrongBook) {
    if (!Array.isArray(reviewDecisions) || reviewDecisions.length === 0 || !wrongBook) {
        return { removedCount: 0, keptCount: 0 };
    }

    const cleanUid = String(uid || "50TEST").trim().toUpperCase();
    const targetPool = pool === POOL_SPELLING ? POOL_SPELLING : POOL_RECOGNITION;
    if (!wrongBook[targetPool]) wrongBook[targetPool] = {};

    const patch = {};
    let removedCount = 0;
    let keptCount = 0;
    const now = Date.now();

    reviewDecisions.forEach((d) => {
        if (!d?.idKey) return;
        if (d.removeFromWrongBook) {
            delete wrongBook[targetPool][d.idKey];
            patch[d.idKey] = null;
            removedCount++;
        } else {
            const prev = wrongBook[targetPool][d.idKey];
            const nextEntry = {
                count: d.isCorrect
                    ? Math.max(1, Number(prev?.count || 1))
                    : Math.max(1, Number(prev?.count || 0) + 1),
                lastWrongAt: d.isCorrect ? Number(prev?.lastWrongAt || now) : now
            };
            wrongBook[targetPool][d.idKey] = nextEntry;
            patch[d.idKey] = nextEntry;
            keptCount++;
        }
    });

    saveCachedWrongBook(cleanUid, wrongBook);
    await writePoolPatch(cleanUid, db, targetPool, patch);
    return { removedCount, keptCount };
}

/**
 * 當使用者手動排除單字（不再考）時，同步自認錯與拼錯兩池移出
 */
export async function removeWordsFromAllWrongPools(uid, db, idKeys, wrongBook = null) {
    const keys = Array.isArray(idKeys) ? idKeys.filter(Boolean) : (idKeys ? [idKeys] : []);
    if (keys.length === 0) return;

    const cleanUid = String(uid || "50TEST").trim().toUpperCase();
    const book = wrongBook || getCachedWrongBook(cleanUid);
    const recPatch = {};
    const spellPatch = {};

    keys.forEach((idKey) => {
        if (book[POOL_RECOGNITION] && book[POOL_RECOGNITION][idKey]) {
            delete book[POOL_RECOGNITION][idKey];
            recPatch[idKey] = null;
        }
        if (book[POOL_SPELLING] && book[POOL_SPELLING][idKey]) {
            delete book[POOL_SPELLING][idKey];
            spellPatch[idKey] = null;
        }
    });

    if (Object.keys(recPatch).length === 0 && Object.keys(spellPatch).length === 0) return;

    saveCachedWrongBook(cleanUid, book);
    await Promise.all([
        writePoolPatch(cleanUid, db, POOL_RECOGNITION, recPatch),
        writePoolPatch(cleanUid, db, POOL_SPELLING, spellPatch)
    ]);
}

/**
 * 計算指定錯題池在目前題庫中可用的錯題數量
 */
export function getWrongPoolCount(wordList = [], wrongBook = null, pool = POOL_RECOGNITION) {
    const map = wrongBook?.[pool] || {};
    if (!Array.isArray(wordList) || wordList.length === 0) {
        return Object.keys(map).length;
    }
    let count = 0;
    for (const item of wordList) {
        if (item?._idKey && map[item._idKey]) count++;
    }
    return count;
}

/**
 * 依錯誤次數由高到低、最近錯誤優先，從錯題池抽出最多 maxCount（預設 10）題
 */
export function getWrongPoolWords(wordList = [], wrongBook = null, pool = POOL_RECOGNITION, maxCount = 10) {
    const map = wrongBook?.[pool] || {};
    const matched = wordList
        .filter((item) => item?._idKey && map[item._idKey])
        .map((item) => ({
            item,
            count: Number(map[item._idKey]?.count || 1),
            lastWrongAt: Number(map[item._idKey]?.lastWrongAt || 0),
            rand: Math.random()
        }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            if (b.lastWrongAt !== a.lastWrongAt) return b.lastWrongAt - a.lastWrongAt;
            return a.rand - b.rand;
        })
        .slice(0, maxCount)
        .map((entry) => entry.item);

    return matched;
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * 錯題測驗結束後的「錯題訂正整理」勾選彈窗：
 * - 列出本輪所有考題（最多 10 題）
 * - 本次答對：預設勾選「移出錯題庫」
 * - 本次答錯：預設不勾選（保留於錯題庫）
 * - 使用者可手動調整每一題的勾選狀態，按確認後才批次套用並進入結算
 */
export function showWrongReviewModal({ poolLabel = "錯題複習", items = [] } = {}) {
    const existing = document.getElementById("wrong-review-modal");
    if (existing) existing.remove();

    if (!Array.isArray(items) || items.length === 0) {
        return Promise.resolve([]);
    }

    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.id = "wrong-review-modal";
        modal.className = "fixed inset-0 z-[85] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        const rowsHtml = items.map((item, idx) => {
            const checkedAttr = item.isCorrect ? "checked" : "";
            return `
                <label class="wrong-review-row flex items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer ${
                    item.isCorrect
                        ? "bg-emerald-950/35 border-emerald-700/50 hover:border-emerald-400"
                        : "bg-rose-950/35 border-rose-800/50 hover:border-rose-400"
                }">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        <input type="checkbox" class="wrong-review-cb w-4 h-4 accent-emerald-500 shrink-0 cursor-pointer"
                               data-index="${idx}" ${checkedAttr} />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-black text-sm text-slate-100">${escapeHtml(item.word)}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                    item.isCorrect
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                }">
                                    ${item.isCorrect ? "✅ 本次答對" : "❌ 本次答錯"}
                                </span>
                            </div>
                            ${item.zh ? `<div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(item.zh)}</div>` : ""}
                        </div>
                    </div>
                    <span class="wrong-review-state text-[11px] font-bold shrink-0 ${item.isCorrect ? "text-emerald-300" : "text-amber-300"}">
                        ${item.isCorrect ? "移出錯題庫" : "保留複習"}
                    </span>
                </label>
            `;
        }).join("");

        modal.innerHTML = `
            <div class="theme-card w-full max-w-xl my-auto rounded-3xl border-2 p-5 sm:p-6 space-y-4 shadow-2xl"
                 style="background: var(--bg-card, #1e293b); border-color: var(--border-color, #334155); color: var(--text-primary, #f8fafc);">
                <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-700/80">
                    <div>
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider"
                              style="background: var(--accent-soft, rgba(56,189,248,0.16)); color: var(--accent-primary, #38bdf8); border: 1px solid var(--accent-primary, #38bdf8);">
                            ${escapeHtml(poolLabel)}
                        </span>
                        <h3 class="text-lg font-black mt-1.5" style="font-family: var(--font-heading); color: var(--text-primary, #f8fafc);">
                            📋 本輪錯題訂正整理（共 ${items.length} 題）
                        </h3>
                        <p class="text-xs text-slate-400 mt-0.5">
                            勾選要「移出錯題庫」的單字（答對已預設勾選、答錯預設保留，可自由手動調整）
                        </p>
                    </div>
                </div>

                <!-- 快速勾選輔助列 -->
                <div class="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <button type="button" id="wr-select-correct-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold border border-slate-700 cursor-pointer">僅勾本次答對</button>
                        <button type="button" id="wr-select-all-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 cursor-pointer">全部移出</button>
                        <button type="button" id="wr-select-none-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 cursor-pointer">全部保留</button>
                    </div>
                    <span id="wr-summary-text" class="font-bold text-slate-300 font-mono"></span>
                </div>

                <!-- 題目清單 -->
                <div class="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                    ${rowsHtml}
                </div>

                <div class="pt-3 border-t border-slate-700/80 flex justify-end">
                    <button type="button" id="wr-confirm-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-xl font-black text-sm shadow transition cursor-pointer"
                        style="background: var(--accent-primary, #38bdf8); color: var(--accent-contrast, #082f49); font-family: var(--font-heading);">
                        確認調整並完成結算 →
                    </button>
                </div>
            </div>
        `;

        const checkboxes = Array.from(modal.querySelectorAll(".wrong-review-cb"));
        const summaryEl = modal.querySelector("#wr-summary-text");

        const refreshCounts = () => {
            let removeCnt = 0;
            checkboxes.forEach((cb) => {
                const row = cb.closest(".wrong-review-row");
                const stateEl = row?.querySelector(".wrong-review-state");
                if (cb.checked) {
                    removeCnt++;
                    if (stateEl) {
                        stateEl.textContent = "移出錯題庫";
                        stateEl.className = "wrong-review-state text-[11px] font-bold shrink-0 text-emerald-300";
                    }
                } else {
                    if (stateEl) {
                        stateEl.textContent = "保留複習";
                        stateEl.className = "wrong-review-state text-[11px] font-bold shrink-0 text-amber-300";
                    }
                }
            });
            const keepCnt = items.length - removeCnt;
            if (summaryEl) {
                summaryEl.textContent = `移出 ${removeCnt} 題｜保留 ${keepCnt} 題`;
            }
        };

        checkboxes.forEach((cb) => {
            cb.onchange = refreshCounts;
        });

        modal.querySelector("#wr-select-correct-btn").onclick = () => {
            checkboxes.forEach((cb, i) => { cb.checked = Boolean(items[i]?.isCorrect); });
            refreshCounts();
        };
        modal.querySelector("#wr-select-all-btn").onclick = () => {
            checkboxes.forEach((cb) => { cb.checked = true; });
            refreshCounts();
        };
        modal.querySelector("#wr-select-none-btn").onclick = () => {
            checkboxes.forEach((cb) => { cb.checked = false; });
            refreshCounts();
        };

        modal.querySelector("#wr-confirm-btn").onclick = () => {
            const decisions = items.map((item, i) => ({
                idKey: item.idKey,
                isCorrect: Boolean(item.isCorrect),
                removeFromWrongBook: Boolean(checkboxes[i]?.checked)
            }));
            modal.remove();
            resolve(decisions);
        };

        refreshCounts();
        document.body.appendChild(modal);
    });
}
