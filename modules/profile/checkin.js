// modules/profile/checkin.js
// 連續登入與迷你綠色簽到日曆子模組

function formatDateStr(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getTodayStr() {
    return formatDateStr(new Date());
}

function getYesterdayStr() {
    const dt = new Date();
    dt.setDate(dt.getDate() - 1);
    return formatDateStr(dt);
}

function parseDateStr(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/**
 * 根據目前的 streak 與 anchorDate（最近簽到/登入日），推算出連續登入的日期集合
 */
function getActiveStreakDateSet(streak, anchorDateStr, checkinHistory) {
    const streakSet = new Set();
    const n = Number(streak) || 0;
    if (n <= 0 || !anchorDateStr) return streakSet;

    const anchor = parseDateStr(anchorDateStr);
    if (!anchor) return streakSet;

    for (let i = 0; i < n; i++) {
        const dt = new Date(anchor);
        dt.setDate(anchor.getDate() - i);
        const key = formatDateStr(dt);
        if (checkinHistory[key] || i === 0) {
            streakSet.add(key);
        }
    }
    return streakSet;
}

function buildMiniMonthCalendar(checkinHistory, streakDateSet, todayStr) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const firstDayWeekday = new Date(year, month, 1).getDay(); // 0=日 ~ 6=六
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weekHeaders = ["日", "一", "二", "三", "四", "五", "六"];
    let html = weekHeaders
        .map(w => `<div class="text-[10px] font-bold text-slate-400 text-center py-1">${w}</div>`)
        .join("");

    // 月初空白格
    for (let empty = 0; empty < firstDayWeekday; empty++) {
        html += `<div class="h-8 rounded-lg bg-slate-950/30"></div>`;
    }

    // 當月每一天
    for (let day = 1; day <= daysInMonth; day++) {
        const mStr = String(month + 1).padStart(2, "0");
        const dStr = String(day).padStart(2, "0");
        const dateStr = `${year}-${mStr}-${dStr}`;
        const isChecked = Boolean(checkinHistory[dateStr]);
        const isInStreak = streakDateSet.has(dateStr);
        const isToday = dateStr === todayStr;

        let cellClass = "bg-slate-950/70 border-slate-800/80 text-slate-500";
        let streakDot = "";

        if (isChecked || isInStreak) {
            cellClass = isInStreak
                ? "bg-emerald-500/30 border-emerald-400 text-emerald-200 font-black shadow-sm"
                : "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold";
            if (isInStreak) {
                streakDot = `<span class="w-1 h-1 rounded-full bg-amber-300 mt-0.5"></span>`;
            }
        } else if (isToday) {
            cellClass = "bg-slate-900 border-amber-400/80 text-amber-300 font-bold";
        }

        const todayRing = isToday ? "ring-1 ring-amber-300/70" : "";
        const tipText = `${dateStr}${isInStreak ? "（連續登入）" : isChecked ? "（已簽到）" : isToday ? "（今日待簽到）" : ""}`;

        html += `
            <div title="${tipText}"
                 class="h-8 rounded-lg border flex flex-col items-center justify-center text-[11px] leading-none select-none transition ${cellClass} ${todayRing}">
                <span>${day}</span>
                ${streakDot}
            </div>
        `;
    }

    return {
        monthLabel: `${year} 年 ${month + 1} 月`,
        gridHtml: html
    };
}

export function renderCheckinSection(container, state) {
    if (!container) return;

    const userData = state.userData || {};
    const today = getTodayStr();
    const streak = Number(userData.streak) || 0;
    const shields = Number(userData.streakShields) || 0;
    const latestLoginDate = userData.latestLoginDate || userData.lastCheckinDate || "";
    const checkinHistory = { ...(userData.checkinHistory || {}) };

    if (latestLoginDate && !checkinHistory[latestLoginDate]) {
        checkinHistory[latestLoginDate] = true;
    }

    const isCheckedToday = Boolean(checkinHistory[today]) || latestLoginDate === today;
    const totalCheckinDays = Object.keys(checkinHistory).length;
    const streakDateSet = getActiveStreakDateSet(streak, latestLoginDate, checkinHistory);
    const { monthLabel, gridHtml } = buildMiniMonthCalendar(checkinHistory, streakDateSet, today);
    const rewardCoins = window.UserStore
        ? Number(window.UserStore.getRule("daily_checkin_bonus", 10))
        : 10;

    container.innerHTML = `
        <div class="theme-card rounded-2xl border border-slate-700 overflow-hidden shadow-sm" style="background: #1e293b; color: #f8fafc;">
            <!-- 日曆頂部標題列 -->
            <div class="px-4 py-3 bg-slate-900/90 border-b border-slate-700/80 flex items-center justify-between gap-2">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-black text-emerald-400">📅 ${monthLabel}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            連續 ${streak} 天
                        </span>
                    </div>
                    <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>累計 <strong class="text-sky-300">${totalCheckinDays}</strong> 天</span>
                        <span>·</span>
                        <span>最近登入 <strong class="font-mono text-slate-200">${latestLoginDate || "無"}</strong></span>
                        ${shields > 0 ? `<span>·</span><span>🛡️ <strong class="text-indigo-300">${shields}</strong></span>` : ""}
                    </div>
                </div>

                <button type="button" id="daily-checkin-btn"
                    ${isCheckedToday ? "disabled" : ""}
                    class="px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                        isCheckedToday
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow"
                    }">
                    ${isCheckedToday ? "✓ 已簽到" : `✨ 打卡 +${rewardCoins}`}
                </button>
            </div>

            <!-- 迷你綠色日曆主體 -->
            <div class="p-3 space-y-2.5">
                <div class="grid grid-cols-7 gap-1">
                    ${gridHtml}
                </div>

                <!-- 日曆圖例 -->
                <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <div class="flex items-center gap-3">
                        <span class="flex items-center gap-1">
                            <span class="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-400/70 inline-block"></span>
                            <span>簽到日</span>
                        </span>
                        <span class="flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block"></span>
                            <span>連續登入</span>
                        </span>
                    </div>
                    <span class="text-slate-500">金框＝今日</span>
                </div>
            </div>
        </div>
    `;
}

export function bindCheckinSection(container, ctx) {
    if (!container) return;

    const btn = container.querySelector("#daily-checkin-btn");
    if (!btn) return;

    btn.onclick = async () => {
        const { licenseKey, userData } = ctx.getState();
        const today = getTodayStr();
        const yesterday = getYesterdayStr();
        const checkinHistory = { ...(userData.checkinHistory || {}) };
        const lastDate = userData.latestLoginDate || userData.lastCheckinDate || "";

        if (checkinHistory[today] || lastDate === today) return;

        btn.disabled = true;
        btn.textContent = "儲存中...";

        const rewardCoins = window.UserStore
            ? Number(window.UserStore.getRule("daily_checkin_bonus", 10))
            : 10;
        const storePoints = window.UserStore?.getState()?.profile?.points;
        const baseCoins = Number(storePoints ?? userData.points ?? userData.coins ?? 0) || 0;
        const nextCoins = baseCoins + rewardCoins;
        const nextStreak = (lastDate === yesterday || checkinHistory[yesterday])
            ? (Number(userData.streak) || 0) + 1
            : 1;
        checkinHistory[today] = true;

        try {
            if (licenseKey && licenseKey !== "GUEST" && licenseKey !== "50TEST") {
                await ctx.db.ref(`licenses/${licenseKey}`).update({
                    coins: nextCoins,
                    streak: nextStreak,
                    lastCheckinDate: today,
                    latestLoginDate: today,
                    checkinHistory: checkinHistory
                });
            }

            await ctx.updateUserData({
                points: nextCoins,
                coins: nextCoins,
                streak: nextStreak,
                lastCheckinDate: today,
                latestLoginDate: today,
                checkinHistory: checkinHistory
            });
        } catch (err) {
            console.error(err);
            alert("❌ 打卡儲存失敗：" + err.message);
            btn.disabled = false;
            btn.textContent = `✨ 打卡 +${rewardCoins}`;
        }
    };
}