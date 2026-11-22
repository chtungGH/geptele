// modules/home/script.js
// 深色簡潔風格「學習總覽 Dashboard」：
// 1. 歡迎回到首頁橫幅
// 2. 最新消息（Firebase announcements，支援圖片公告、點擊放大與破圖降級）
// 3. 今日學習狀況（連續簽到天數、今日是否已簽到、未簽到提供個人資料打卡快捷鍵）
// 4. 核心戰果總覽（三個時速表式圓環：熟練單字量、已完成卡片數／總卡片數、已取得成就數／總成就數）

import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
import {
    getCachedMastery,
    getCachedThreshold,
    getMasterySummary,
    loadWordMasteryState,
    loadSharedWordBank
} from "../../assets/js/wordMastery.js";

const DB_URL = "https://chtreadingcompre-default-rtdb.firebaseio.com/";
const DEFAULT_VISIBLE_ANNOUNCEMENTS = 3;

const GAUGE_RADIUS = 56;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const GAUGE_ARC = GAUGE_CIRCUMFERENCE * (240 / 360); // 240° 時速表圓弧

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sanitizeUrl(raw) {
    const val = String(raw || "").trim();
    if (!val) return "";
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(val)) {
        return val;
    }
    return "";
}

function getTodayStr() {
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatDateLabel(rawDate) {
    if (!rawDate) return "";
    if (typeof rawDate === "number") {
        const dt = new Date(rawDate);
        if (!Number.isNaN(dt.getTime())) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, "0");
            const d = String(dt.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }
        return "";
    }
    const str = String(rawDate).trim();
    const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
    return isoMatch ? isoMatch[1] : str;
}

function parseSortTime(rawDate) {
    if (!rawDate) return 0;
    if (typeof rawDate === "number") return rawDate;
    const t = Date.parse(String(rawDate));
    return Number.isNaN(t) ? 0 : t;
}

function normalizeAnnouncements(rawVal) {
    if (!rawVal || typeof rawVal !== "object") return [];

    const entries = Array.isArray(rawVal)
        ? rawVal.map((item, idx) => [String(idx), item])
        : Object.entries(rawVal);

    return entries
        .filter(([, item]) => {
            if (!item || typeof item !== "object") return false;
            if (item.active === false || item.visible === false || item.enabled === false) {
                return false;
            }
            return Boolean(
                item.title || item.Title || item.標題 ||
                item.content || item.message || item.body || item.內容 ||
                item.imageUrl || item.image || item.imgUrl || item.圖片
            );
        })
        .map(([key, item]) => {
            const rawDate = item.date ?? item.createdAt ?? item.updatedAt ?? item.日期 ?? "";
            const title = String(item.title || item.Title || item.標題 || "系統公告").trim();
            const content = String(item.content || item.message || item.body || item.內容 || "").trim();
            const tag = String(item.tag || item.type || item.category || item.標籤 || "").trim();
            const imageUrl = sanitizeUrl(item.imageUrl || item.image || item.imgUrl || item.圖片 || "");
            const imageAlt = String(item.imageAlt || item.alt || title || "公告圖片").trim();
            const linkUrl = sanitizeUrl(item.linkUrl || item.url || item.連結 || "");
            const linkText = String(item.linkText || "查看詳情").trim();
            const pinned = Boolean(item.pinned || item.isPinned || item.置頂);
            const order = item.order !== undefined && item.order !== null && !Number.isNaN(Number(item.order))
                ? Number(item.order)
                : null;

            return {
                id: key,
                title,
                content,
                tag,
                dateLabel: formatDateLabel(rawDate),
                sortTime: parseSortTime(rawDate),
                pinned,
                order,
                imageUrl,
                imageAlt,
                linkUrl,
                linkText
            };
        })
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            if (a.order !== null && b.order !== null && a.order !== b.order) {
                return a.order - b.order;
            }
            if (a.order !== null && b.order === null) return -1;
            if (a.order === null && b.order !== null) return 1;
            if (a.sortTime !== b.sortTime) return b.sortTime - a.sortTime;
            return String(b.id).localeCompare(String(a.id));
        });
}

