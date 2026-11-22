import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

export default {
    id: "shop",

    init: async function(container) {
        const store = window.UserStore;
        let currentLicenseKey = store
            ? store.getState().userId
            : (localStorage.getItem("boshen_license_key") || "TEST01");

        if (!firebase.apps.length) {
            firebase.initializeApp({
                databaseURL: "https://chtreadingcompre-default-rtdb.firebaseio.com/"
            });
        }
        const db = firebase.database();

        const getShopItems = () => {
            const tier1Price = store ? store.getRule("skin_tier1_cost", 50) : 50;
            const tier2Price = store ? store.getRule("skin_tier2_cost", 80) : 80;
            return [
                {
                    id: "theme_midnight_gold",
                    name: "🌙 極夜黑金主題",
                    price: Number(tier1Price),
                    ruleKey: "skin_tier1_cost",
                    themeClass: "theme-midnight-gold",
                    bgColor: "#090d16",
                    accentColor: "#f59e0b"
                },
                {
                    id: "theme_ocean_blue",
                    name: "🌊 蔚藍海洋主題",
                    price: Number(tier2Price),
                    ruleKey: "skin_tier2_cost",
                    themeClass: "theme-ocean-blue",
                    bgColor: "#082f49",
                    accentColor: "#38bdf8"
                }
            ];
        };

        let userPoints = store ? Number(store.getState().profile.points ?? 150) : 150;
        let ownedSkins = new Set(store?.getState()?.profile?.ownedSkins || []);
        let activeSkin = store?.getState()?.profile?.activeSkin || "";

        container.innerHTML = `
            <div class="space-y-6" style="padding-bottom: 40px;">
                <div class="flex items-center justify-between theme-card p-4 rounded-2xl border border-slate-200 shadow-sm" style="background: #1e293b; border-color: #334155; color: #f8fafc;">
                    <button id="shop-back-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-slate-200">← 返回大廳</button>
                    <h2 class="font-black text-amber-400 text-lg">🛍️ 積點商城與外觀解鎖</h2>
                    <div class="text-sm font-bold text-amber-300">💰 餘額：<span id="shop-user-points">${userPoints}</span> 點</div>
                </div>

                <div id="shop-items-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
            </div>
        `;

        container.querySelector("#shop-back-btn").onclick = () => {
            window.location.hash = "lobby";
        };

        const pointsEl = container.querySelector("#shop-user-points");
        const gridEl = container.querySelector("#shop-items-grid");

        function applyThemeVisual(item) {
            if (!item) return;
            document.body.dataset.activeTheme = item.id;
            document.body.style.backgroundColor = item.bgColor || "#0f172a";
        }

        async function loadShopState() {
            const activeId = store ? store.getState().userId : currentLicenseKey;
            currentLicenseKey = activeId;

            try {
                if (activeId && activeId !== "GUEST") {
                    const snap = await db.ref(`licenses/${activeId}`).once("value");
                    const licVal = snap.val() || {};
                    const storeProfile = store ? store.getState().profile : null;

                    if (typeof storeProfile?.points === "number") {
                        userPoints = Number(storeProfile.points);
                    } else if (licVal.coins !== undefined && licVal.coins !== null) {
                        userPoints = Number(licVal.coins);
                    }

                    const mergedOwned = [
                        ...(Array.isArray(licVal.ownedSkins) ? licVal.ownedSkins : []),
                        ...(Array.isArray(storeProfile?.ownedSkins) ? storeProfile.ownedSkins : [])
                    ];
                    ownedSkins = new Set(mergedOwned);
                    activeSkin = storeProfile?.activeSkin || licVal.activeSkin || "";
                } else if (store) {
                    const p = store.getState().profile;
                    userPoints = Number(p.points ?? 150);
                    ownedSkins = new Set(p.ownedSkins || []);
                    activeSkin = p.activeSkin || "";
                }
            } catch (err) {
                console.error("讀取商城帳號資料失敗:", err);
            }

            renderShopItems();
        }

        function renderShopItems() {
            pointsEl.textContent = userPoints;
            const items = getShopItems();

            gridEl.innerHTML = items.map((item) => {
                const isOwned = ownedSkins.has(item.id);
                const isEquipped = activeSkin === item.id;
                const btnText = isEquipped
                    ? "✓ 使用中"
                    : (isOwned ? "套用造型" : `購買並套用 (${item.price} 點)`);

                return `
                    <div class="theme-card p-5 rounded-2xl border-2 ${isEquipped ? 'border-amber-400' : 'border-slate-700'} flex items-center justify-between shadow-sm bg-slate-900 text-slate-200 gap-3">
                        <div>
                            <h4 class="font-black text-lg text-slate-100">${item.name}</h4>
                            <p class="text-xs text-slate-400 mt-1">價格：<span class="text-amber-300 font-bold">${item.price}</span> 點 ${isOwned ? '<span class="text-emerald-400 ml-2">● 已解鎖</span>' : ''}</p>
                        </div>
                        <button data-shop-id="${item.id}" class="shop-action-btn px-4 py-2 ${isEquipped ? 'bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'} font-bold text-xs rounded-xl shadow cursor-pointer shrink-0">
                            ${btnText}
                        </button>
                    </div>
                `;
            }).join("");

            gridEl.querySelectorAll(".shop-action-btn").forEach((btn) => {
                btn.onclick = async () => {
                    const itemId = btn.getAttribute("data-shop-id");
                    const item = items.find((x) => x.id === itemId);
                    if (!item) return;

                    const alreadyOwned = ownedSkins.has(item.id);
                    if (!alreadyOwned) {
                        if (userPoints < item.price) {
                            alert(`❌ 點數不足！目前餘額 ${userPoints} 點，需要 ${item.price} 點。`);
                            return;
                        }
                        userPoints -= item.price;
                        ownedSkins.add(item.id);
                    }

                    activeSkin = item.id;
                    applyThemeVisual(item);

                    try {
                        if (store) {
                            await store.updateProfile((profile) => {
                                profile.points = userPoints;
                                profile.ownedSkins = Array.from(ownedSkins);
                                profile.activeSkin = activeSkin;
                            });
                        }

                        const activeId = store ? store.getState().userId : currentLicenseKey;
                        if (activeId && activeId !== "GUEST") {
                            await db.ref(`licenses/${activeId}`).update({
                                coins: userPoints,
                                ownedSkins: Array.from(ownedSkins),
                                activeSkin: activeSkin
                            });
                        }

                        renderShopItems();
                        alert(alreadyOwned ? `✅ 已套用「${item.name}」！` : `🎉 購買成功並套用「${item.name}」（剩餘 ${userPoints} 點）！`);
                    } catch (err) {
                        console.error("商城更新失敗:", err);
                        alert("❌ 儲存失敗：" + err.message);
                    }
                };
            });
        }

        let unsubscribeStore = null;
        if (store) {
            unsubscribeStore = store.subscribe(async (eventName, { userId, profile }) => {
                if (eventName === "init") return;

                if (userId && userId !== currentLicenseKey) {
                    currentLicenseKey = userId;
                    await loadShopState();
                    return;
                }

                if (eventName === "rules:updated") {
                    renderShopItems();
                    return;
                }

                if (profile) {
                    if (typeof profile.points === "number") {
                        userPoints = Number(profile.points);
                    }
                    ownedSkins = new Set(profile.ownedSkins || []);
                    activeSkin = profile.activeSkin || "";
                    renderShopItems();
                }
            });
        }

        await loadShopState();

        this._cleanup = () => {
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
        console.log("Shop module destroyed.");
    }
};