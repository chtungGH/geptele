// assets/js/accessGate.js
// 系統總管制：序號開通驗證（status === "啟用"）、同 ID 同時在線裝置上限（maxdevice）、
// 免序號試用版（50TEST：50 單字 + 2 篇 elem1 閱讀）與 LINE 官方客服入口（@787ubyzm）

import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

const DB_URL = "https://chtreadingcompre-default-rtdb.firebaseio.com/";
export const TRIAL_LICENSE_ID = "50TEST";
export const LINE_SUPPORT_ID = "@787ubyzm";
export const LINE_SUPPORT_URL = "https://line.me/R/ti/p/@787ubyzm";

const AUTH_STATE_KEY = "boshen_auth_gate_state";
const DEVICE_ID_KEY = "boshen_device_id";
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const SESSION_TTL_MS = 90 * 1000;

let dbInstance = null;
let currentMode = "trial"; // "licensed" | "trial"
let activeLicensedId = null;
let heartbeatTimer = null;
let connectedRef = null;
let connectedHandler = null;
let statusWatchRef = null;
let statusWatchHandler = null;
let selfSessionRef = null;
let selfSessionHandler = null;
let isExplicitLogout = false;
let initialized = false;

function getDb() {
    if (dbInstance) return dbInstance;
    if (!firebase.apps.length) {
        firebase.initializeApp({ databaseURL: DB_URL });
    }
    dbInstance = firebase.database();
    return dbInstance;
}

export function getOrCreateDeviceId() {
    try {
        let id = localStorage.getItem(DEVICE_ID_KEY);
        if (id && /^[a-zA-Z0-9_-]{8,64}$/.test(id)) return id;
        const rand = Math.random().toString(36).slice(2, 10);
        id = `dev_${Date.now().toString(36)}_${rand}`;
        localStorage.setItem(DEVICE_ID_KEY, id);
        return id;
    } catch {
        return `dev_mem_${Date.now().toString(36)}`;
    }
}

function getDeviceLabel() {
    const ua = navigator.userAgent || "";
    let os = "裝置";
    if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac OS X/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "瀏覽器";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";

    return `${os} / ${browser}`;
}

