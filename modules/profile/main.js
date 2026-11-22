// modules/profile/main.js
// 個人學習檔案主入口：雙向對齊 UserStore 與 licenses 節點，確保頂部標題列與檔案進度一致

import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

import { renderAvatarSection, bindAvatarSection } from "./avatar.js";
import { renderThemePickerSection, bindThemePickerSection } from "./themePicker.js";
import { renderCheckinSection, bindCheckinSection } from "./checkin.js";
import { renderProgressSection, bindProgressSection } from "./progress.js";
import { renderWordMasterySection, bindWordMasterySection } from "./wordMasteryPanel.js";
import { renderCardsSummarySection, bindCardsSummarySection } from "./cardsSummary.js";
import { renderLegalFeedbackSection, bindLegalFeedbackSection } from "./legalFeedback.js";
import {
    loadWordMasteryState,
    getCachedMastery,
    getCachedThreshold
} from "../../assets/js/wordMastery.js";

const DB_URL = "https://chtreadingcompre-default-rtdb.firebaseio.com/";

export default {
    id: "profile",

    init: async function(container) {
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: DB_URL });
        }
        const db = firebase.database();
        const store = window.UserStore;

        let currentLicenseKey = String(
            localStorage.getItem("boshen_license_key") ||
            (store && store.getState().userId && store.getState().userId !== "GUEST"
                ? store.getState().userId
                : "50TEST")
        ).trim().toUpperCase();

        let state = {
            licenseKey: currentLicenseKey,
            userData: {},
            totalMetaCards: 0,
            avatars: [],
            wordMastery: getCachedMastery(currentLicenseKey),
            masteryThreshold: getCachedThreshold(currentLicenseKey)
        };

        container.innerHTML = `
            <div class="space-y-5" style="padding-bottom: 70px;">
                <div class="flex items-center justify-between theme-card p-4 rounded-2xl border border-slate-700 shadow-sm" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex items-center space-x-3">
                        <button id="profile-back-btn" data-theme-copy="btn.backLobby" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-slate-200">← 返回大廳</button>
                        <h2 data-theme-copy="profile.title" class="font-black text-sky-400 text-base">👤 個人學習檔案</h2>
                    </div>
                    <button id="profile-refresh-btn" data-theme-copy="profile.refresh" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer">
                        🔄 重新同步
                    </button>
                </div>

                <div id="slot-avatar"></div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <div id="slot-checkin" class="lg:col-span-5"></div>
                    <div id="slot-cards-summary" class="lg:col-span-7 space-y-5"></div>
                </div>

                <div id="slot-progress"></div>
                <div id="slot-word-mastery"></div>
                <div id="slot-theme"></div>
                <div id="slot-legal-feedback"></div>
            </div>
        `;

        function pushTopBarNow() {
            if (store && typeof window.forceSyncHeaderFromStore === "function") {
                window.forceSyncHeaderFromStore();
                return;
            }

            const u = state.userData || {};
            const cardsObj = u.cards || {};
            const uniqueCards = Object.values(cardsObj).filter((n) => Number(n || 0) > 0).length;
            const totalCards = Object.values(cardsObj).reduce((sum, n) => sum + Number(n || 0), 0);
            const points = Number(u.points ?? u.coins ?? 0);
            const pStats = u.practiceStats || {};
            const qStats = u.questionStats || {};
            const prog = u.progress || {};
            const practiceCount = Number(
                pStats.totalCount ??
                u.totalPractice ??
                (
                    (Number(qStats.vocabulary ?? prog.vocab ?? 0)) +
                    (Number(qStats.sentences ?? prog.sentence ?? 0)) +
                    (Number(pStats.cloze ?? qStats.cloze ?? prog.cloze ?? 0)) +
                    (Number(pStats.reading ?? qStats.reading ?? prog.reading ?? 0))
                )
            ) || 0;

            if (typeof window.__setTopBarStatus === "function") {
                window.__setTopBarStatus({
                    id: currentLicenseKey,
                    points,
                    uniqueCards,
                    totalCards,
                    practiceCount
                });
            }
        }

        function refreshAllSubmodules() {
            renderAvatarSection(container.querySelector("#slot-avatar"), state);
            renderThemePickerSection(container.querySelector("#slot-theme"), state);
            renderCheckinSection(container.querySelector("#slot-checkin"), state);
            renderCardsSummarySection(container.querySelector("#slot-cards-summary"), state);
            renderProgressSection(container.querySelector("#slot-progress"), state);
            renderWordMasterySection(container.querySelector("#slot-word-mastery"), state);
            renderLegalFeedbackSection(container.querySelector("#slot-legal-feedback"), state);
            bindAllSubmodules();
            pushTopBarNow();
        }

        function mergeStoreIntoUserData(storeProfile) {
            if (!storeProfile) return;
            const prevUserData = state.userData || {};
            const storeCardsCount = Object.values(storeProfile.cards || {}).reduce((sum, n) => sum + Number(n || 0), 0);

            state.userData = {
                ...prevUserData,
                points: storeProfile.points ?? prevUserData.points ?? 0,
                coins: storeProfile.points ?? prevUserData.coins ?? 0,
                cards: storeProfile.cards ?? prevUserData.cards ?? {},
                cardsCount: storeCardsCount || prevUserData.cardsCount || 0,
                practiceStats: storeProfile.practiceStats ?? prevUserData.practiceStats ?? {},
                questionStats: storeProfile.questionStats ?? prevUserData.questionStats ?? {},
                totalPractice: storeProfile.practiceStats?.totalCount ?? prevUserData.totalPractice ?? 0
            };
        }

        const ctx = {
            db,
            getState: () => state,
            updateUserData: async (partial) => {
                const normalizedPartial = { ...partial };
                if (typeof normalizedPartial.points === "number" && normalizedPartial.coins === undefined) {
                    normalizedPartial.coins = normalizedPartial.points;
                } else if (typeof normalizedPartial.coins === "number" && normalizedPartial.points === undefined) {
                    normalizedPartial.points = normalizedPartial.coins;
                }

                state.userData = { ...state.userData, ...normalizedPartial };

                if (store) {
                    await store.updateProfile((profile) => {
                        if (typeof normalizedPartial.points === "number") {
                            profile.points = normalizedPartial.points;
                        }
                        if (normalizedPartial.cards && typeof normalizedPartial.cards === "object") {
                            profile.cards = normalizedPartial.cards;
                        }
                        if (normalizedPartial.practiceStats && typeof normalizedPartial.practiceStats === "object") {
                            profile.practiceStats = normalizedPartial.practiceStats;
                        }
                        if (normalizedPartial.questionStats && typeof normalizedPartial.questionStats === "object") {
                            profile.questionStats = normalizedPartial.questionStats;
                        }
                    });
                    mergeStoreIntoUserData(store.getState().profile);
                }

                refreshAllSubmodules();
            },
            switchLicenseKey: async (newKey) => {
                const cleanKey = String(newKey || "").trim().toUpperCase().replace(/[.#$\[\]\/]/g, "_");
                if (!cleanKey) return;

                currentLicenseKey = cleanKey;
                state.licenseKey = cleanKey;
                localStorage.setItem("boshen_license_key", cleanKey);

                await loadAllData();
            }
        };

        function bindAllSubmodules() {
            bindAvatarSection(container.querySelector("#slot-avatar"), ctx);
            bindThemePickerSection(container.querySelector("#slot-theme"), ctx);
            bindCheckinSection(container.querySelector("#slot-checkin"), ctx);
            bindCardsSummarySection(container.querySelector("#slot-cards-summary"), ctx);
            bindProgressSection(container.querySelector("#slot-progress"), ctx);
            bindWordMasterySection(container.querySelector("#slot-word-mastery"), ctx);
            bindLegalFeedbackSection(container.querySelector("#slot-legal-feedback"), ctx);
        }

        async function loadAllData() {
            try {
                // 先確保 UserStore 已與 Firebase 完成同步，以 UserStore 作為點數單一真相來源
                if (store) {
                    await store.switchUser(currentLicenseKey);
                }

                const [userSnap, metaSnap, avatarsSnap, masteryState] = await Promise.all([
                    db.ref(`licenses/${currentLicenseKey}`).once("value"),
                    db.ref("cards_meta").once("value"),
                    db.ref("avatars").once("value"),
                    loadWordMasteryState(currentLicenseKey, db)
                ]);

                state.userData = userSnap.val() || {};
                state.totalMetaCards = Object.keys(metaSnap.val() || {}).length;
                state.wordMastery = masteryState.masteryMap || {};
                state.masteryThreshold = masteryState.threshold;

                if (avatarsSnap.exists()) {
                    state.avatars = Object.values(avatarsSnap.val())
                        .filter(item => item && item.imageUrl)
                        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
                } else {
                    state.avatars = [];
                }

                if (store) {
                    const curStoreProfile = store.getState().profile || {};
                    const finalPoints = Number(curStoreProfile.points ?? 0);
                    const fetchedCards = state.userData.cards || {};
                    const mergedCards = {
                        ...fetchedCards,
                        ...(curStoreProfile.cards || {})
                    };
                    const fetchedName = state.userData.buyer || state.userData.name || curStoreProfile.name || currentLicenseKey;

                    const cardsChanged = JSON.stringify(curStoreProfile.cards || {}) !== JSON.stringify(mergedCards);
                    const nameChanged = curStoreProfile.name !== fetchedName;
                    const pStats = curStoreProfile.practiceStats || {};
                    const qStats = curStoreProfile.questionStats || {};
                    const finalPracticeCount = Number(pStats.totalCount || 0);
                    const licPracticeCount = Number(
                        state.userData.practiceStats?.totalCount ?? state.userData.totalPractice ?? 0
                    );

                    if (cardsChanged || nameChanged) {
                        await store.updateProfile((profile) => {
                            profile.name = fetchedName;
                            profile.cards = mergedCards;
                        });
                    } else if (
                        currentLicenseKey &&
                        currentLicenseKey !== "GUEST" &&
                        currentLicenseKey !== "50TEST" &&
                        (Number(state.userData.coins) !== finalPoints || licPracticeCount !== finalPracticeCount)
                    ) {
                        await db.ref(`licenses/${currentLicenseKey}`).update({
                            coins: finalPoints,
                            cards: mergedCards,
                            practiceStats: pStats,
                            questionStats: qStats,
                            totalPractice: finalPracticeCount,
                            progress: {
                                vocab: Number(qStats.vocabulary || 0),
                                sentence: Number(qStats.sentences || 0),
                                cloze: Number(pStats.cloze || 0),
                                reading: Number(pStats.reading || 0)
                            }
                        });
                    }

                    mergeStoreIntoUserData(store.getState().profile);
                }

                refreshAllSubmodules();
            } catch (err) {
                console.error(err);
                alert("❌ 讀取個人資料失敗：" + err.message);
            }
        }

        let unsubscribeStore = null;
        if (store) {
            unsubscribeStore = store.subscribe(async (eventName, { userId, profile }) => {
                if (eventName === "init") return;

                if (userId && userId !== currentLicenseKey) {
                    currentLicenseKey = userId;
                    state.licenseKey = userId;
                    localStorage.setItem("boshen_license_key", userId);
                    await loadAllData();
                    return;
                }

                mergeStoreIntoUserData(profile);
                refreshAllSubmodules();
                pushTopBarNow();
            });
        }

        container.querySelector("#profile-back-btn").onclick = () => {
            window.location.hash = "lobby";
        };

        container.querySelector("#profile-refresh-btn").onclick = () => {
            loadAllData();
        };

        if (store) {
            mergeStoreIntoUserData(store.getState().profile);
        }
        refreshAllSubmodules();
        await loadAllData();

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
        console.log("Profile main module destroyed.");
    }
};