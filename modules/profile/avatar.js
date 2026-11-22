// modules/profile/avatar.js
// 帳號資訊、序號切換與分組牌疊頭像挑選器子模組（含預選與確定／取消機制）

const FALLBACK_AVATARS = [
    { id: "AV01", category: "HolyBease", AvatarName: "青龍", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A01.jpg" },
    { id: "AV02", category: "HolyBease", AvatarName: "白虎", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A02.jpg" },
    { id: "AV03", category: "HolyBease", AvatarName: "朱雀", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A03.jpg" },
    { id: "AV04", category: "HolyBease", AvatarName: "玄武", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A04.jpg" },
    { id: "AV05", category: "HolyBease", AvatarName: "瑞鹿", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A05.jpg" },
    { id: "AV06", category: "HolyBease", AvatarName: "玉兔", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A06.jpg" },
    { id: "AV07", category: "HolyBease", AvatarName: "仙狐", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A07.jpg" },
    { id: "AV08", category: "HolyBease", AvatarName: "鳳凰", imageUrl: "https://github.com/chtungGH/boshen-study2/raw/main/avatar/AVAR_A08.jpg" }
];

// 挑選器互動狀態（未按「確定」前只存在本地暫存，不改動實際頭像）
const pickerUI = {
    licenseKey: "",
    isOpen: false,
    expandedCategory: null,
    pendingAvatarId: null,
    flashMessage: ""
};

function getAvatarList(state) {
    if (Array.isArray(state.avatars) && state.avatars.length > 0) {
        return state.avatars;
    }
    return FALLBACK_AVATARS;
}

function getSelectedAvatar(state) {
    const list = getAvatarList(state);
    const userData = state.userData || {};
    const savedId = userData.avatarId || localStorage.getItem(`boshen_avatar_${state.licenseKey}`) || "AV01";
    const matched = list.find(item => item.id === savedId) || list[0] || FALLBACK_AVATARS[0];

    return {
        ...matched,
        imageUrl: userData.avatarUrl || matched.imageUrl
    };
}

function groupAvatarsByCategory(avatarList) {
    const groups = [];
    const map = new Map();

    avatarList.forEach((av) => {
        const cat = String(av.category || "其他系列").trim() || "其他系列";
        if (!map.has(cat)) {
            const group = { category: cat, items: [] };
            map.set(cat, group);
            groups.push(group);
        }
        map.get(cat).items.push(av);
    });

    return groups;
}

function resetPickerUI(licenseKey, activeId) {
    pickerUI.licenseKey = licenseKey;
    pickerUI.isOpen = false;
    pickerUI.expandedCategory = null;
    pickerUI.pendingAvatarId = activeId;
}

function buildGroupDeckCardHtml(group, index, activeAvatarId, pendingAvatarId, isExpanded) {
    const items = group.items;
    const cover = items[0];
    const stackedTail = items.slice(1, 5); // 後方最多呈現 4 層疊起卡片
    const containsPending = Boolean(pendingAvatarId) && items.some((a) => a.id === pendingAvatarId);

    const stackOffsets = [
        { left: 16, scale: 0.94, opacity: 0.88, z: 24 },
        { left: 30, scale: 0.88, opacity: 0.72, z: 20 },
        { left: 42, scale: 0.82, opacity: 0.56, z: 16 },
        { left: 52, scale: 0.76, opacity: 0.42, z: 12 }
    ];

    const tailHtml = stackedTail.map((av, i) => {
        const cfg = stackOffsets[i];
        return `
            <img src="${av.imageUrl}" alt=""
                 class="avatar-deck-tail absolute top-0 w-16 h-16 rounded-xl object-cover border border-slate-600/80 bg-slate-900 shadow-md pointer-events-none transition-transform duration-200"
                 style="left: ${cfg.left}px; z-index: ${cfg.z}; opacity: ${cfg.opacity}; --tail-scale: ${cfg.scale}; transform-origin: center right;" />
        `;
    }).join("");

    const deckWidth = 64 + (stackedTail.length > 0 ? stackOffsets[stackedTail.length - 1].left : 0);

    return `
        <button type="button" data-group-index="${index}"
            class="avatar-group-deck group text-left p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col items-center gap-2.5 ${
                isExpanded
                    ? "bg-sky-500/15 border-sky-400 shadow-lg shadow-sky-500/10"
                    : containsPending && pendingAvatarId !== activeAvatarId
                        ? "bg-amber-500/10 border-amber-400/70 hover:border-amber-300"
                        : "bg-slate-950/80 border-slate-800 hover:border-slate-500"
            }">
            <div class="text-xs font-black text-slate-100 truncate w-full text-center">${group.category}</div>

            <!-- 一排疊在一起的頭像卡片 -->
            <div class="relative h-16 shrink-0" style="width: ${deckWidth}px;">
                ${tailHtml}
                <img src="${cover.imageUrl}" alt="${cover.AvatarName || cover.id}"
                     class="relative w-16 h-16 rounded-xl object-cover border-2 ${isExpanded ? "border-sky-400" : "border-slate-500 group-hover:border-sky-300"} bg-slate-900 shadow-xl transition"
                     style="z-index: 30;" />
            </div>

            <div class="text-[11px] font-bold ${isExpanded ? "text-sky-300" : "text-slate-300 group-hover:text-sky-300"}">
                ${isExpanded ? "收合 ▴" : "拉開 ▾"}
            </div>
        </button>
    `;
}

function buildExpandedGroupHtml(group, activeAvatarId, pendingAvatarId) {
    if (!group) return "";

    const itemsHtml = group.items.map((av) => {
        const isPending = av.id === pendingAvatarId;
        const isCurrent = av.id === activeAvatarId;
        return `
            <button type="button" data-avatar-id="${av.id}"
                class="avatar-option-btn relative flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                    isPending
                        ? "bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10"
                        : isCurrent
                            ? "bg-emerald-500/10 border-emerald-500/50 text-slate-100 hover:border-sky-400"
                            : "bg-slate-950/85 border-slate-800 hover:border-slate-500 text-slate-300"
                }">
                <img src="${av.imageUrl}" alt="${av.AvatarName || av.id}"
                     class="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-900 border border-slate-700" />
                <div class="min-w-0 flex-1">
                    <div class="text-xs font-black truncate">${av.AvatarName || av.id}</div>
                    ${isPending
                        ? '<div class="text-[10px] font-bold text-amber-300 mt-0.5">★ 已選取</div>'
                        : isCurrent
                            ? '<div class="text-[10px] font-bold text-emerald-400 mt-0.5">✓ 使用中</div>'
                            : ""}
                </div>
            </button>
        `;
    }).join("");

    return `
        <div class="avatar-expanded-drawer bg-slate-950/70 p-3.5 rounded-2xl border border-sky-500/40 space-y-3">
            <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <span class="text-xs font-black text-sky-300 truncate">${group.category}</span>
                <button type="button" id="avatar-collapse-group-btn"
                    class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition cursor-pointer shrink-0">
                    收合 ✕
                </button>
            </div>
            <div id="avatar-picker-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${itemsHtml}
            </div>
        </div>
    `;
}

export function renderAvatarSection(container, state) {
    if (!container) return;

    const userData = state.userData || {};
    const buyer = userData.buyer || "學習者";
    const status = userData.status || "啟用";
    const avatarList = getAvatarList(state);
    const activeAvatar = getSelectedAvatar(state);

    if (pickerUI.licenseKey !== state.licenseKey) {
        resetPickerUI(state.licenseKey, activeAvatar.id);
    }

    const effectivePendingId = pickerUI.pendingAvatarId || activeAvatar.id;
    const pendingAvatar = avatarList.find((a) => a.id === effectivePendingId) || activeAvatar;
    const hasChanged = pendingAvatar.id !== activeAvatar.id;

    const groups = groupAvatarsByCategory(avatarList);
    const expandedGroup = groups.find((g) => g.category === pickerUI.expandedCategory) || null;

    const groupDecksHtml = groups.map((group, idx) =>
        buildGroupDeckCardHtml(
            group,
            idx,
            activeAvatar.id,
            effectivePendingId,
            expandedGroup?.category === group.category
        )
    ).join("");

    const expandedDrawerHtml = expandedGroup
        ? buildExpandedGroupHtml(expandedGroup, activeAvatar.id, effectivePendingId)
        : "";

    container.innerHTML = `
        <style>
            @keyframes avatarDrawerOpen {
                from { opacity: 0; transform: translateY(-6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .avatar-expanded-drawer {
                animation: avatarDrawerOpen 0.22s ease-out;
            }
            .avatar-deck-tail {
                transform: scale(var(--tail-scale, 0.9));
            }
            .avatar-group-deck:hover .avatar-deck-tail {
                transform: translateX(5px) scale(var(--tail-scale, 0.9));
            }
        </style>
        <div class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-4" style="background: #1e293b; color: #f8fafc;">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center space-x-4">
                    <img id="prof-avatar-img" src="${activeAvatar.imageUrl}" alt="${activeAvatar.AvatarName || "頭像"}"
                         class="w-16 h-16 rounded-2xl object-cover border-2 border-sky-400/70 bg-slate-900 shadow-lg shrink-0" />
                    <div>
                        <div class="flex items-center flex-wrap gap-2">
                            <h3 id="prof-buyer-name" class="font-black text-lg text-slate-100">${buyer}</h3>
                            <span id="prof-status-badge" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">${status}</span>
                            <span id="prof-avatar-name" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">${activeAvatar.AvatarName || activeAvatar.id}</span>
                        </div>
                        <p class="text-xs text-slate-400 mt-1">
                            授權序號：<span id="prof-license-text" class="font-mono font-bold text-sky-300">${state.licenseKey}</span>
                            ${pickerUI.flashMessage ? `<span id="avatar-save-status" class="ml-2 text-xs font-bold text-emerald-400">${pickerUI.flashMessage}</span>` : `<span id="avatar-save-status" class="ml-2 text-xs font-bold text-emerald-400"></span>`}
                        </p>
                    </div>
                </div>

                <div class="flex items-center flex-wrap gap-2">
                    <button type="button" id="toggle-avatar-picker-btn"
                        class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow">
                        ${pickerUI.isOpen ? "✕ 收起挑選器" : "🎨 挑選頭像"}
                    </button>
                    <button type="button" id="switch-account-btn"
                        class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer">
                        ${window.AccessGate?.isTrialMode?.() ? "🔑 輸入序號開通" : "🚪 登出帳號"}
                    </button>
                </div>
            </div>

            <!-- 分組牌疊頭像挑選器面板 -->
            <div id="avatar-picker-panel" class="${pickerUI.isOpen ? "" : "hidden"} bg-slate-900/95 p-4 rounded-2xl border border-slate-700 space-y-3.5">
                <!-- 第一層：各系列牌疊卡（系列名 → 疊起頭像 → 拉開） -->
                <div id="avatar-group-list" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    ${groupDecksHtml}
                </div>

                <!-- 第二層：點選牌疊後才拉開的該系列所有頭像 -->
                ${expandedDrawerHtml}

                <!-- 底部預選縮圖與 確定／取消 操作列 -->
                <div class="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <img src="${pendingAvatar.imageUrl}" alt="${pendingAvatar.AvatarName || pendingAvatar.id}"
                             class="w-10 h-10 rounded-xl object-cover border-2 ${hasChanged ? "border-amber-400" : "border-slate-700"} bg-slate-950 shrink-0" />
                        <span class="text-xs font-black truncate ${hasChanged ? "text-amber-300" : "text-slate-300"}">${pendingAvatar.AvatarName || pendingAvatar.id}</span>
                    </div>

                    <div class="flex items-center justify-end gap-2 shrink-0">
                        <button type="button" id="avatar-cancel-btn"
                            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-600 transition cursor-pointer">
                            取消
                        </button>
                        <button type="button" id="avatar-confirm-btn"
                            ${hasChanged ? "" : "disabled"}
                            class="px-5 py-2 rounded-xl font-black text-xs transition ${
                                hasChanged
                                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow cursor-pointer"
                                    : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                            }">
                            確定
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function bindAvatarSection(container, ctx) {
    if (!container) return;

    const rerenderSelf = () => {
        const currentState = ctx.getState();
        renderAvatarSection(container, currentState);
        bindAvatarSection(container, ctx);
    };

    const toggleBtn = container.querySelector("#toggle-avatar-picker-btn");
    const switchBtn = container.querySelector("#switch-account-btn");
    const collapseBtn = container.querySelector("#avatar-collapse-group-btn");
    const cancelBtn = container.querySelector("#avatar-cancel-btn");
    const confirmBtn = container.querySelector("#avatar-confirm-btn");

    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const state = ctx.getState();
            const activeAvatar = getSelectedAvatar(state);
            pickerUI.flashMessage = "";

            if (pickerUI.isOpen) {
                // 收起視同取消未確定之預選
                pickerUI.isOpen = false;
                pickerUI.expandedCategory = null;
                pickerUI.pendingAvatarId = activeAvatar.id;
            } else {
                pickerUI.isOpen = true;
                pickerUI.expandedCategory = null;
                pickerUI.pendingAvatarId = activeAvatar.id;
            }
            rerenderSelf();
        };
    }

    // 點選分組牌疊 → 拉開／收合該系列所有頭像
    container.querySelectorAll(".avatar-group-deck").forEach((deckBtn) => {
        deckBtn.onclick = () => {
            const state = ctx.getState();
            const groups = groupAvatarsByCategory(getAvatarList(state));
            const idx = Number(deckBtn.getAttribute("data-group-index"));
            const targetGroup = groups[idx];
            if (!targetGroup) return;

            pickerUI.expandedCategory =
                pickerUI.expandedCategory === targetGroup.category ? null : targetGroup.category;
            rerenderSelf();
        };
    });

    if (collapseBtn) {
        collapseBtn.onclick = () => {
            pickerUI.expandedCategory = null;
            rerenderSelf();
        };
    }

    // 點選系列內的頭像 → 僅暫存預選，不立即更換
    container.querySelectorAll(".avatar-option-btn").forEach((btn) => {
        btn.onclick = () => {
            const selectedId = btn.getAttribute("data-avatar-id");
            if (!selectedId) return;
            pickerUI.pendingAvatarId = selectedId;
            rerenderSelf();
        };
    });

    // 取消按鈕：放棄預選、關閉挑選器，不變更頭像
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            const state = ctx.getState();
            const activeAvatar = getSelectedAvatar(state);
            pickerUI.isOpen = false;
            pickerUI.expandedCategory = null;
            pickerUI.pendingAvatarId = activeAvatar.id;
            rerenderSelf();
        };
    }

    // 確定按鈕：正式寫入雲端與本地，並更新頭像
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const state = ctx.getState();
            const list = getAvatarList(state);
            const activeAvatar = getSelectedAvatar(state);
            const chosen = list.find((item) => item.id === pickerUI.pendingAvatarId);
            if (!chosen || chosen.id === activeAvatar.id) return;

            confirmBtn.disabled = true;
            confirmBtn.textContent = "儲存中...";
            if (cancelBtn) cancelBtn.disabled = true;

            try {
                if (state.licenseKey && state.licenseKey !== "GUEST" && state.licenseKey !== "50TEST") {
                    await ctx.db.ref(`licenses/${state.licenseKey}`).update({
                        avatarId: chosen.id,
                        avatarUrl: chosen.imageUrl
                    });
                }

                localStorage.setItem(`boshen_avatar_${state.licenseKey}`, chosen.id);
                pickerUI.isOpen = false;
                pickerUI.expandedCategory = null;
                pickerUI.pendingAvatarId = chosen.id;
                pickerUI.flashMessage = `✅ 已更換為「${chosen.AvatarName || chosen.id}」`;

                await ctx.updateUserData({
                    avatarId: chosen.id,
                    avatarUrl: chosen.imageUrl
                });

                setTimeout(() => {
                    pickerUI.flashMessage = "";
                    const el = container.querySelector("#avatar-save-status");
                    if (el) el.textContent = "";
                }, 2500);
            } catch (err) {
                console.error(err);
                alert("❌ 頭像儲存失敗：" + err.message);
                rerenderSelf();
            }
        };
    }

    if (switchBtn) {
        switchBtn.onclick = async () => {
            pickerUI.flashMessage = "";
            if (window.AccessGate) {
                if (window.AccessGate.isTrialMode()) {
                    await window.AccessGate.openUpgradeGate();
                } else {
                    const state = ctx.getState();
                    if (!confirm(`確定要登出序號「${state.licenseKey}」並釋放此設備的同時上線名額嗎？`)) return;
                    await window.AccessGate.logoutSession({ showGate: true });
                }
                return;
            }
            const state = ctx.getState();
            const inputKey = prompt("請輸入要切換的授權序號：", state.licenseKey);
            if (!inputKey) return;
            await ctx.switchLicenseKey(inputKey);
        };
    }
}