export function getSavedAuthState() {
    try {
        const raw = localStorage.getItem(AUTH_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveAuthState(nextObj) {
    try {
        localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(nextObj));
    } catch (err) {
        console.warn("[AccessGate] saveAuthState failed:", err);
    }
}

function clearAuthState() {
    try {
        localStorage.removeItem(AUTH_STATE_KEY);
    } catch {}
}

export function isTrialMode() {
    if (currentMode === "licensed" && activeLicensedId && activeLicensedId !== TRIAL_LICENSE_ID) {
        return false;
    }
    const saved = getSavedAuthState();
    if (saved?.confirmed && saved.mode === "licensed" && saved.licenseId && saved.licenseId !== TRIAL_LICENSE_ID) {
        return false;
    }
    return true;
}

export function getAccessLimits() {
    const trial = isTrialMode();
    return {
        isTrial: trial,
        wordLimit: trial ? 50 : Infinity,
        readingLimit: trial ? 2 : Infinity,
        readingDifficulty: trial ? "elem1" : null,
        trialId: TRIAL_LICENSE_ID
    };
}

function stopSessionKeepAlive() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (connectedRef && connectedHandler) {
        connectedRef.off("value", connectedHandler);
        connectedRef = null;
        connectedHandler = null;
    }
    if (statusWatchRef && statusWatchHandler) {
        statusWatchRef.off("value", statusWatchHandler);
        statusWatchRef = null;
        statusWatchHandler = null;
    }
    if (selfSessionRef && selfSessionHandler) {
        selfSessionRef.off("value", selfSessionHandler);
        selfSessionRef = null;
        selfSessionHandler = null;
    }
}

function startSessionKeepAlive(licenseId, deviceId) {
    stopSessionKeepAlive();
    const db = getDb();
    const sessionRef = db.ref(`licenses/${licenseId}/activeSessions/${deviceId}`);
    const payload = () => ({
        deviceId,
        deviceInfo: getDeviceLabel(),
        lastSeen: Date.now()
    });

    // 1. 監聽 Firebase 連線狀態，重連後自動補註冊 onDisconnect 與在線紀錄
    connectedRef = db.ref(".info/connected");
    connectedHandler = (snap) => {
        if (snap.val() === true && activeLicensedId === licenseId && !isExplicitLogout) {
            sessionRef.onDisconnect().remove().catch(() => {});
            sessionRef.update(payload()).catch(() => {});
        }
    };
    connectedRef.on("value", connectedHandler);

    // 2. 同設備若有多分頁且其中一個分頁關閉觸發 onDisconnect，仍開著的分頁自動補回在線狀態
    selfSessionRef = sessionRef;
    selfSessionHandler = (snap) => {
        if (!snap.exists() && activeLicensedId === licenseId && !isExplicitLogout) {
            sessionRef.onDisconnect().remove().catch(() => {});
            sessionRef.set({ ...payload(), joinedAt: Date.now() }).catch(() => {});
        }
    };
    selfSessionRef.on("value", selfSessionHandler);

    // 3. 每 30 秒更新心跳時間戳，供逾時清除機制判定
    heartbeatTimer = setInterval(() => {
        if (activeLicensedId === licenseId && !isExplicitLogout) {
            sessionRef.update({ lastSeen: Date.now() }).catch(() => {});
        }
    }, HEARTBEAT_INTERVAL_MS);

    // 4. 即時監控序號狀態：若後台改為非「啟用」，立即登出並返回閘道
    statusWatchRef = db.ref(`licenses/${licenseId}/status`);
    statusWatchHandler = (snap) => {
        if (activeLicensedId !== licenseId || isExplicitLogout) return;
        const st = String(snap.val() || "").trim();
        if (st !== "啟用") {
            logoutSession({
                showGate: true,
                notice: `序號「${licenseId}」已變更為「${st || "未啟用"}」，請聯繫 LINE 客服 ${LINE_SUPPORT_ID}。`
            });
        }
    };
    statusWatchRef.on("value", statusWatchHandler);
}

export async function verifyAndLoginLicense(rawLicenseId) {
    const cleanId = String(rawLicenseId || "")
        .trim()
        .toUpperCase()
        .replace(/[.#$\[\]\/]/g, "_");

    if (!cleanId) {
        return { ok: false, message: "請輸入授權序號（ID）。" };
    }

    // 避免透過輸入 50TEST 繞過試用版 50 字／2 篇閱讀限制
    if (cleanId === TRIAL_LICENSE_ID) {
        await enterTrialMode();
        return { ok: true, mode: "trial", licenseId: TRIAL_LICENSE_ID };
    }

    const db = getDb();
    let licData = null;

    try {
        const snap = await db.ref(`licenses/${cleanId}`).once("value");
        if (!snap.exists()) {
            return {
                ok: false,
                code: "NOT_FOUND",
                message: `找不到授權序號「${cleanId}」，請確認是否輸入正確，或聯繫 LINE 客服 ${LINE_SUPPORT_ID}。`
            };
        }
        licData = snap.val() || {};
    } catch (err) {
        console.error("[AccessGate] 驗證序號連線失敗:", err);
        return {
            ok: false,
            code: "NETWORK_ERROR",
            message: "無法連線至雲端驗證序號，請檢查網路後重試。"
        };
    }

    const status = String(licData.status || "").trim();
    if (status !== "啟用") {
        return {
            ok: false,
            code: "INACTIVE",
            message: `序號「${cleanId}」目前狀態為「${status || "未啟用"}」，須為「啟用」狀態方可登入。請聯繫 LINE 客服 ${LINE_SUPPORT_ID}。`
        };
    }

    const rawMax = licData.maxdevice ?? licData.maxDevice ?? licData.maxDevices ?? 2;
    const maxDevices = Math.max(1, Number(rawMax) || 2);
    const myDeviceId = getOrCreateDeviceId();
    const now = Date.now();
    const sessions = licData.activeSessions || {};

    const staleCleanup = {};
    const otherActiveDevices = [];

    Object.keys(sessions).forEach((devId) => {
        const item = sessions[devId];
        if (!item || typeof item !== "object") {
            staleCleanup[devId] = null;
            return;
        }
        const lastSeen = Number(item.lastSeen || item.joinedAt || 0);
        if (!lastSeen || now - lastSeen > SESSION_TTL_MS) {
            staleCleanup[devId] = null;
            return;
        }
        if (devId !== myDeviceId) {
            otherActiveDevices.push({
                deviceId: devId,
                deviceInfo: item.deviceInfo || "其他設備",
                lastSeen
            });
        }
    });

    if (Object.keys(staleCleanup).length > 0) {
        try {
            await db.ref(`licenses/${cleanId}/activeSessions`).update(staleCleanup);
        } catch (err) {
            console.warn("[AccessGate] 清理過期連線紀錄失敗:", err);
        }
    }

    if (otherActiveDevices.length >= maxDevices) {
        const listDesc = otherActiveDevices
            .map((d, idx) => `${idx + 1}. ${d.deviceInfo}`)
            .join("、");
        return {
            ok: false,
            code: "MAX_DEVICES",
            maxDevices,
            activeCount: otherActiveDevices.length,
            message: `此序號目前已達同時上線上限（${otherActiveDevices.length} / ${maxDevices} 台設備：${listDesc}）。請先在其他設備登出或關閉網頁後再試。`
        };
    }

    // 通過驗證：若先前登入了別組序號，先釋放舊序號的裝置名額
    if (activeLicensedId && activeLicensedId !== cleanId) {
        await releaseCurrentDeviceSlot();
    }

    isExplicitLogout = false;
    const sessionRef = db.ref(`licenses/${cleanId}/activeSessions/${myDeviceId}`);
    try {
        await sessionRef.onDisconnect().remove();
        await sessionRef.set({
            deviceId: myDeviceId,
            deviceInfo: getDeviceLabel(),
            joinedAt: now,
            lastSeen: now
        });
    } catch (err) {
        console.error("[AccessGate] 登記裝置在線狀態失敗:", err);
        return {
            ok: false,
            code: "SESSION_WRITE_FAILED",
            message: "登記在線設備失敗，請稍後再試。"
        };
    }

    currentMode = "licensed";
    activeLicensedId = cleanId;
    saveAuthState({
        confirmed: true,
        mode: "licensed",
        licenseId: cleanId,
        loggedInAt: now
    });

    startSessionKeepAlive(cleanId, myDeviceId);

    if (window.UserStore && typeof window.UserStore.switchUser === "function") {
        await window.UserStore.switchUser(cleanId);
    } else {
        localStorage.setItem("boshen_active_user_id", cleanId);
        localStorage.setItem("boshen_license_key", cleanId);
    }

    syncAuthHeaderButton();
    return { ok: true, mode: "licensed", licenseId: cleanId, maxDevices };
}

async function releaseCurrentDeviceSlot() {
    const prevId = activeLicensedId;
    stopSessionKeepAlive();
    activeLicensedId = null;

    if (!prevId || prevId === TRIAL_LICENSE_ID) return;
    try {
        const db = getDb();
        const myDeviceId = getOrCreateDeviceId();
        const ref = db.ref(`licenses/${prevId}/activeSessions/${myDeviceId}`);
        await ref.onDisconnect().cancel().catch(() => {});
        await ref.remove();
    } catch (err) {
        console.warn("[AccessGate] 釋放裝置名額失敗:", err);
    }
}

export async function enterTrialMode() {
    isExplicitLogout = true;
    await releaseCurrentDeviceSlot();
    isExplicitLogout = false;

    currentMode = "trial";
    activeLicensedId = null;
    saveAuthState({
        confirmed: true,
        mode: "trial",
        licenseId: TRIAL_LICENSE_ID,
        loggedInAt: Date.now()
    });

    if (window.UserStore && typeof window.UserStore.switchUser === "function") {
        await window.UserStore.switchUser(TRIAL_LICENSE_ID);
    } else {
        localStorage.setItem("boshen_active_user_id", TRIAL_LICENSE_ID);
        localStorage.setItem("boshen_license_key", TRIAL_LICENSE_ID);
    }

    syncAuthHeaderButton();
    return { ok: true, mode: "trial", licenseId: TRIAL_LICENSE_ID };
}

export async function logoutSession({ showGate = true, notice = "" } = {}) {
    isExplicitLogout = true;
    await releaseCurrentDeviceSlot();
    clearAuthState();
    currentMode = "trial";

    if (window.UserStore && typeof window.UserStore.switchUser === "function") {
        await window.UserStore.switchUser(TRIAL_LICENSE_ID);
    }

    syncAuthHeaderButton();

    if (showGate) {
        await openAccessGateOverlay({
            dismissible: false,
            initialError: notice
        });
        if (typeof window.reloadCurrentModule === "function") {
            window.reloadCurrentModule();
        }
    }
}

export function syncAuthHeaderButton() {
    const btn = document.getElementById("top-auth-action-btn");
    const idEl = document.getElementById("top-bind-id");
    if (!btn) return;

    const trial = isTrialMode();
    if (trial) {
        btn.textContent = "試用版｜輸入序號";
        btn.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition cursor-pointer";
        btn.onclick = () => openUpgradeGate();
        if (idEl && idEl.textContent === TRIAL_LICENSE_ID) {
            idEl.textContent = `${TRIAL_LICENSE_ID}（試用）`;
        }
    } else {
        btn.textContent = "登出";
        btn.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-slate-700 bg-slate-800 hover:bg-rose-900/60 hover:border-rose-500/60 text-slate-300 hover:text-rose-200 transition cursor-pointer";
        btn.onclick = async () => {
            if (!confirm(`確定要登出序號「${activeLicensedId}」並釋放此裝置上線名額嗎？`)) return;
            await logoutSession({ showGate: true });
        };
    }
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function openAccessGateOverlay(options = {}) {
    const {
        dismissible = false,
        initialLicenseId = "",
        initialError = ""
    } = options;

    const existing = document.getElementById("access-gate-overlay");
    if (existing) existing.remove();

    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.id = "access-gate-overlay";
        overlay.className = "access-gate-backdrop";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        overlay.innerHTML = `
            <div class="access-gate-card">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <span class="access-gate-badge">SYSTEM ACCESS</span>
                        <h2 class="access-gate-title mt-2">歡迎來到博深數位學習小站</h2>
                        <p class="access-gate-subtitle mt-1">請輸入開通序號登入完整版，或使用免序號試用版體驗</p>
                    </div>
                    ${dismissible ? `
                        <button type="button" id="gate-close-btn"
                            class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer shrink-0">
                            ✕
                        </button>
                    ` : ""}
                </div>

                <!-- 1. 序號登入區 -->
                <div class="access-gate-section space-y-3">
                    <label for="gate-license-input" class="block text-xs font-black text-slate-200">
                        🔑 授權序號（ID）開通登入
                    </label>
                    <div class="flex gap-2">
                        <input type="text" id="gate-license-input" value="${escapeHtml(initialLicenseId)}"
                            placeholder="請輸入授權序號（ID）"
                            autocomplete="off"
                            class="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border-2 border-slate-700 text-sm font-mono font-bold uppercase text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400" />
                        <button type="button" id="gate-login-btn"
                            class="access-gate-btn-primary px-5 py-2.5 rounded-xl font-black text-sm shrink-0 cursor-pointer transition">
                            登入
                        </button>
                    </div>
                    <p id="gate-error-msg" class="${initialError ? "" : "hidden"} text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-700/60 rounded-xl p-3 leading-relaxed">
                        ${escapeHtml(initialError)}
                    </p>
                    <p class="text-[11px] text-slate-400">
                        ※ 登入過即自動記住，除非主動登出；同一組序號依授權數限制同時上線設備數。
                    </p>
                </div>

                <!-- 2. 免序號試用版 -->
                <div class="access-gate-section flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div class="text-xs font-black text-amber-300">✨ 免序號試用版（${TRIAL_LICENSE_ID}）</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">開放 50 個核心單字、2 篇 elem1 閱讀測驗與卡牌體驗</div>
                    </div>
                    <button type="button" id="gate-trial-btn"
                        class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-black text-xs shrink-0 cursor-pointer transition">
                        ${dismissible ? "繼續試用" : "進入試用版 →"}
                    </button>
                </div>

                <!-- 3. 聯繫 LINE 客服取得序號 -->
                <div class="access-gate-line-box flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div class="text-xs font-black text-emerald-300">💬 聯繫 LINE 客服取得序號</div>
                        <div class="text-xs text-slate-300 mt-0.5">
                            官方客服 ID：<strong class="font-mono text-emerald-300 select-all">${LINE_SUPPORT_ID}</strong>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" id="gate-copy-line-btn"
                            class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 font-bold text-xs cursor-pointer transition">
                            複製 ID
                        </button>
                        <a href="${LINE_SUPPORT_URL}" target="_blank" rel="noopener noreferrer"
                           class="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition inline-flex items-center gap-1">
                            <span>開啟 LINE</span>
                            <span class="text-[10px]">↗</span>
                        </a>
                    </div>
                </div>
            </div>
        `;

        const inputEl = overlay.querySelector("#gate-license-input");
        const loginBtn = overlay.querySelector("#gate-login-btn");
        const trialBtn = overlay.querySelector("#gate-trial-btn");
        const copyBtn = overlay.querySelector("#gate-copy-line-btn");
        const errEl = overlay.querySelector("#gate-error-msg");
        const closeBtn = overlay.querySelector("#gate-close-btn");

        const showError = (msg) => {
            if (!errEl) return;
            errEl.textContent = msg;
            errEl.classList.remove("hidden");
        };

        const finish = (result) => {
            overlay.remove();
            resolve(result);
        };

        const submitLogin = async () => {
            const rawVal = inputEl.value.trim();
            if (!rawVal) {
                showError("請先輸入授權序號（ID）。");
                inputEl.focus();
                return;
            }
            if (errEl) errEl.classList.add("hidden");
            loginBtn.disabled = true;
            loginBtn.textContent = "驗證中...";

            const res = await verifyAndLoginLicense(rawVal);
            if (res.ok) {
                finish(res);
            } else {
                showError(res.message || "登入失敗，請稍後再試。");
                loginBtn.disabled = false;
                loginBtn.textContent = "登入";
            }
        };

        loginBtn.onclick = submitLogin;
        inputEl.onkeydown = (e) => {
            if (e.key === "Enter") submitLogin();
        };

        trialBtn.onclick = async () => {
            trialBtn.disabled = true;
            if (dismissible) {
                finish({ ok: true, mode: "trial", cancelled: true });
                return;
            }
            const res = await enterTrialMode();
            finish(res);
        };

        if (closeBtn) {
            closeBtn.onclick = () => finish({ ok: false, cancelled: true });
        }

        if (copyBtn) {
            copyBtn.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(LINE_SUPPORT_ID);
                    copyBtn.textContent = "已複製 ✓";
                    setTimeout(() => { copyBtn.textContent = "複製 ID"; }, 2000);
                } catch {
                    prompt("請手動複製官方 LINE 客服 ID：", LINE_SUPPORT_ID);
                }
            };
        }

        document.body.appendChild(overlay);
        setTimeout(() => inputEl?.focus(), 50);
    });
}

