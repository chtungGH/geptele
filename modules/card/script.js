// 直接在模組內引入資料庫 SDK
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

const CARDS_CATALOG_CACHE_KEY = "boshen_cards_catalog_cache";
const OWNED_CARDS_META_PREFIX = "boshen_owned_cards_meta_";
const CARD_IMAGE_CACHE_NAME = "boshen-owned-card-images-v1";
const resolvedImageBlobMap = new Map();

function readLocalCatalogCache() {
    try {
        const raw = localStorage.getItem(CARDS_CATALOG_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function readLocalOwnedCardsMeta(uid) {
    if (!uid) return {};
    try {
        const raw = localStorage.getItem(`${OWNED_CARDS_META_PREFIX}${uid}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

// 僅將「未擁有卡的目錄基本資訊（不含圖片網址）」與「已抽到卡牌的完整資料」存入 localStorage
function saveLocalCardCaches(uid, fullMeta = {}, userCardsMap = {}) {
    try {
        const strippedCatalog = {};
        const ownedMeta = {};

        Object.keys(fullMeta).forEach((id) => {
            const c = fullMeta[id];
            if (!c) return;
            strippedCatalog[id] = {
                id: c.id || id,
                name: c.name || "",
                category: c.category || "未分類",
                rarity: c.rarity || "N"
            };
            if (Number(userCardsMap[id] || 0) > 0) {
                ownedMeta[id] = {
                    id: c.id || id,
                    name: c.name || "",
                    category: c.category || "未分類",
                    rarity: c.rarity || "N",
                    imageUrl: c.imageUrl || "",
                    description: c.description || ""
                };
            }
        });

        if (Object.keys(strippedCatalog).length > 0) {
            localStorage.setItem(CARDS_CATALOG_CACHE_KEY, JSON.stringify(strippedCatalog));
        }
        if (uid) {
            const prevOwned = readLocalOwnedCardsMeta(uid);
            localStorage.setItem(`${OWNED_CARDS_META_PREFIX}${uid}`, JSON.stringify({
                ...prevOwned,
                ...ownedMeta
            }));
        }
    } catch (err) {
        console.warn("[Card] 儲存本地卡牌快取失敗:", err);
    }
}

function getFastImageSrc(remoteUrl) {
    if (!remoteUrl) return "";
    return resolvedImageBlobMap.get(remoteUrl) || remoteUrl;
}

// 從瀏覽器 Cache Storage 還原已快取的卡牌圖片（0ms 本機讀取）
async function hydrateCachedImages(urls = []) {
    if (typeof window === "undefined" || !("caches" in window)) return false;
    const targets = [...new Set(urls.filter((u) => u && !resolvedImageBlobMap.has(u)))];
    if (targets.length === 0) return false;

    let hydratedAny = false;
    try {
        const cache = await caches.open(CARD_IMAGE_CACHE_NAME);
        await Promise.all(
            targets.map(async (url) => {
                try {
                    const cachedRes = await cache.match(url);
                    if (cachedRes && cachedRes.ok) {
                        const blob = await cachedRes.blob();
                        if (blob && blob.size > 0) {
                            resolvedImageBlobMap.set(url, URL.createObjectURL(blob));
                            hydratedAny = true;
                        }
                    }
                } catch {}
            })
        );
    } catch {}
    return hydratedAny;
}

// 背景將已抽到的卡牌圖片寫入瀏覽器本地 Cache Storage，下次開頁直接秒開
async function cacheOwnedCardImages(urls = []) {
    const targets = [...new Set(urls.filter(Boolean))];
    if (targets.length === 0) return;

    if (typeof window === "undefined" || !("caches" in window)) {
        // 退回標準瀏覽器圖片預載快取
        targets.forEach((url) => {
            const img = new Image();
            img.src = url;
        });
        return;
    }

    try {
        const cache = await caches.open(CARD_IMAGE_CACHE_NAME);
        await Promise.all(
            targets.map(async (url) => {
                try {
                    const existing = await cache.match(url);
                    if (existing && existing.ok) {
                        if (!resolvedImageBlobMap.has(url)) {
                            const blob = await existing.blob();
                            if (blob && blob.size > 0) {
                                resolvedImageBlobMap.set(url, URL.createObjectURL(blob));
                            }
                        }
                        return;
                    }
                    const res = await fetch(url, { mode: "cors" });
                    if (res && res.ok) {
                        await cache.put(url, res.clone());
                        const blob = await res.blob();
                        if (blob && blob.size > 0) {
                            resolvedImageBlobMap.set(url, URL.createObjectURL(blob));
                        }
                    }
                } catch {}
            })
        );
    } catch {}
}

export default {
    id: "card",

    init: async function(container) {
        const store = window.UserStore;
        const CARD_BACK_URL = "https://github.com/chtungGH/boshen-study2/raw/main/GEPTEL/images/cards/cardback.jpg";

        let currentLicenseKey = store
            ? store.getState().userId
            : (localStorage.getItem("boshen_license_key") || "TEST01");

        container.innerHTML = `
            <style>
                @keyframes bagPulse {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    25% { transform: scale(1.06) rotate(-3deg); }
                    75% { transform: scale(1.06) rotate(3deg); }
                }
                @keyframes cardPopIn {
                    0% { opacity: 0; transform: translateY(36px) scale(0.35); }
                    70% { opacity: 1; transform: translateY(-6px) scale(1.04); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes cardCollectFly {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-75px) scale(0.25); }
                }
                .gacha-bag-anim {
                    animation: bagPulse 0.9s ease-in-out infinite;
                }
                .gacha-card-enter {
                    animation: cardPopIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .gacha-card-collect {
                    animation: cardCollectFly 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                .flip-scene {
                    perspective: 1000px;
                }
                .flip-inner {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    transition: transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
                    transform-style: preserve-3d;
                }
                .flip-inner.is-flipped {
                    transform: rotateY(180deg);
                }
                .flip-face {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }
                .flip-front {
                    transform: rotateY(180deg);
                }
            </style>

            <div class="space-y-6" style="padding-bottom: 60px;">
                <!-- 頂部導覽與抽卡控制列 -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between theme-card p-4 rounded-2xl border border-slate-700 shadow-sm gap-3" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex items-center space-x-3">
                        <button id="card-back-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-slate-200">← 返回大廳</button>
                        <h2 class="font-black text-purple-400 text-base">🎴 數位收藏卡牌圖鑑</h2>
                    </div>
                    <div class="flex items-center space-x-3">
                        <div class="flex items-center bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30">
                            <span class="mr-1">💰</span>
                            <span id="card-user-coins" class="font-black text-amber-400">--</span> 點
                        </div>
                        <button id="draw-card-btn" class="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition cursor-pointer shadow">
                            🎁 抽取卡包 (30點)
                        </button>
                    </div>
                </div>

                <!-- 系列類別切換分頁列（全部系列放最右邊） -->
                <div id="card-category-tabs" class="flex flex-wrap items-center gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-700">
                    <span class="px-3 py-1.5 text-xs text-slate-400">載入系列中...</span>
                </div>

                <!-- 卡牌圖鑑展示區 -->
                <div class="theme-card p-6 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex items-center justify-between pb-3 border-b border-slate-700">
                        <h3 id="card-stats-title" class="font-black text-lg text-slate-200">✨ 載入中...</h3>
                        <span id="card-collection-progress" class="text-xs font-bold text-purple-400">已蒐集：0 / 0</span>
                    </div>

                    <!-- 卡片網格：手機 2 張、桌機 4 張一列，採用 3:4 直向比例設計 -->
                    <div id="card-grid-container" class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <p class="text-slate-400 text-center col-span-full py-8">⏳ 正在載入卡牌資料...</p>
                    </div>
                </div>
            </div>

            <!-- 🎁 三連抽互動舞台 Modal -->
            <div id="gacha-modal" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 hidden flex items-center justify-center p-4 overflow-y-auto">
                <div class="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl my-auto" style="color: #f8fafc;">
                    <div class="text-center space-y-1">
                        <h3 id="gacha-stage-title" class="text-xl sm:text-2xl font-black text-purple-300">🎒 召喚卡包中...</h3>
                        <p id="gacha-stage-hint" class="text-xs sm:text-sm text-slate-400">能量正在聚集，準備抽出三張卡牌！</p>
                    </div>

                    <!-- 階段 1：卡包袋子現身 -->
                    <div id="gacha-bag-stage" class="py-10 flex flex-col items-center justify-center space-y-4">
                        <div id="gacha-bag-visual" class="gacha-bag-anim w-36 h-44 rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-700 to-amber-500 p-1 shadow-2xl shadow-purple-500/30 flex items-center justify-center">
                            <div class="w-full h-full bg-slate-950/85 rounded-[20px] flex flex-col items-center justify-center space-y-2 border border-purple-400/30">
                                <span class="text-5xl">🎒</span>
                                <span class="text-xs font-black tracking-widest text-amber-300">MYSTERY PACK</span>
                            </div>
                        </div>
                        <span class="text-xs font-bold text-purple-400 animate-pulse">✨ 正在抽出 3 張卡牌...</span>
                    </div>

                    <!-- 階段 2 & 3：三張牌抽出變大、背面排列、逐一點擊翻開、翻開後可再點放大 -->
                    <div id="gacha-cards-stage" class="hidden grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5"></div>

                    <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                        <span id="gacha-flip-counter" class="text-xs font-bold text-slate-400"></span>
                        <button id="gacha-finish-btn" class="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-xs rounded-xl transition cursor-pointer disabled:cursor-not-allowed" disabled>
                            完成並收入圖鑑
                        </button>
                    </div>
                </div>
            </div>

            <!-- 🔍 卡牌放大檢視 Modal 彈跳視窗（z-[60] 確保在抽卡舞台之上） -->
            <div id="card-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4">
                <div class="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 relative shadow-2xl" style="color: #f8fafc;">
                    <button id="modal-close-btn" class="absolute top-4 right-4 w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-400 hover:text-white transition cursor-pointer">✕</button>

                    <div class="flex items-center justify-between">
                        <span id="modal-card-id" class="font-mono text-xs font-bold text-purple-400">--</span>
                        <span id="modal-card-rarity" class="px-2.5 py-0.5 rounded text-xs font-black border">--</span>
                    </div>

                    <div class="w-full aspect-[3/4] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner relative">
                        <img id="modal-card-img" src="" alt="" class="w-full h-full object-cover hidden">
                        <div id="modal-card-placeholder" class="text-5xl text-slate-600 hidden">🔒</div>
                        <span id="modal-card-count" class="absolute top-3 right-3 px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-black shadow hidden">持有 x1</span>
                    </div>

                    <div class="space-y-1 text-center">
                        <h3 id="modal-card-name" class="font-black text-xl text-slate-100">--</h3>
                        <p id="modal-card-category" class="text-xs text-slate-400">--</p>
                    </div>

                    <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed min-h-[60px]" id="modal-card-desc">
                        尚無卡牌說明。
                    </div>
                </div>
            </div>
        `;

        container.querySelector("#card-back-btn").onclick = () => {
            window.location.hash = "lobby";
        };

        if (!firebase.apps.length) {
            firebase.initializeApp({
                databaseURL: "https://chtreadingcompre-default-rtdb.firebaseio.com/"
            });
        }
        const db = firebase.database();

        let allCardsMeta = {};
        let userCards = {};
        let userCoins = 0;
        let activeCategory = "";
        let lastDrawnCards = [];
        let gachaTimers = [];
        let isCollecting = false;

        const coinsDisplay = container.querySelector("#card-user-coins");
        const gridContainer = container.querySelector("#card-grid-container");
        const tabsContainer = container.querySelector("#card-category-tabs");
        const statsTitle = container.querySelector("#card-stats-title");
        const progressDisplay = container.querySelector("#card-collection-progress");
        const drawBtn = container.querySelector("#draw-card-btn");

        const gachaModal = container.querySelector("#gacha-modal");
        const gachaTitle = container.querySelector("#gacha-stage-title");
        const gachaHint = container.querySelector("#gacha-stage-hint");
        const gachaBagStage = container.querySelector("#gacha-bag-stage");
        const gachaCardsStage = container.querySelector("#gacha-cards-stage");
        const gachaFlipCounter = container.querySelector("#gacha-flip-counter");
        const gachaFinishBtn = container.querySelector("#gacha-finish-btn");

        const modal = container.querySelector("#card-modal");
        const closeModalBtn = container.querySelector("#modal-close-btn");
        const modalId = container.querySelector("#modal-card-id");
        const modalRarity = container.querySelector("#modal-card-rarity");
        const modalImg = container.querySelector("#modal-card-img");
        const modalPlaceholder = container.querySelector("#modal-card-placeholder");
        const modalCount = container.querySelector("#modal-card-count");
        const modalName = container.querySelector("#modal-card-name");
        const modalCategory = container.querySelector("#modal-card-category");
        const modalDesc = container.querySelector("#modal-card-desc");

        closeModalBtn.onclick = () => modal.classList.add("hidden");
        modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };

        function clearGachaTimers() {
            gachaTimers.forEach(t => clearTimeout(t));
            gachaTimers = [];
        }

        function getRarityStyle(rarity) {
            return {
                'N': 'bg-slate-800 text-slate-300 border-slate-600',
                'R': 'bg-blue-950 text-blue-300 border-blue-600',
                'SR': 'bg-purple-950 text-purple-300 border-purple-600',
                'SSR': 'bg-amber-950 text-amber-300 border-amber-500'
            }[rarity] || 'bg-slate-800 text-slate-300 border-slate-600';
        }

        function openCardZoomModal(card, count = 1) {
            const isOwned = count > 0;
            modalId.textContent = card.id;
            modalRarity.textContent = `★ 稀有度：${card.rarity}`;
            modalRarity.className = `px-2.5 py-0.5 rounded text-xs font-black border ` + getRarityStyle(card.rarity);

            if (isOwned && card.imageUrl) {
                modalImg.src = getFastImageSrc(card.imageUrl);
                modalImg.classList.remove("hidden");
                modalPlaceholder.classList.add("hidden");
            } else {
                modalImg.classList.add("hidden");
                modalPlaceholder.classList.remove("hidden");
            }

            if (isOwned && count > 1) {
                modalCount.textContent = `持有 x${count}`;
                modalCount.classList.remove("hidden");
            } else {
                modalCount.classList.add("hidden");
            }

            modalName.textContent = card.name;
            modalCategory.textContent = `所屬系列：${card.category || "未分類"}`;
            modalDesc.textContent = card.description
                ? card.description
                : (isOwned ? "這張卡牌背後沒有詳細的文字描述。" : "🔒 此卡牌尚未解鎖，請透過抽卡包來收集！");

            modal.classList.remove("hidden");
        }

        function getCategoriesList() {
            const categories = [];
            const seen = new Set();
            Object.values(allCardsMeta).forEach(card => {
                const cat = (card.category || "未分類").trim();
                if (!seen.has(cat)) {
                    seen.add(cat);
                    categories.push(cat);
                }
            });
            return categories;
        }

        async function loadData() {
            // 第一段：先從 localStorage 與瀏覽器 Cache Storage 秒開已抽到卡牌（不需等待 Firebase）
            const cachedCatalog = readLocalCatalogCache();
            const cachedOwnedMeta = readLocalOwnedCardsMeta(currentLicenseKey);
            const storeProfileNow = store ? store.getState().profile : null;

            if (cachedCatalog && Object.keys(cachedCatalog).length > 0) {
                allCardsMeta = {};
                Object.keys(cachedCatalog).forEach((id) => {
                    allCardsMeta[id] = cachedOwnedMeta[id]
                        ? { ...cachedCatalog[id], ...cachedOwnedMeta[id] }
                        : { ...cachedCatalog[id] };
                });
                userCards = { ...(storeProfileNow?.cards || {}) };
                if (typeof storeProfileNow?.points === "number") {
                    userCoins = Number(storeProfileNow.points);
                    coinsDisplay.textContent = userCoins;
                }

                const ownedUrls = Object.keys(userCards)
                    .filter((id) => Number(userCards[id] || 0) > 0 && allCardsMeta[id]?.imageUrl)
                    .map((id) => allCardsMeta[id].imageUrl);
                await hydrateCachedImages([CARD_BACK_URL, ...ownedUrls]);

                const cachedCats = getCategoriesList();
                if (!activeCategory) {
                    activeCategory = cachedCats.length > 0 ? cachedCats[0] : "all";
                }
                renderCategoryTabs(cachedCats);
                renderCardGrid();
            }

            // 第二段：背景向 Firebase 同步最新圖鑑與持有狀態，並將已抽到的卡牌快取到本地
            try {
                const [metaSnap, userSnap] = await Promise.all([
                    db.ref("cards_meta").once("value"),
                    db.ref(`licenses/${currentLicenseKey}`).once("value")
                ]);

                allCardsMeta = metaSnap.val() || {};
                const userData = userSnap.val() || {};
                const storeProfile = store ? store.getState().profile : null;

                userCards = {
                    ...(userData.cards || {}),
                    ...(storeProfile?.cards || {})
                };

                if (typeof storeProfile?.points === "number") {
                    userCoins = Number(storeProfile.points);
                } else if (userData.coins !== undefined && userData.coins !== null) {
                    userCoins = Number(userData.coins);
                } else {
                    userCoins = 150;
                }

                coinsDisplay.textContent = userCoins;
                saveLocalCardCaches(currentLicenseKey, allCardsMeta, userCards);

                const ownedUrls = Object.keys(userCards)
                    .filter((id) => Number(userCards[id] || 0) > 0 && allCardsMeta[id]?.imageUrl)
                    .map((id) => allCardsMeta[id].imageUrl);
                await hydrateCachedImages([CARD_BACK_URL, ...ownedUrls]);

                const categories = getCategoriesList();
                if (!activeCategory) {
                    activeCategory = categories.length > 0 ? categories[0] : "all";
                }

                renderCategoryTabs(categories);
                renderCardGrid();

                // 背景快取所有已擁有卡牌圖檔與卡背，下次開頁直接本機讀取
                cacheOwnedCardImages([CARD_BACK_URL, ...ownedUrls]);
            } catch (err) {
                console.error(err);
                if (Object.keys(allCardsMeta).length === 0) {
                    gridContainer.innerHTML = `<p class="text-rose-400 text-center col-span-full py-8 font-bold">❌ 載入失敗：${err.message}</p>`;
                }
            }
        }

        function renderCategoryTabs(categories = getCategoriesList()) {
            let tabsHtml = "";

            categories.forEach(cat => {
                const isActive = activeCategory === cat;
                tabsHtml += `<button class="px-4 py-2 rounded-xl font-bold text-xs ${isActive ? 'bg-purple-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} transition cursor-pointer category-tab" data-cat="${cat}">${cat}</button>`;
            });

            const isAllActive = activeCategory === "all";
            tabsHtml += `<button class="ml-auto px-4 py-2 rounded-xl font-bold text-xs border ${isAllActive ? 'bg-amber-500 text-slate-950 border-amber-400 shadow' : 'bg-slate-800/80 text-amber-300 border-amber-500/30 hover:bg-slate-700'} transition cursor-pointer category-tab" data-cat="all">全部系列</button>`;

            tabsContainer.innerHTML = tabsHtml;

            tabsContainer.querySelectorAll(".category-tab").forEach(btn => {
                btn.onclick = (e) => {
                    activeCategory = e.currentTarget.getAttribute("data-cat");
                    renderCategoryTabs(categories);
                    renderCardGrid();
                };
            });
        }

        function renderCardGrid() {
            const cardIds = Object.keys(allCardsMeta);
            if (cardIds.length === 0) {
                gridContainer.innerHTML = `<p class="text-slate-400 text-center col-span-full py-8">⚠️ 目前尚無卡牌資料，請先至表單執行同步！</p>`;
                return;
            }

            const filteredIds = cardIds.filter(id => {
                const card = allCardsMeta[id];
                const cardCat = (card.category || "未分類").trim();
                return activeCategory === "all" || cardCat === activeCategory;
            });

            const totalCards = filteredIds.length;
            let collectedCount = 0;

            const buildCardHtml = (id) => {
                const card = allCardsMeta[id];
                const cardCat = (card.category || "未分類").trim();
                const count = userCards[id] || 0;
                const isOwned = count > 0;
                if (isOwned) collectedCount++;

                const rarityColor = getRarityStyle(card.rarity);

                return `
                    <div class="card-item p-3.5 rounded-2xl border-2 ${isOwned ? 'border-purple-500/60 bg-slate-900 shadow-md shadow-purple-500/5' : 'border-slate-800 bg-slate-900/40 opacity-60'} flex flex-col justify-between transition hover:scale-[1.03] cursor-pointer" data-id="${card.id}">
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-mono text-xs font-bold text-slate-400">${card.id}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-black border ${rarityColor}">${card.rarity}</span>
                            </div>
                            <div class="w-full aspect-[3/4] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 mb-3 relative shadow-inner">
                                ${isOwned && card.imageUrl ?
                                    `<img src="${getFastImageSrc(card.imageUrl)}" alt="${card.name}" loading="lazy" class="w-full h-full object-cover">` :
                                    `<div class="text-3xl text-slate-600">${isOwned ? '🎴' : '🔒'}</div>`
                                }
                                ${isOwned && count > 1 ? `<span class="absolute top-1 right-1 px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-black shadow">x${count}</span>` : ''}
                            </div>
                            <h4 class="font-black text-sm text-slate-100 truncate">${card.name}</h4>
                            <p class="text-[11px] text-slate-400 mt-0.5">${cardCat}</p>
                        </div>
                        <div class="mt-3 pt-2 border-t border-slate-800 text-center">
                            ${isOwned ?
                                `<span class="text-xs font-bold text-emerald-400">✓ 已擁有 (${count})</span>` :
                                `<span class="text-xs font-medium text-slate-500">🔒 未解鎖</span>`
                            }
                        </div>
                    </div>
                `;
            };

            let gridHtml = "";
            if (filteredIds.length % 4 !== 0) {
                // 除 4 有餘數時，將最後一張（隱藏版主卡）單獨置中放在第一列
                const featuredId = filteredIds[filteredIds.length - 1];
                const bodyIds = filteredIds.slice(0, -1);

                gridHtml += `
                    <div class="col-span-full flex justify-center">
                        <div class="w-[calc((100%-1rem)/2)] md:w-[calc((100%-3rem)/4)]">
                            ${buildCardHtml(featuredId)}
                        </div>
                    </div>
                `;
                gridHtml += bodyIds.map(buildCardHtml).join("");
            } else {
                gridHtml = filteredIds.map(buildCardHtml).join("");
            }

            statsTitle.textContent = activeCategory === 'all' ? '✨ 全部卡牌圖鑑' : `✨ ${activeCategory} 系列圖鑑`;
            progressDisplay.textContent = `已蒐集：${collectedCount} / ${totalCards}`;
            gridContainer.innerHTML = gridHtml;

            gridContainer.querySelectorAll(".card-item").forEach(item => {
                item.onclick = () => {
                    const cardId = item.getAttribute("data-id");
                    const card = allCardsMeta[cardId];
                    const count = userCards[cardId] || 0;
                    openCardZoomModal(card, count);
                };
            });
        }

        function playGachaSequence(drawnCards) {
            clearGachaTimers();
            isCollecting = false;
            gachaModal.classList.remove("hidden");
            gachaBagStage.classList.remove("hidden");
            gachaCardsStage.classList.add("hidden");
            gachaCardsStage.innerHTML = "";
            gachaFinishBtn.disabled = true;
            gachaFinishBtn.textContent = "完成並收入圖鑑";

            gachaTitle.textContent = "🎒 卡包現身！";
            gachaHint.textContent = "袋子正在聚集光芒，三張卡牌即將抽出...";
            gachaFlipCounter.textContent = "尚未翻開：0 / 3";

            let flippedCount = 0;

            const t1 = setTimeout(() => {
                gachaBagStage.classList.add("hidden");
                gachaCardsStage.classList.remove("hidden");
                gachaTitle.textContent = "🃏 三張卡牌已抽出！";
                gachaHint.textContent = "請依序點擊卡背翻開；翻開後再點一下可放大檢視。";

                gachaCardsStage.innerHTML = drawnCards.map((card, idx) => {
                    const catLabel = (card.category || "未分類").trim();
                    return `
                        <div class="gacha-card-slot opacity-0 flex flex-col items-center space-y-2" data-index="${idx}" data-cat="${catLabel}">
                            <div class="flip-scene w-full aspect-[3/4] cursor-pointer">
                                <div class="flip-inner" data-card-index="${idx}">
                                    <div class="flip-face rounded-2xl border-2 border-purple-400/70 bg-slate-950 overflow-hidden shadow-xl hover:border-amber-300 transition relative">
                                        <img src="${getFastImageSrc(CARD_BACK_URL)}" alt="卡背" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                        <div class="hidden w-full h-full bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-950 flex-col items-center justify-center p-4">
                                            <div class="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-3xl mb-2">✨</div>
                                            <span class="text-xs font-black tracking-widest text-purple-200">CARD #${idx + 1}</span>
                                        </div>
                                        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent py-2.5 text-center pointer-events-none">
                                            <span class="text-[11px] text-amber-300 font-bold tracking-wider">點擊翻開</span>
                                        </div>
                                    </div>
                                    <div class="flip-face flip-front rounded-2xl border-2 border-purple-400 bg-slate-950 overflow-hidden flex flex-col justify-between shadow-2xl">
                                        <div class="w-full h-full relative bg-slate-950 flex items-center justify-center">
                                            ${card.imageUrl ?
                                                `<img src="${getFastImageSrc(card.imageUrl)}" alt="${card.name}" class="w-full h-full object-cover">` :
                                                `<div class="text-4xl">🎴</div>`
                                            }
                                            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-3 pt-8 text-left">
                                                <div class="flex items-center justify-between gap-1 mb-1">
                                                    <span class="font-mono text-[10px] text-slate-400">${card.id}</span>
                                                    <span class="px-1.5 py-0.5 rounded text-[10px] font-black border ${getRarityStyle(card.rarity)}">${card.rarity}</span>
                                                </div>
                                                <div class="font-black text-sm text-white truncate">${card.name}</div>
                                                <div class="text-[10px] text-amber-300 font-bold">歸入：${catLabel}（再點放大）</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <span class="gacha-sort-badge opacity-0 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold transition">
                                📥 已收入「${catLabel}」
                            </span>
                        </div>
                    `;
                }).join("");

                gachaCardsStage.querySelectorAll(".gacha-card-slot").forEach((slot, idx) => {
                    const tCard = setTimeout(() => {
                        slot.classList.remove("opacity-0");
                        slot.classList.add("gacha-card-enter");
                    }, idx * 220);
                    gachaTimers.push(tCard);
                });

                gachaCardsStage.querySelectorAll(".flip-scene").forEach((scene, idx) => {
                    const card = drawnCards[idx];
                    scene.onclick = () => {
                        if (isCollecting) return;
                        const inner = scene.querySelector(".flip-inner");
                        if (!inner || !card) return;

                        if (!inner.classList.contains("is-flipped")) {
                            inner.classList.add("is-flipped");
                            flippedCount++;
                            gachaFlipCounter.textContent = `已翻開：${flippedCount} / 3（已翻開可再點放大）`;

                            if (flippedCount === drawnCards.length) {
                                gachaTitle.textContent = "🎉 三張卡牌全數揭曉！";
                                gachaHint.textContent = "可再點擊已翻開的卡片放大檢視，或按下方按鈕收入圖鑑。";
                                gachaFinishBtn.disabled = false;
                            }
                            return;
                        }

                        openCardZoomModal(card, userCards[card.id] || 1);
                    };
                });
            }, 1100);

            gachaTimers.push(t1);
        }

        gachaFinishBtn.onclick = () => {
            if (isCollecting || gachaFinishBtn.disabled) return;
            isCollecting = true;
            gachaFinishBtn.disabled = true;
            gachaFinishBtn.textContent = "正在收入圖鑑...";
            gachaTitle.textContent = "📥 正在分類收入圖鑑...";

            const slots = Array.from(gachaCardsStage.querySelectorAll(".gacha-card-slot"));
            const summaryCats = slots.map(s => s.getAttribute("data-cat")).filter(Boolean);
            gachaHint.textContent = `分別歸入：${summaryCats.join("、")}`;

            slots.forEach((slot, idx) => {
                const tFly = setTimeout(() => {
                    const badge = slot.querySelector(".gacha-sort-badge");
                    if (badge) badge.classList.remove("opacity-0");
                    slot.classList.remove("gacha-card-enter");
                    slot.classList.add("gacha-card-collect");
                }, idx * 220);
                gachaTimers.push(tFly);
            });

            const tDone = setTimeout(() => {
                const firstCat = lastDrawnCards[0]?.category?.trim();
                if (activeCategory !== "all" && firstCat) {
                    activeCategory = firstCat;
                }
                renderCategoryTabs();
                renderCardGrid();

                gachaModal.classList.add("hidden");
                isCollecting = false;
            }, 1150);

            gachaTimers.push(tDone);
        };

        drawBtn.onclick = async () => {
            const cost = 30;
            if (userCoins < cost) {
                alert(`❌ 點數不足！目前僅剩 ${userCoins} 點，抽卡包需要 ${cost} 點。`);
                return;
            }

            const cardKeys = Object.keys(allCardsMeta);
            if (cardKeys.length === 0) {
                alert("⚠️ 目前尚無可抽的卡牌資料！");
                return;
            }

            const drawnCards = [];
            const drawnIds = [];
            for (let i = 0; i < 3; i++) {
                const randIndex = Math.floor(Math.random() * cardKeys.length);
                const drawnId = cardKeys[randIndex];
                drawnCards.push(allCardsMeta[drawnId]);
                drawnIds.push(drawnId);
                userCards[drawnId] = (userCards[drawnId] || 0) + 1;
            }

            lastDrawnCards = drawnCards;
            userCoins -= cost;

            try {
                if (currentLicenseKey && currentLicenseKey !== "GUEST" && currentLicenseKey !== "50TEST") {
                    await db.ref(`licenses/${currentLicenseKey}`).update({
                        coins: userCoins,
                        cards: userCards
                    });
                }

                if (store) {
                    await store.updateProfile((profile) => {
                        profile.points = userCoins;
                        profile.cards = { ...(profile.cards || {}) };
                        drawnIds.forEach((id) => {
                            profile.cards[id] = (profile.cards[id] || 0) + 1;
                        });
                    });
                }

                coinsDisplay.textContent = userCoins;

                // 抽到卡牌後立即寫入本地快取（localStorage + 瀏覽器圖片快取），下次開頁秒開
                saveLocalCardCaches(currentLicenseKey, allCardsMeta, userCards);
                const drawnUrls = drawnCards.map((c) => c?.imageUrl).filter(Boolean);
                cacheOwnedCardImages([CARD_BACK_URL, ...drawnUrls]);

                playGachaSequence(drawnCards);
            } catch (err) {
                console.error(err);
                alert("❌ 抽卡儲存失敗：" + err.message);
            }
        };

        let unsubscribeStore = null;
        if (store) {
            unsubscribeStore = store.subscribe(async (eventName, { userId, profile }) => {
                if (eventName === "init") return;

                if (userId && userId !== currentLicenseKey) {
                    currentLicenseKey = userId;
                    await loadData();
                    return;
                }

                if (profile) {
                    userCards = { ...userCards, ...(profile.cards || {}) };
                    if (typeof profile.points === "number") {
                        userCoins = Number(profile.points);
                        coinsDisplay.textContent = userCoins;
                    }
                    renderCardGrid();
                }
            });
        }

        await loadData();

        this._cleanup = () => {
            clearGachaTimers();
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
        console.log("Card module destroyed.");
    }
};