// assets/js/wordMastery.js
// 依帳號 ID 獨立儲存於雲端 Firebase 與 localStorage 的單字熟練度／手動排除工具
// 數值編碼（以 GEPT_Core_Basic 的 _idKey 為鍵，避開 A.M. 含 "." 等 Firebase 禁用字元）：
//   -1  : 曾答錯，優先重考
//    0  : 尚未作答（或未記錄）
//   1+  : 累積答對次數（>= threshold 即自動熟練）
//  999  : 手動排除（太簡單／永久不考）

export const DEFAULT_MASTERY_THRESHOLD = 3;
export const MIN_MASTERY_THRESHOLD = 1;
export const MAX_MASTERY_THRESHOLD = 20;
export const MANUAL_EXCLUDE_CODE = 999;

const MASTERY_STORAGE_PREFIX = "boshen_word_mastery_";
const CONFIG_STORAGE_PREFIX = "boshen_word_mastery_cfg_";
const MAX_SENTENCE_CACHE_SIZE = 50;

// 純模組私有記憶體快取（絕不寫入 localStorage，亦不掛載至 window，兼顧速度與題庫智財保護）
let cachedFullWordBankPromise = null;
let cachedFullWordBankList = null;
let cachedTrialWordBankPromise = null;
let cachedTrialWordBankList = null;
const sentenceLruCache = new Map();

export function sanitizeThreshold(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || Number.isNaN(n)) return DEFAULT_MASTERY_THRESHOLD;
    return Math.min(MAX_MASTERY_THRESHOLD, Math.max(MIN_MASTERY_THRESHOLD, n));
}

export function isManualExcluded(status) {
    return Number(status) === MANUAL_EXCLUDE_CODE;
}

export function isAutoMastered(status, threshold = DEFAULT_MASTERY_THRESHOLD) {
    const n = Number(status) || 0;
    const th = sanitizeThreshold(threshold);
    return n >= th && n < MANUAL_EXCLUDE_CODE;
}

export function isWordExcluded(status, threshold = DEFAULT_MASTERY_THRESHOLD) {
    return isManualExcluded(status) || isAutoMastered(status, threshold);
}

/**
 * 判斷是否屬於超基礎／縮寫字（例如 A、I、OK、A.M.、P.M.、Mr. 等），供個人資料頁快速篩選
 */
export function isUltraBasicWord(item) {
    const raw = String(item?.word || item?.單字 || "").trim();
    if (!raw) return false;
    if (raw.includes(".")) return true; // A.M., P.M., Mr., Ms., Dr., etc.
    const lettersOnly = raw.replace(/[^a-zA-Z]/g, "");
    if (lettersOnly.length <= 2 && raw.length <= 3) return true; // A, I, an, am, OK, TV, CD...
    return false;
}

