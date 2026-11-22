// assets/js/themes.js
// 主題字典、按鈕／介面文案切換（data-theme-copy）與動態 DOM 觀察器

export const DEFAULT_THEME = "default";

export const THEMES = {
    default: {
        id: "default",
        name: "星際藍夜",
        badge: "預設主題",
        description: "經典深藍學習介面與無襯線字型，清晰耐看。",
        fontLabel: "現代無襯線",
        preview: {
            bg: "#0f172a",
            card: "#1e293b",
            accent: "#38bdf8",
            text: "#f8fafc"
        },
        copy: {
            "app.title": "玩轉數位學習小站－GEPT英檢初級單字練習",
            "nav.home": "首頁",
            "nav.lobby": "學習大廳",
            "nav.shop": "商城",
            "nav.card": "卡牌",
            "nav.profile": "個人資料",
            "btn.backLobby": "← 返回大廳",
            "home.title": "歡迎回到首頁！",
            "home.subtitle": "歡迎回來！請開始今天的學習！",
            "lobby.title": "學習大廳",
            "lobby.subtitle": "請選擇您要挑戰的學習單元：",
            "unit.vocab.title": "1. 核心單字選擇題",
            "unit.sentences.title": "2. 生活情境句子選擇題",
            "unit.cloze.title": "3. 智慧克漏字填空",
            "unit.reading.title": "4. 閱讀測驗專區",
            "profile.title": "👤 個人學習檔案",
            "profile.refresh": "🔄 重新同步"
        }
    },
    adventure: {
        id: "adventure",
        name: "秘境森語",
        badge: "冒險風格",
        description: "深翠綠與琥珀金配色搭配典雅襯線標題，像踏上字彙冒險旅程。",
        fontLabel: "典雅襯線標題",
        preview: {
            bg: "#071a17",
            card: "#0f2d27",
            accent: "#f59e0b",
            text: "#f0fdf4"
        },
        copy: {
            "app.title": "秘境森語冒險站－GEPT英檢初級試煉",
            "nav.home": "營地",
            "nav.lobby": "冒險公會",
            "nav.shop": "補給站",
            "nav.card": "聖典圖鑑",
            "nav.profile": "冒險者日誌",
            "btn.backLobby": "← 返回公會",
            "home.title": "歡迎回到冒險營地！",
            "home.subtitle": "歡迎回來！請開始今天的冒險學習！",
            "lobby.title": "冒險公會任務板",
            "lobby.subtitle": "選擇您要接取的英語試煉關卡：",
            "unit.vocab.title": "1. 符文單字試煉",
            "unit.sentences.title": "2. 旅途對話挑戰",
            "unit.cloze.title": "3. 古卷拼寫填空",
            "unit.reading.title": "4. 秘境長文解讀",
            "profile.title": "🧭 冒險者檔案",
            "profile.refresh": "🔄 同步日誌"
        }
    },
    cyber: {
        id: "cyber",
        name: "紫電賽博",
        badge: "未來風格",
        description: "深靛紫底色與霓虹紫粉強調色，搭配科技等寬標題字型。",
        fontLabel: "科技等寬標題",
        preview: {
            bg: "#0b0718",
            card: "#17112e",
            accent: "#c084fc",
            text: "#f5f3ff"
        },
        copy: {
            "app.title": "CYBER 數位訓練站－GEPT初級模組",
            "nav.home": "主控台",
            "nav.lobby": "任務中樞",
            "nav.shop": "裝備庫",
            "nav.card": "數據圖鑑",
            "nav.profile": "系統檔案",
            "btn.backLobby": "← 返回中樞",
            "home.title": "歡迎連線至主控台！",
            "home.subtitle": "歡迎回來！請開始今天的學習協議！",
            "lobby.title": "任務中樞 // LOBBY",
            "lobby.subtitle": "點選下方模組啟動能力訓練：",
            "unit.vocab.title": "1. 核心字彙掃描",
            "unit.sentences.title": "2. 語境訊號應對",
            "unit.cloze.title": "3. 拼寫矩陣填補",
            "unit.reading.title": "4. 深度文本解析",
            "profile.title": "⚡ 系統個人檔案",
            "profile.refresh": "🔄 重新連線"
        }
    }
};

let activeThemeId = DEFAULT_THEME;
let domObserver = null;

export function isValidTheme(themeId) {
    return typeof themeId === "string" && Object.prototype.hasOwnProperty.call(THEMES, themeId);
}

export function getThemeConfig(themeId) {
    return isValidTheme(themeId) ? THEMES[themeId] : THEMES[DEFAULT_THEME];
}

export function getThemeList() {
    return Object.values(THEMES);
}

export function getCurrentTheme() {
    const domTheme = document.documentElement?.dataset?.theme;
    if (isValidTheme(domTheme)) return domTheme;
    return activeThemeId;
}

function applyCopyToElement(el, copyDict) {
    if (!el || el.nodeType !== 1) return;
    const key = el.getAttribute("data-theme-copy");
    if (!key) return;
    const nextText = copyDict[key];
    if (typeof nextText === "string" && el.textContent !== nextText) {
        el.textContent = nextText;
    }
}

/**
 * 將主題文案套用至指定 root（支援整個 document 或動態產生的單一容器／節點）
 */
export function applyThemeCopy(themeId = activeThemeId, root = document) {
    const theme = getThemeConfig(themeId);
    const copyDict = theme.copy || {};
    if (!root) return;

    if (root.nodeType === 1) {
        applyCopyToElement(root, copyDict);
    }

    if (typeof root.querySelectorAll === "function") {
        root.querySelectorAll("[data-theme-copy]").forEach((el) => {
            applyCopyToElement(el, copyDict);
        });
    }
}

/**
 * 套用主題外觀（html[data-theme] + CSS 變數）與所有 data-theme-copy 介面文案
 */
export function applyTheme(themeId, root = document) {
    const theme = getThemeConfig(themeId);
    activeThemeId = theme.id;

    if (document.documentElement) {
        document.documentElement.dataset.theme = theme.id;
    }

    // 清除商城舊版直接寫在 body 的行內背景色，避免覆蓋 theme.css 變數
    if (document.body && document.body.style.backgroundColor) {
        document.body.style.backgroundColor = "";
    }

    applyThemeCopy(theme.id, root);
    return theme;
}

/**
 * 監聽動態插入的 DOM 節點（例如模組切換或子區塊重繪），自動套用目前主題文案
 */
export function initThemeObserver(targetEl = document.getElementById("app-view")) {
    if (!targetEl || typeof MutationObserver === "undefined") return null;

    if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
    }

    domObserver = new MutationObserver((mutations) => {
        const theme = getThemeConfig(activeThemeId);
        const copyDict = theme.copy || {};

        for (const mutation of mutations) {
            if (!mutation.addedNodes || mutation.addedNodes.length === 0) continue;
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                applyCopyToElement(node, copyDict);
                if (typeof node.querySelectorAll === "function") {
                    node.querySelectorAll("[data-theme-copy]").forEach((el) => {
                        applyCopyToElement(el, copyDict);
                    });
                }
            });
        }
    });

    domObserver.observe(targetEl, { childList: true, subtree: true });
    return domObserver;
}

if (typeof window !== "undefined") {
    window.applyTheme = applyTheme;
    window.ThemeManager = {
        DEFAULT_THEME,
        THEMES,
        isValidTheme,
        getThemeList,
        getThemeConfig,
        getCurrentTheme,
        applyTheme,
        applyThemeCopy,
        initThemeObserver
    };
}