function getTagBadgeClass(tag) {
    const t = String(tag || "").trim();
    if (/重要|公告|緊急|alert|important/i.test(t)) {
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
    if (/活動|獎勵|event|bonus/i.test(t)) {
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
    if (/更新|新功能|update|new/i.test(t)) {
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
    return "bg-sky-500/20 text-sky-300 border-sky-500/40";
}

function readCachedTotalMetaCards() {
    try {
        const raw = localStorage.getItem("boshen_cards_catalog_cache");
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;
    } catch {
        return 0;
    }
}

/**
 * 建構時速表樣式 SVG 圓環儀表
 */
function buildSpeedometerGaugeHtml({
    gradId,
    colorStart,
    colorEnd,
    label,
    value,
    total,
    unit,
    subText,
    navTarget = "",
    isPlaceholder = false
}) {
    const safeVal = Math.max(0, Number(value) || 0);
    const safeTotal = Math.max(0, Number(total) || 0);
    const ratio = safeTotal > 0 ? Math.min(1, safeVal / safeTotal) : 0;
    const percentText = isPlaceholder
        ? "即將開放"
        : (safeTotal > 0 ? `${Math.round(ratio * 100)}%` : "0%");
    const filledLen = (ratio * GAUGE_ARC).toFixed(2);
    const arcLen = GAUGE_ARC.toFixed(2);
    const fullLen = GAUGE_CIRCUMFERENCE.toFixed(2);
    const fractionText = isPlaceholder
        ? `${safeVal} / --`
        : `${safeVal} / ${safeTotal > 0 ? safeTotal : "--"} ${unit}`;

    const tagName = navTarget ? "button" : "div";
    const interactiveAttrs = navTarget
        ? `type="button" data-nav-target="${escapeHtml(navTarget)}" class="home-gauge-card bg-slate-950/65 hover:bg-slate-900/90 border border-slate-800 hover:border-sky-400/60 rounded-2xl p-4 flex flex-col items-center justify-between gap-1.5 transition cursor-pointer w-full"`
        : `class="home-gauge-card bg-slate-950/65 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-between gap-1.5 w-full ${isPlaceholder ? "opacity-85" : ""}"`;

    return `
        <${tagName} ${interactiveAttrs}>
            <div class="text-xs font-black text-slate-200 tracking-wide">${escapeHtml(label)}</div>

            <div class="relative w-36 h-[118px] flex items-center justify-center">
                <svg viewBox="0 0 160 132" class="w-full h-full overflow-visible" aria-label="${escapeHtml(label)}">
                    <defs>
                        <linearGradient id="${escapeHtml(gradId)}" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="${colorStart}" />
                            <stop offset="100%" stop-color="${colorEnd}" />
                        </linearGradient>
                    </defs>

                    <!-- 背景刻度底弧（240° 時速表開口朝下） -->
                    <circle
                        cx="80" cy="78" r="${GAUGE_RADIUS}"
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.18)"
                        stroke-width="11"
                        stroke-linecap="round"
                        stroke-dasharray="${arcLen} ${fullLen}"
                        transform="rotate(150 80 78)" />

                    <!-- 彩色進度弧 -->
                    <circle
                        cx="80" cy="78" r="${GAUGE_RADIUS}"
                        fill="none"
                        stroke="url(#${escapeHtml(gradId)})"
                        stroke-width="11"
                        stroke-linecap="round"
                        stroke-dasharray="${filledLen} ${fullLen}"
                        stroke-opacity="${ratio > 0 ? "1" : "0"}"
                        transform="rotate(150 80 78)"
                        style="transition: stroke-dasharray 0.7s cubic-bezier(0.22, 1, 0.36, 1);" />

                    <!-- 中央大數字 -->
                    <text x="80" y="76" text-anchor="middle" dominant-baseline="middle"
                          fill="#f8fafc" font-size="28" font-weight="900"
                          style="font-family: var(--font-mono, ui-monospace, monospace);">
                        ${safeVal}
                    </text>

                    <!-- 百分比或狀態小標 -->
                    <text x="80" y="102" text-anchor="middle" dominant-baseline="middle"
                          fill="${isPlaceholder ? "#94a3b8" : colorEnd}" font-size="11" font-weight="800"
                          style="font-family: var(--font-mono, ui-monospace, monospace);">
                        ${escapeHtml(percentText)}
                    </text>
                </svg>
            </div>

            <div class="text-center space-y-0.5">
                <div class="text-xs font-mono font-bold text-slate-300">${escapeHtml(fractionText)}</div>
                <div class="text-[10px] text-slate-500">${escapeHtml(subText)}</div>
            </div>
        </${tagName}>
    `;
}

export default {
    id: "home",

    init: async function(container) {
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: DB_URL });
        }
        const db = firebase.database();
        const store = window.UserStore;

        let isDestroyed = false;
        let announcements = [];
        let showAllAnnouncements = false;
        let isLoadingAnnouncements = true;
        let announcementsError = "";

        // 今日學習狀況（簽到）狀態
        let checkinState = {
            loaded: false,
            streak: 0,
            isCheckedToday: false,
            latestDate: ""
        };

        // 核心戰果總覽數據
        let masteredExcludedCount = 0;
        let masteryThreshold = 3;
        let totalWordBankCount = 0;
        let totalMetaCardsCount = readCachedTotalMetaCards();

        const getSnapshot = () => {
            if (store && typeof store.getState === "function") {
                return store.getState();
            }
            return {
                userId: localStorage.getItem("boshen_active_user_id") || "50TEST",
                profile: {}
            };
        };

        const computeLocalMastery = (uid) => {
            const mMap = getCachedMastery(uid);
            const th = getCachedThreshold(uid);
            masteryThreshold = th;
            masteredExcludedCount = getMasterySummary([], mMap, th).excludedTotal;
        };

        computeLocalMastery(getSnapshot().userId);

        container.innerHTML = `
            <div class="max-w-4xl mx-auto space-y-5 pb-10">
                <!-- 第 1 區：歡迎回到首頁橫幅 -->
                <section class="theme-card p-5 sm:p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center flex-wrap gap-2">
                            <span id="home-account-pill" class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-900/90 text-sky-300 border border-slate-700">ID: --</span>
                            <span id="home-mode-badge" class="hidden px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">試用版</span>
                        </div>
                        <h1 data-theme-copy="home.title" class="text-xl sm:text-2xl font-black text-sky-400 tracking-tight">歡迎回到首頁！</h1>
                        <p data-theme-copy="home.subtitle" class="text-xs sm:text-sm text-slate-400">歡迎回來！請開始今天的學習！</p>
                    </div>
                    <div class="flex items-center flex-wrap gap-2 shrink-0">
                        <button type="button" id="home-upgrade-btn" class="hidden px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold text-xs transition cursor-pointer">
                            🔑 輸入序號開通
                        </button>
                        <button type="button" id="home-goto-lobby-btn" class="theme-accent-bg px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow transition cursor-pointer">
                            進入學習大廳 →
                        </button>
                    </div>
                </section>

                <!-- 第 2 區：最新消息（Firebase announcements，支援圖片公告與點擊放大） -->
                <section class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-3.5" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/80">
                        <div class="flex items-center gap-2">
                            <h2 class="font-black text-base text-slate-100">📢 最新消息</h2>
                            <span id="home-ann-count" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-700">載入中</span>
                        </div>
                        <button type="button" id="home-ann-refresh-btn" class="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-[11px] font-bold text-slate-300 border border-slate-700 transition cursor-pointer">
                            🔄 重新整理
                        </button>
                    </div>
                    <div id="home-announcements-list" class="space-y-3">
                        <div class="text-xs text-slate-400 py-5 text-center">⏳ 正在載入最新消息...</div>
                    </div>
                </section>

                <!-- 第 3 區：今日學習狀況（連續簽到天數 + 今日是否簽到 + 未簽到打卡快捷鍵） -->
                <section class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-3.5" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/80">
                        <h2 class="font-black text-base text-slate-100">📅 今日學習狀況</h2>
                        <span id="home-today-date" class="text-[11px] font-mono text-slate-400">${getTodayStr()}</span>
                    </div>

                    <div id="home-today-status-body" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                        <div class="flex items-center gap-4 flex-wrap">
                            <div class="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-center min-w-[92px]">
                                <div class="text-[10px] font-bold text-slate-400">連續簽到</div>
                                <div class="text-xl font-black text-amber-300 font-mono mt-0.5"><span id="home-streak-days">0</span> <span class="text-xs font-bold text-slate-400">天</span></div>
                            </div>
                            <div class="space-y-1">
                                <div id="home-checkin-status-badge" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300 border border-slate-700">
                                    ⏳ 讀取簽到狀態中...
                                </div>
                                <p id="home-checkin-subtext" class="text-xs text-slate-400">每天打卡累積連續天數與積點獎勵</p>
                            </div>
                        </div>

                        <button type="button" id="home-goto-checkin-btn"
                            class="hidden px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow transition cursor-pointer shrink-0">
                            ✨ 前往個人資料打卡 →
                        </button>
                    </div>
                </section>

                <!-- 第 4 區：核心戰果總覽（三個時速表式圓環） -->
                <section class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-4" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/80">
                        <h2 class="font-black text-base text-slate-100">🏆 核心戰果總覽</h2>
                        <span class="text-[11px] text-slate-400">點擊圓環可檢視詳細內容</span>
                    </div>

                    <div id="home-gauges-grid" class="grid grid-cols-1 sm:grid-cols-3 gap-3.5"></div>
                </section>
            </div>
        `;

        // 圖片公告放大檢視（Lightbox Modal）
        let activeLightboxEl = null;
        const closeLightbox = () => {
            if (activeLightboxEl) {
                activeLightboxEl.remove();
                activeLightboxEl = null;
            }
        };
        const handleLightboxKeydown = (e) => {
            if (e.key === "Escape") closeLightbox();
        };
        document.addEventListener("keydown", handleLightboxKeydown);

        function openImageLightbox(imageUrl, captionText) {
            closeLightbox();
            const safeUrl = sanitizeUrl(imageUrl);
            if (!safeUrl) return;

            const modal = document.createElement("div");
            modal.id = "home-ann-lightbox";
            modal.className = "fixed inset-0 z-[75] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4";
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");
            modal.innerHTML = `
                <div class="relative max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3">
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-xs sm:text-sm font-black text-slate-200 truncate">${escapeHtml(captionText || "公告圖片")}</span>
                        <button type="button" id="home-lightbox-close-btn"
                            class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center justify-center cursor-pointer shrink-0">
                            ✕
                        </button>
                    </div>
                    <div class="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center min-h-[160px]">
                        <img id="home-lightbox-img" src="${escapeHtml(safeUrl)}" alt="${escapeHtml(captionText || "公告圖片")}"
                             class="max-h-[78vh] max-w-full object-contain" />
                    </div>
                </div>
            `;

            const closeBtn = modal.querySelector("#home-lightbox-close-btn");
            const lbImg = modal.querySelector("#home-lightbox-img");
            if (closeBtn) closeBtn.onclick = closeLightbox;
            modal.onclick = (e) => {
                if (e.target === modal) closeLightbox();
            };
            if (lbImg) {
                lbImg.onerror = () => closeLightbox();
            }

            document.body.appendChild(modal);
            activeLightboxEl = modal;
        }

        function renderHeroAndStatus() {
            if (isDestroyed) return;
            const snap = getSnapshot();
            const uid = snap.userId || "50TEST";
            const p = snap.profile || {};
            const isTrial = window.AccessGate?.isTrialMode?.() ?? (uid === "50TEST" || uid === "GUEST");

            const accountPill = container.querySelector("#home-account-pill");
            const modeBadge = container.querySelector("#home-mode-badge");
            const upgradeBtn = container.querySelector("#home-upgrade-btn");

            if (accountPill) {
                const displayName = p.name && p.name !== uid ? `${p.name} (${uid})` : `ID: ${uid}`;
                accountPill.textContent = displayName;
            }
            if (modeBadge) modeBadge.classList.toggle("hidden", !isTrial);
            if (upgradeBtn) upgradeBtn.classList.toggle("hidden", !isTrial);

            // 更新第 3 區：今日學習狀況（簽到）
            const streakEl = container.querySelector("#home-streak-days");
            const badgeEl = container.querySelector("#home-checkin-status-badge");
            const subEl = container.querySelector("#home-checkin-subtext");
            const checkinBtn = container.querySelector("#home-goto-checkin-btn");

            if (streakEl) streakEl.textContent = String(checkinState.streak);

            if (!checkinState.loaded) {
                if (badgeEl) {
                    badgeEl.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300 border border-slate-700";
                    badgeEl.textContent = "⏳ 讀取簽到狀態中...";
                }
                if (checkinBtn) checkinBtn.classList.add("hidden");
            } else if (checkinState.isCheckedToday) {
                if (badgeEl) {
                    badgeEl.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
                    badgeEl.textContent = "✅ 今日已完成簽到";
                }
                if (subEl) {
                    const totalPractice = Number(p.practiceStats?.totalCount || 0);
                    subEl.textContent = `太棒了！今日已打卡完成（累計已完成 ${totalPractice} 次練習）`;
                }
                if (checkinBtn) checkinBtn.classList.add("hidden");
            } else {
                if (badgeEl) {
                    badgeEl.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40";
                    badgeEl.textContent = "⏳ 今日尚未簽到";
                }
                if (subEl) {
                    subEl.textContent = "今天還沒打卡喔！前往個人資料頁完成今日簽到領取積點。";
                }
                if (checkinBtn) checkinBtn.classList.remove("hidden");
            }

            renderCoreGauges();
        }

        function renderCoreGauges() {
            if (isDestroyed) return;
            const gridEl = container.querySelector("#home-gauges-grid");
            if (!gridEl) return;

            const snap = getSnapshot();
            const p = snap.profile || {};
            const cardsObj = p.cards || {};
            const uniqueCards = Object.values(cardsObj).filter((n) => Number(n || 0) > 0).length;

            // 成就系統預留（日後接上 profile.achievements 與總成就數即可自動顯示比例）
            const achievementsObj = p.achievements || {};
            const unlockedAchievements = Object.values(achievementsObj).filter(Boolean).length;
            const totalAchievements = Number(p.totalAchievements || 0);
            const hasAchievementsReady = totalAchievements > 0;

            const vocabGaugeHtml = buildSpeedometerGaugeHtml({
                gradId: "home-gauge-vocab",
                colorStart: "#10b981",
                colorEnd: "#38bdf8",
                label: "📚 熟練單字量",
                value: masteredExcludedCount,
                total: totalWordBankCount,
                unit: "字",
                subText: `滿 ${masteryThreshold} 次熟練 · 管理單字 →`,
                navTarget: "profile"
            });

            const cardGaugeHtml = buildSpeedometerGaugeHtml({
                gradId: "home-gauge-cards",
                colorStart: "#a855f7",
                colorEnd: "#ec4899",
                label: "🎴 卡牌收藏進度",
                value: uniqueCards,
                total: totalMetaCardsCount,
                unit: "張",
                subText: "已完成卡片 / 總卡片 · 前往圖鑑 →",
                navTarget: "card"
            });

            const achieveGaugeHtml = buildSpeedometerGaugeHtml({
                gradId: "home-gauge-achieve",
                colorStart: "#f59e0b",
                colorEnd: "#fbbf24",
                label: "🏅 成就達成數",
                value: unlockedAchievements,
                total: totalAchievements,
                unit: "項",
                subText: hasAchievementsReady ? "已取得成就 / 總成就" : "成就系統建置中，敬請期待",
                isPlaceholder: !hasAchievementsReady
            });

            gridEl.innerHTML = vocabGaugeHtml + cardGaugeHtml + achieveGaugeHtml;

            gridEl.querySelectorAll("[data-nav-target]").forEach((btn) => {
                btn.onclick = () => {
                    const target = btn.getAttribute("data-nav-target");
                    if (target) window.location.hash = target;
                };
            });
        }

        function renderAnnouncements() {
            if (isDestroyed) return;
            const listEl = container.querySelector("#home-announcements-list");
            const countEl = container.querySelector("#home-ann-count");
            if (!listEl) return;

            if (isLoadingAnnouncements) {
                if (countEl) countEl.textContent = "載入中";
                listEl.innerHTML = `<div class="text-xs text-slate-400 py-5 text-center">⏳ 正在載入最新消息...</div>`;
                return;
            }

            if (announcementsError) {
                if (countEl) countEl.textContent = "讀取異常";
                listEl.innerHTML = `
                    <div class="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-center">
                        ⚠️ 暫時無法載入最新消息（${escapeHtml(announcementsError)}），請點擊右上角「重新整理」重試。
                    </div>
                `;
                return;
            }

            if (announcements.length === 0) {
                if (countEl) countEl.textContent = "0 則";
                listEl.innerHTML = `
                    <div class="text-xs text-slate-400 bg-slate-950/40 border border-slate-800 rounded-xl p-5 text-center">
                        目前尚無最新公告。
                    </div>
                `;
                return;
            }

            if (countEl) countEl.textContent = `${announcements.length} 則`;
            const visibleList = showAllAnnouncements
                ? announcements
                : announcements.slice(0, DEFAULT_VISIBLE_ANNOUNCEMENTS);

            const cardsHtml = visibleList.map((ann) => {
                const tagHtml = ann.tag
                    ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${getTagBadgeClass(ann.tag)}">${escapeHtml(ann.tag)}</span>`
                    : "";
                const pinHtml = ann.pinned
                    ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">📌 置頂</span>`
                    : "";
                const dateHtml = ann.dateLabel
                    ? `<span class="text-[11px] font-mono text-slate-500 shrink-0">${escapeHtml(ann.dateLabel)}</span>`
                    : "";

                const imageBlockHtml = ann.imageUrl
                    ? `
                        <div class="home-ann-img-wrap relative mt-2.5 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 cursor-zoom-in group"
                             data-img-url="${escapeHtml(ann.imageUrl)}"
                             data-img-caption="${escapeHtml(ann.imageAlt || ann.title)}">
                            <img src="${escapeHtml(ann.imageUrl)}"
                                 alt="${escapeHtml(ann.imageAlt)}"
                                 loading="lazy"
                                 class="home-ann-img w-full max-h-56 object-cover transition duration-300 group-hover:scale-[1.02]" />
                            <span class="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-700 text-[10px] font-bold text-slate-200 pointer-events-none">
                                🔍 點擊放大
                            </span>
                        </div>
                    `
                    : "";

                const contentHtml = ann.content
                    ? `<p class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line mt-1.5">${escapeHtml(ann.content)}</p>`
                    : "";

                const linkHtml = ann.linkUrl
                    ? `
                        <div class="mt-2.5">
                            <a href="${escapeHtml(ann.linkUrl)}" target="_blank" rel="noopener noreferrer"
                               class="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2">
                                <span>${escapeHtml(ann.linkText)}</span>
                                <span>↗</span>
                            </a>
                        </div>
                    `
                    : "";

                return `
                    <article class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center flex-wrap gap-1.5 min-w-0">
                                ${pinHtml}
                                ${tagHtml}
                                <h3 class="font-black text-sm sm:text-base text-slate-100 leading-snug">${escapeHtml(ann.title)}</h3>
                            </div>
                            ${dateHtml}
                        </div>
                        ${contentHtml}
                        ${imageBlockHtml}
                        ${linkHtml}
                    </article>
                `;
            }).join("");

            const toggleMoreHtml = announcements.length > DEFAULT_VISIBLE_ANNOUNCEMENTS
                ? `
                    <button type="button" id="home-ann-toggle-all-btn"
                        class="w-full py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer">
                        ${showAllAnnouncements
                            ? "收合公告 ▴"
                            : `展開全部公告（共 ${announcements.length} 則）▾`}
                    </button>
                `
                : "";

            listEl.innerHTML = cardsHtml + toggleMoreHtml;

            listEl.querySelectorAll(".home-ann-img-wrap").forEach((wrap) => {
                const img = wrap.querySelector(".home-ann-img");
                const dropBrokenWrapper = () => {
                    if (wrap.parentNode) wrap.remove();
                };

                if (img) {
                    img.onerror = dropBrokenWrapper;
                    if (img.complete && img.naturalWidth === 0) {
                        dropBrokenWrapper();
                        return;
                    }
                }

                wrap.onclick = () => {
                    const url = wrap.getAttribute("data-img-url");
                    const caption = wrap.getAttribute("data-img-caption");
                    if (url) openImageLightbox(url, caption);
                };
            });

            const toggleBtn = listEl.querySelector("#home-ann-toggle-all-btn");
            if (toggleBtn) {
                toggleBtn.onclick = () => {
                    showAllAnnouncements = !showAllAnnouncements;
                    renderAnnouncements();
                };
            }
        }

        async function loadAnnouncements() {
            isLoadingAnnouncements = true;
            announcementsError = "";
            renderAnnouncements();

            try {
                const snap = await db.ref("announcements").once("value");
                if (isDestroyed) return;
                announcements = normalizeAnnouncements(snap.val());
            } catch (err) {
                console.error("[Home] 讀取最新消息失敗:", err);
                if (isDestroyed) return;
                announcementsError = err?.message || "連線逾時";
            } finally {
                if (!isDestroyed) {
                    isLoadingAnnouncements = false;
                    renderAnnouncements();
                }
            }
        }

        async function syncHomeCloudData(uid) {
            const limits = window.AccessGate?.getAccessLimits?.() || { isTrial: false, wordLimit: 50 };
            const today = getTodayStr();

            try {
                const [licSnap, metaSnap, masteryState, wordBank] = await Promise.all([
                    db.ref(`licenses/${uid}`).once("value").catch(() => null),
                    totalMetaCardsCount > 0 ? Promise.resolve(null) : db.ref("cards_meta").once("value").catch(() => null),
                    loadWordMasteryState(uid, db).catch(() => null),
                    loadSharedWordBank(db, { trialOnly: limits.isTrial, limit: limits.wordLimit }).catch(() => [])
                ]);

                if (isDestroyed) return;

                // 1. 今日簽到狀態
                const licData = (licSnap && licSnap.exists()) ? (licSnap.val() || {}) : {};
                const checkinHistory = licData.checkinHistory || {};
                const latestDate = licData.latestLoginDate || licData.lastCheckinDate || "";
                const isCheckedToday = Boolean(checkinHistory[today]) || latestDate === today;

                checkinState = {
                    loaded: true,
                    streak: Number(licData.streak) || 0,
                    isCheckedToday,
                    latestDate
                };

                // 2. 總卡牌數
                if (metaSnap && metaSnap.exists()) {
                    totalMetaCardsCount = Object.keys(metaSnap.val() || {}).length;
                }

                // 3. 單字庫總數與熟練單字量
                if (Array.isArray(wordBank) && wordBank.length > 0) {
                    totalWordBankCount = wordBank.length;
                } else if (limits.isTrial) {
                    totalWordBankCount = limits.wordLimit;
                }

                if (masteryState) {
                    masteryThreshold = masteryState.threshold;
                    masteredExcludedCount = getMasterySummary(
                        Array.isArray(wordBank) ? wordBank : [],
                        masteryState.masteryMap,
                        masteryState.threshold
                    ).excludedTotal;
                }

                renderHeroAndStatus();
            } catch (err) {
                console.warn("[Home] 同步首頁戰果與簽到資料失敗:", err);
                if (!isDestroyed) {
                    checkinState.loaded = true;
                    renderHeroAndStatus();
                }
            }
        }

        // 綁定互動按鈕
        const gotoLobbyBtn = container.querySelector("#home-goto-lobby-btn");
        if (gotoLobbyBtn) {
            gotoLobbyBtn.onclick = () => { window.location.hash = "lobby"; };
        }

        const gotoCheckinBtn = container.querySelector("#home-goto-checkin-btn");
        if (gotoCheckinBtn) {
            gotoCheckinBtn.onclick = () => { window.location.hash = "profile"; };
        }

        const upgradeBtn = container.querySelector("#home-upgrade-btn");
        if (upgradeBtn) {
            upgradeBtn.onclick = () => {
                if (window.AccessGate && typeof window.AccessGate.openUpgradeGate === "function") {
                    window.AccessGate.openUpgradeGate();
                }
            };
        }

        const refreshAnnBtn = container.querySelector("#home-ann-refresh-btn");
        if (refreshAnnBtn) {
            refreshAnnBtn.onclick = () => loadAnnouncements();
        }

        // 訂閱 UserStore 變化即時更新
        let unsubscribeStore = null;
        let lastUid = getSnapshot().userId;
        if (store && typeof store.subscribe === "function") {
            unsubscribeStore = store.subscribe((_eventName, snapshot) => {
                if (isDestroyed) return;
                if (snapshot?.userId && snapshot.userId !== lastUid) {
                    lastUid = snapshot.userId;
                    computeLocalMastery(lastUid);
                    syncHomeCloudData(lastUid);
                }
                renderHeroAndStatus();
            });
        } else {
            renderHeroAndStatus();
        }

        loadAnnouncements();
        syncHomeCloudData(lastUid);

        this._cleanup = () => {
            isDestroyed = true;
            closeLightbox();
            document.removeEventListener("keydown", handleLightboxKeydown);
            if (typeof unsubscribeStore === "function") {
                unsubscribeStore();
            }
        };
    },

    destroy: function() {
        if (typeof this._cleanup === "function") {
            this._cleanup();
            this._cleanup = null;
        }
        console.log("Home module destroyed.");
    }
};
