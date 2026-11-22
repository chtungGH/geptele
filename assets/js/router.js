import { applyTheme, initThemeObserver } from "./themes.js";
import { ensureAccessReady, syncAuthHeaderButton } from "./accessGate.js";

export const MODULES = [
    { id: "home", name: "首頁", path: "../../modules/home/script.js", showInNav: true },
    { id: "lobby", name: "學習大廳", path: "../../modules/lobby/script.js", showInNav: true },
    { id: "shop", name: "商城", path: "../../modules/shop/script.js", showInNav: false },          // 暫時隱藏商城分頁
    { id: "card", name: "卡牌", path: "../../modules/card/script.js", showInNav: true },           // 👈 第四个按鈕：卡牌圖鑑
    { id: "profile", name: "個人資料", path: "../../modules/profile/main.js", showInNav: true },    // 第五个按鈕：個人資料
    
    // 子單元（由大廳卡片點擊進入）
    { id: "vocabulary", name: "單字選擇", path: "../../modules/vocabulary/script.js", showInNav: false },
    { id: "sentences", name: "情境句子", path: "../../modules/sentences/script.js", showInNav: false },
    { id: "cloze", name: "克漏字填空", path: "../../modules/cloze/script.js", showInNav: false },
    { id: "reading", name: "閱讀測驗", path: "../../modules/reading/script.js", showInNav: false }
];

let currentModule = null;

function syncCurrentTheme(root = document) {
    const themeId = (window.UserStore && typeof window.UserStore.getTheme === "function")
        ? window.UserStore.getTheme()
        : (localStorage.getItem("boshen_active_theme") || "default");
    applyTheme(themeId, root);
}

async function loadModule(moduleId) {
    const modConfig = MODULES.find(m => m.id === moduleId);
    if (!modConfig) {
        console.error(`找不到對應的模組設定: ${moduleId}`);
        return;
    }

    const container = document.getElementById("app-view");
    if (!container) return;
    
    if (currentModule && typeof currentModule.destroy === "function") {
        currentModule.destroy();
    }

    container.innerHTML = `<div class="loading-spinner" style="text-align: center; color: #94a3b8; margin-top: 40px; font-size: 1.1rem;">載入中...</div>`;

    try {
        const moduleExports = await import(modConfig.path);
        currentModule = moduleExports.default;

        if (currentModule && typeof currentModule.init === "function") {
            await currentModule.init(container);
        }

        syncCurrentTheme(container);
        syncAuthHeaderButton();
        updateNavActiveState(moduleId);
    } catch (error) {
        console.error(`載入模組失敗 [${moduleId}]:`, error);
        container.innerHTML = `<p class="error-msg" style="text-align: center; color: #f87171; margin-top: 40px;">抱歉，載入此單元時發生錯誤，請檢查主控台 (F12)。</p>`;
    }
}

function renderNav() {
    const navMenu = document.getElementById("nav-menu");
    if (!navMenu) return;

    const navModules = MODULES.filter(mod => mod.showInNav);

    navMenu.innerHTML = navModules.map(mod => `
        <button class="nav-btn flex-1 py-2 text-center text-xs font-bold text-slate-400 hover:text-sky-400 transition cursor-pointer" data-id="${mod.id}">
            <span data-theme-copy="nav.${mod.id}">${mod.name}</span>
        </button>
    `).join("");

    navMenu.onclick = (e) => {
        const btn = e.target.closest(".nav-btn");
        if (btn) {
            const moduleId = btn.getAttribute("data-id");
            if (!moduleId) return;
            const targetHash = `#${moduleId}`;
            if (window.location.hash !== targetHash) {
                window.location.hash = moduleId;
            } else {
                loadModule(moduleId);
            }
        }
    };
}

function updateNavActiveState(activeId) {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        if (btn.getAttribute("data-id") === activeId) {
            btn.classList.add("text-sky-400");
            btn.classList.remove("text-slate-400");
        } else {
            btn.classList.remove("text-sky-400");
            btn.classList.add("text-slate-400");
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRouter);
} else {
    initRouter();
}

let accessGateReady = false;

async function initRouter() {
    renderNav();
    syncCurrentTheme(document);
    initThemeObserver(document.getElementById("app-view"));

    // 先通過總管制（續登驗證或首次首頁登入閘道），通過後再載入對應模組
    await ensureAccessReady();
    accessGateReady = true;

    const initialHash = window.location.hash.replace("#", "") || MODULES[0].id;
    loadModule(initialHash);
}

window.reloadCurrentModule = () => {
    const hash = window.location.hash.replace("#", "") || MODULES[0].id;
    loadModule(hash);
};

window.addEventListener("hashchange", () => {
    if (!accessGateReady) return;
    const hash = window.location.hash.replace("#", "");
    if (hash) {
        loadModule(hash);
    }
});