export function getCachedMastery(uid) {
    if (!uid) return {};
    try {
        const raw = localStorage.getItem(`${MASTERY_STORAGE_PREFIX}${uid}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function saveCachedMastery(uid, masteryMap) {
    if (!uid) return;
    try {
        localStorage.setItem(`${MASTERY_STORAGE_PREFIX}${uid}`, JSON.stringify(masteryMap || {}));
    } catch (err) {
        console.warn("[WordMastery] localStorage write failed:", err);
    }
}

export function getCachedThreshold(uid) {
    if (!uid) return DEFAULT_MASTERY_THRESHOLD;
    try {
        const raw = localStorage.getItem(`${CONFIG_STORAGE_PREFIX}${uid}`);
        if (!raw) return DEFAULT_MASTERY_THRESHOLD;
        const parsed = JSON.parse(raw);
        return sanitizeThreshold(parsed?.threshold);
    } catch {
        return DEFAULT_MASTERY_THRESHOLD;
    }
}

export function saveCachedThreshold(uid, threshold) {
    if (!uid) return;
    const safe = sanitizeThreshold(threshold);
    try {
        localStorage.setItem(`${CONFIG_STORAGE_PREFIX}${uid}`, JSON.stringify({ threshold: safe }));
    } catch (err) {
        console.warn("[WordMastery] config localStorage write failed:", err);
    }
}

function mergeMasteryMaps(localMap = {}, remoteMap = {}) {
    const merged = { ...localMap };
    Object.keys(remoteMap || {}).forEach((k) => {
        const rVal = Number(remoteMap[k]);
        if (!Number.isFinite(rVal)) return;
        const lVal = merged[k] !== undefined ? Number(merged[k]) : undefined;
        // 雲端資料優先（跨裝置同步基準）
        if (lVal === undefined || rVal !== lVal) {
            merged[k] = rVal;
        }
    });
    return merged;
}

/**
 * 載入指定帳號 ID 的雲端單字熟練紀錄與熟練門檻設定（users/{uid} 為主，licenses/{uid} 為降級備援）
 */
export async function loadWordMasteryState(uid, db) {
    const cleanUid = String(uid || "TEST03").trim().toUpperCase();
    let masteryMap = getCachedMastery(cleanUid);
    let threshold = getCachedThreshold(cleanUid);

    if (!db || cleanUid === "GUEST") {
        return { masteryMap, threshold };
    }

    let remoteMastery = null;
    let remoteConfig = null;

    try {
        const [mSnap, cSnap] = await Promise.all([
            db.ref(`users/${cleanUid}/wordMastery`).once("value"),
            db.ref(`users/${cleanUid}/wordMasteryConfig`).once("value")
        ]);
        if (mSnap.exists()) remoteMastery = mSnap.val() || {};
        if (cSnap.exists()) remoteConfig = cSnap.val() || {};
    } catch (err) {
        console.warn("[WordMastery] Read from users/ failed, trying licenses/:", err);
    }

    if (remoteMastery === null || remoteConfig === null) {
        try {
            const [lmSnap, lcSnap] = await Promise.all([
                remoteMastery === null ? db.ref(`licenses/${cleanUid}/wordMastery`).once("value") : Promise.resolve(null),
                remoteConfig === null ? db.ref(`licenses/${cleanUid}/wordMasteryConfig`).once("value") : Promise.resolve(null)
            ]);
            if (lmSnap && lmSnap.exists()) remoteMastery = lmSnap.val() || {};
            if (lcSnap && lcSnap.exists()) remoteConfig = lcSnap.val() || {};
        } catch (err) {
            console.warn("[WordMastery] Fallback read from licenses/ failed:", err);
        }
    }

    if (remoteMastery !== null) {
        // 雲端有資料時以雲端為準，確保跨裝置一致
        masteryMap = { ...remoteMastery };
        saveCachedMastery(cleanUid, masteryMap);
    }

    if (remoteConfig && remoteConfig.threshold !== undefined) {
        threshold = sanitizeThreshold(remoteConfig.threshold);
        saveCachedThreshold(cleanUid, threshold);
    }

    return { masteryMap, threshold };
}

async function writeMasteryPatch(uid, db, patch) {
    if (!db || !uid || uid === "GUEST" || uid === "50TEST" || !patch || Object.keys(patch).length === 0) return;

    try {
        await db.ref(`users/${uid}/wordMastery`).update(patch);
    } catch (err) {
        console.warn("[WordMastery] Write users/wordMastery failed:", err);
    }

    try {
        await db.ref(`licenses/${uid}/wordMastery`).update(patch);
    } catch (err) {
        console.warn("[WordMastery] Write licenses/wordMastery failed:", err);
    }
}

/**
 * 儲存該帳號的「答對幾次自動熟練」門檻至雲端與本地
 */
export async function saveMasteryThreshold(uid, db, nextThreshold) {
    const cleanUid = String(uid || "TEST03").trim().toUpperCase();
    const safe = sanitizeThreshold(nextThreshold);
    saveCachedThreshold(cleanUid, safe);

    if (db && cleanUid !== "GUEST" && cleanUid !== "50TEST") {
        const payload = { threshold: safe, updatedAt: Date.now() };
        try {
            await db.ref(`users/${cleanUid}/wordMasteryConfig`).set(payload);
        } catch (err) {
            console.warn("[WordMastery] Write users/wordMasteryConfig failed:", err);
        }
        try {
            await db.ref(`licenses/${cleanUid}/wordMasteryConfig`).set(payload);
        } catch (err) {
            console.warn("[WordMastery] Write licenses/wordMasteryConfig failed:", err);
        }
    }

    return safe;
}

/**
 * 記錄單次答題結果（累積制）：
 * - 答對：由 -1/0 變 1，或累積 +1（上限 99）；若剛好達到 threshold 回傳 justMastered: true
 * - 答錯：若非手動排除，標記為 -1（提高後續重考優先度）
 */
export async function recordWordAttempt(uid, db, idKey, isCorrect, masteryMap, threshold = DEFAULT_MASTERY_THRESHOLD) {
    if (!idKey || !masteryMap) {
        return { prevVal: 0, nextVal: 0, justMastered: false };
    }

    const cleanUid = String(uid || "TEST03").trim().toUpperCase();
    const th = sanitizeThreshold(threshold);
    const prevVal = Number(masteryMap[idKey] || 0);

    // 已被手動排除的字不覆蓋其 999 標記
    if (isManualExcluded(prevVal)) {
        return { prevVal, nextVal: prevVal, justMastered: false };
    }

    let nextVal = prevVal;
    if (isCorrect) {
        nextVal = prevVal < 0 ? 1 : Math.min(99, prevVal + 1);
    } else {
        nextVal = -1;
    }

    masteryMap[idKey] = nextVal;
    saveCachedMastery(cleanUid, masteryMap);

    const justMastered = isCorrect && prevVal < th && nextVal >= th;
    await writeMasteryPatch(cleanUid, db, { [idKey]: nextVal });

    return { prevVal, nextVal, justMastered };
}

/**
 * 手動排除（不再考）或恢復考題（單筆）
 */
export async function setWordExcluded(uid, db, idKey, excluded, masteryMap) {
    if (!idKey || !masteryMap) return 0;
    const cleanUid = String(uid || "TEST03").trim().toUpperCase();

    let nextVal;
    let patchVal;
    if (excluded) {
        nextVal = MANUAL_EXCLUDE_CODE;
        patchVal = MANUAL_EXCLUDE_CODE;
        masteryMap[idKey] = nextVal;
    } else {
        nextVal = 0;
        patchVal = null; // 從 Firebase 刪除該鍵保持精簡
        delete masteryMap[idKey];
    }

    saveCachedMastery(cleanUid, masteryMap);
    await writeMasteryPatch(cleanUid, db, { [idKey]: patchVal });
    return nextVal;
}

/**
 * 批次手動排除或恢復考題
 */
export async function batchSetWordsExcluded(uid, db, idKeys, excluded, masteryMap) {
    if (!Array.isArray(idKeys) || idKeys.length === 0 || !masteryMap) return 0;
    const cleanUid = String(uid || "TEST03").trim().toUpperCase();
    const patch = {};

    idKeys.forEach((idKey) => {
        if (!idKey) return;
        if (excluded) {
            masteryMap[idKey] = MANUAL_EXCLUDE_CODE;
            patch[idKey] = MANUAL_EXCLUDE_CODE;
        } else {
            delete masteryMap[idKey];
            patch[idKey] = null;
        }
    });

    saveCachedMastery(cleanUid, masteryMap);
    await writeMasteryPatch(cleanUid, db, patch);
    return Object.keys(patch).length;
}

/**
 * 計算目前題庫的熟練統計摘要
 */
export function getMasterySummary(wordList = [], masteryMap = {}, threshold = DEFAULT_MASTERY_THRESHOLD) {
    const th = sanitizeThreshold(threshold);
    let autoMastered = 0;
    let manualExcluded = 0;

    if (Array.isArray(wordList) && wordList.length > 0) {
        wordList.forEach((item) => {
            const st = Number(masteryMap[item._idKey] || 0);
            if (isManualExcluded(st)) manualExcluded++;
            else if (isAutoMastered(st, th)) autoMastered++;
        });
        const total = wordList.length;
        const excludedTotal = autoMastered + manualExcluded;
        return {
            total,
            autoMastered,
            manualExcluded,
            excludedTotal,
            remaining: Math.max(0, total - excludedTotal)
        };
    }

    // 若尚未載入完整單字庫，先從 masteryMap 本身計算已熟練／已排除數
    Object.values(masteryMap || {}).forEach((raw) => {
        const st = Number(raw || 0);
        if (isManualExcluded(st)) manualExcluded++;
        else if (isAutoMastered(st, th)) autoMastered++;
    });

    return {
        total: 0,
        autoMastered,
        manualExcluded,
        excludedTotal: autoMastered + manualExcluded,
        remaining: 0
    };
}

/**
 * 過濾出題池並依不熟程度排序（答錯 -1 最優先 → 未考 0 → 累積 1, 2...）
 */
export function buildFilteredQuizPool(wordList = [], masteryMap = {}, threshold = DEFAULT_MASTERY_THRESHOLD, includeMastered = false) {
    const th = sanitizeThreshold(threshold);
    const filtered = includeMastered
        ? [...wordList]
        : wordList.filter((item) => !isWordExcluded(masteryMap[item._idKey], th));

    // 先依熟練度由低到高排序（同分保留隨機性）
    return filtered
        .map((item) => ({
            item,
            st: Number(masteryMap[item._idKey] || 0),
            rand: Math.random()
        }))
        .sort((a, b) => (a.st !== b.st ? a.st - b.st : a.rand - b.rand))
        .map((entry) => entry.item);
}

/**
 * 共用純記憶體單字庫載入（不寫 localStorage）：
 * - 試用版（trialOnly: true）：向 Firebase 查詢 limitToFirst(50)，只抓 50 筆不載入全庫
 * - 正式版（trialOnly: false）：載入完整 GEPT_Core_Basic 並於本次連線期間在記憶體共用
 */
export async function loadSharedWordBank(db, options = {}) {
    const { trialOnly = false, limit = 50 } = options;

    if (trialOnly) {
        if (Array.isArray(cachedFullWordBankList) && cachedFullWordBankList.length > 0) {
            return cachedFullWordBankList.slice(0, limit);
        }
        if (Array.isArray(cachedTrialWordBankList) && cachedTrialWordBankList.length > 0) {
            return cachedTrialWordBankList;
        }
        if (!db) return [];

        if (!cachedTrialWordBankPromise) {
            cachedTrialWordBankPromise = db.ref("GEPT_Core_Basic").limitToFirst(limit).once("value")
                .then((snap) => {
                    const raw = snap.val() || {};
                    cachedTrialWordBankList = Object.keys(raw).map((k) => ({
                        ...raw[k],
                        _idKey: k
                    }));
                    return cachedTrialWordBankList;
                })
                .catch((err) => {
                    cachedTrialWordBankPromise = null;
                    throw err;
                });
        }
        return cachedTrialWordBankPromise;
    }

    if (Array.isArray(cachedFullWordBankList) && cachedFullWordBankList.length > 0) {
        return cachedFullWordBankList;
    }
    if (!db) return [];

    if (!cachedFullWordBankPromise) {
        cachedFullWordBankPromise = db.ref("GEPT_Core_Basic").once("value")
            .then((snap) => {
                const raw = snap.val() || {};
                cachedFullWordBankList = Object.keys(raw).map((k) => ({
                    ...raw[k],
                    _idKey: k
                }));
                return cachedFullWordBankList;
            })
            .catch((err) => {
                cachedFullWordBankPromise = null;
                throw err;
            });
    }

    return cachedFullWordBankPromise;
}

/**
 * 限量 LRU 例句記憶體快取（僅存近期考過最多 50 筆，不寫 localStorage）
 */
export function getCachedSentence(idKey) {
    if (!idKey || !sentenceLruCache.has(idKey)) return null;
    const val = sentenceLruCache.get(idKey);
    // 移至最新使用位置
    sentenceLruCache.delete(idKey);
    sentenceLruCache.set(idKey, val);
    return val;
}

export function setCachedSentence(idKey, val) {
    if (!idKey) return;
    if (sentenceLruCache.has(idKey)) {
        sentenceLruCache.delete(idKey);
    }
    sentenceLruCache.set(idKey, val || {});
    while (sentenceLruCache.size > MAX_SENTENCE_CACHE_SIZE) {
        const oldestKey = sentenceLruCache.keys().next().value;
        sentenceLruCache.delete(oldestKey);
    }
}

export async function fetchSentencesOnDemand(db, idKeys = []) {
    if (!db || !Array.isArray(idKeys) || idKeys.length === 0) return;
    const missing = [...new Set(idKeys.filter((k) => k && !sentenceLruCache.has(k)))];
    if (missing.length === 0) return;

    await Promise.all(
        missing.map((idKey) =>
            db.ref("GEPT_Core_Sentences/" + idKey).once("value")
                .then((snap) => {
                    setCachedSentence(idKey, snap.exists() ? snap.val() : {});
                })
                .catch((err) => {
                    console.warn("[WordMastery] 例句按需載入失敗:", idKey, err);
                    setCachedSentence(idKey, {});
                })
        )
    );
}
