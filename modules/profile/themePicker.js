// modules/profile/themePicker.js
// 個人資料頁：主題／皮膚切換子模組

import { getThemeList, getCurrentTheme, applyTheme } from "../../assets/js/themes.js";

export function renderThemePickerSection(container) {
    if (!container) return;

    const store = window.UserStore;
    const activeTheme = (store && typeof store.getTheme === "function")
        ? store.getTheme()
        : getCurrentTheme();
    const themes = getThemeList();

    const cardsHtml = themes.map((t) => {
        const isSelected = t.id === activeTheme;
        return `
            <button type="button" data-theme-option="${t.id}"
                class="theme-option-btn text-left p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                        ? "border-amber-400 bg-slate-900/95 shadow-lg"
                        : "border-slate-700/80 bg-slate-950/60 hover:border-slate-500"
                }">
                <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-black text-sm text-slate-100">${t.name}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            isSelected
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                        }">
                            ${isSelected ? "✓ 使用中" : t.badge}
                        </span>
                    </div>

                    <!-- 色票預覽列 -->
                    <div class="flex items-center gap-2 pt-0.5">
                        <span class="w-5 h-5 rounded-full border border-white/20 shadow-inner" style="background: ${t.preview.bg};" title="頁面底色"></span>
                        <span class="w-5 h-5 rounded-full border border-white/20 shadow-inner" style="background: ${t.preview.card};" title="卡片底色"></span>
                        <span class="w-5 h-5 rounded-full border border-white/20 shadow-inner" style="background: ${t.preview.accent};" title="強調色"></span>
                        <span class="ml-auto text-[10px] font-bold text-slate-400">${t.fontLabel}</span>
                    </div>

                    <p class="text-[11px] text-slate-400 leading-relaxed">${t.description}</p>
                </div>

                <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span class="text-slate-400 truncate">風格示例：${t.copy["nav.lobby"]}</span>
                    <span class="font-bold shrink-0 ${isSelected ? "text-emerald-400" : "text-sky-400"}">
                        ${isSelected ? "已套用" : "點此切換 →"}
                    </span>
                </div>
            </button>
        `;
    }).join("");

    container.innerHTML = `
        <div class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-4" style="background: #1e293b; color: #f8fafc;">
            <div class="flex items-center justify-between gap-2 border-b border-slate-700 pb-3">
                <div>
                    <h3 class="font-black text-base theme-accent-text">🎨 介面主題與皮膚切換</h3>
                    <p class="text-xs text-slate-400 mt-0.5">切換全站配色、標題字型與介面按鈕文案，並自動同步至跨分頁與帳號設定</p>
                </div>
                <span id="theme-save-status" class="text-xs font-bold text-emerald-400 shrink-0"></span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                ${cardsHtml}
            </div>
        </div>
    `;
}

export function bindThemePickerSection(container) {
    if (!container) return;

    container.querySelectorAll(".theme-option-btn").forEach((btn) => {
        btn.onclick = async () => {
            const nextTheme = btn.getAttribute("data-theme-option");
            if (!nextTheme) return;

            const theme = applyTheme(nextTheme, document);
            const store = window.UserStore;

            if (store && typeof store.setTheme === "function") {
                await store.setTheme(theme.id);
            } else {
                localStorage.setItem("boshen_active_theme", theme.id);
            }

            renderThemePickerSection(container);
            bindThemePickerSection(container);

            const statusEl = container.querySelector("#theme-save-status");
            if (statusEl) {
                statusEl.textContent = `✅ 已切換為「${theme.name}」`;
                setTimeout(() => {
                    const el = container.querySelector("#theme-save-status");
                    if (el) el.textContent = "";
                }, 2200);
            }
        };
    });
}