export async function openUpgradeGate() {
    const res = await openAccessGateOverlay({ dismissible: true });
    if (res && res.ok && res.mode === "licensed") {
        if (typeof window.reloadCurrentModule === "function") {
            window.reloadCurrentModule();
        }
    }
    return res;
}

/**
 * 系統啟動閘道檢查（由 router.js 呼叫）：
 * - 之前已登入正式序號 → 自動複驗 status === "啟用" 與 maxdevice，通過直接放行
 * - 之前已選試用版 → 直接以 50TEST 進入
 * - 首次進入（無登入紀錄） → 先以 50TEST 初始化並彈出首頁登入閘道
 */
export async function ensureAccessReady() {
    if (initialized) {
        syncAuthHeaderButton();
        return { mode: currentMode, licenseId: activeLicensedId || TRIAL_LICENSE_ID };
    }

    getDb();

    // 監聽跨分頁登出或切換序號
    window.addEventListener("storage", (e) => {
        if (e.key === AUTH_STATE_KEY) {
            const next = getSavedAuthState();
            if (!next || !next.confirmed) {
                stopSessionKeepAlive();
                activeLicensedId = null;
                currentMode = "trial";
                syncAuthHeaderButton();
                openAccessGateOverlay({ dismissible: false }).then(() => {
                    if (typeof window.reloadCurrentModule === "function") {
                        window.reloadCurrentModule();
                    }
                });
            }
        }
    });

    const saved = getSavedAuthState();

    if (saved && saved.confirmed) {
        if (saved.mode === "licensed" && saved.licenseId && saved.licenseId !== TRIAL_LICENSE_ID) {
            const res = await verifyAndLoginLicense(saved.licenseId);
            if (res.ok) {
                initialized = true;
                return res;
            }
            // 原序號被停用或同時在線超過上限 → 停在登入閘道並告知原因
            clearAuthState();
            currentMode = "trial";
            if (window.UserStore?.switchUser) {
                await window.UserStore.switchUser(TRIAL_LICENSE_ID);
            }
            syncAuthHeaderButton();
            const retryRes = await openAccessGateOverlay({
                dismissible: false,
                initialLicenseId: saved.licenseId,
                initialError: res.message
            });
            initialized = true;
            return retryRes;
        }

        // 之前已選擇免序號試用版 → 直接進入 50TEST
        await enterTrialMode();
        initialized = true;
        return { ok: true, mode: "trial", licenseId: TRIAL_LICENSE_ID };
    }

    // 首次進入（無登入紀錄）：預設底層為 50TEST，顯示登入閘道
    currentMode = "trial";
    if (window.UserStore?.switchUser) {
        await window.UserStore.switchUser(TRIAL_LICENSE_ID);
    }
    syncAuthHeaderButton();

    const gateRes = await openAccessGateOverlay({ dismissible: false });
    initialized = true;
    return gateRes;
}

if (typeof window !== "undefined") {
    window.AccessGate = {
        TRIAL_LICENSE_ID,
        LINE_SUPPORT_ID,
        LINE_SUPPORT_URL,
        isTrialMode,
        getAccessLimits,
        verifyAndLoginLicense,
        enterTrialMode,
        logoutSession,
        openAccessGateOverlay,
        openUpgradeGate,
        ensureAccessReady,
        syncAuthHeaderButton
    };
}
