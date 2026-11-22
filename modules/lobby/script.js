import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
import {
    POOL_RECOGNITION,
    POOL_SPELLING,
    getCachedWrongBook,
    loadWrongBook
} from "../../assets/js/wrongBook.js";

const DB_URL = "https://chtreadingcompre-default-rtdb.firebaseio.com/";

export default {
    id: "lobby",

    init: async function(container) {
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: DB_URL });
        }
        const db = firebase.database();
        const store = window.UserStore;
        let isDestroyed = false;

        container.innerHTML = `
            <div style="max-width: 900px; margin: 0 auto; padding: 10px; padding-bottom: 40px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 data-theme-copy="lobby.title" style="color: #38bdf8; font-size: 1.8rem; margin-bottom: 10px;">學習大廳</h1>
                    <p data-theme-copy="lobby.subtitle" style="color: #94a3b8; font-size: 1rem;">請選擇您要挑戰的學習單元：</p>
                </div>

                <!-- 四大測驗核心區（右上角顯示各單元完成題數／篇數與待複習錯題數） -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">

                    <div class="lobby-card" data-target="vocabulary" style="background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 12px; cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
                        <div class="flex items-center justify-between gap-2 mb-2.5">
                            <span style="font-size: 2rem; line-height: 1;">🎯</span>
                            <div class="flex items-center gap-1.5">
                                <span id="lobby-wrong-vocab" class="hidden px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">錯題 0</span>
                                <span id="lobby-unit-vocab" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-950/75 text-sky-300 border border-slate-700 font-mono">0 題</span>
                            </div>
                        </div>
                        <h3 data-theme-copy="unit.vocab.title" style="color: #f8fafc; margin-bottom: 8px; font-size: 1.2rem;">1. 核心單字選擇題</h3>
                        <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">經典四選一測驗，快速累積字彙量。</p>
                    </div>

                    <div class="lobby-card" data-target="sentences" style="background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 12px; cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
                        <div class="flex items-center justify-between gap-2 mb-2.5">
                            <span style="font-size: 2rem; line-height: 1;">💬</span>
                            <div class="flex items-center gap-1.5">
                                <span id="lobby-wrong-sentences" class="hidden px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">錯題 0</span>
                                <span id="lobby-unit-sentences" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-950/75 text-indigo-300 border border-slate-700 font-mono">0 題</span>
                            </div>
                        </div>
                        <h3 data-theme-copy="unit.sentences.title" style="color: #f8fafc; margin-bottom: 8px; font-size: 1.2rem;">2. 生活情境句子選擇題</h3>
                        <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">透過真實對話情境提升應對能力。</p>
                    </div>

                    <div class="lobby-card" data-target="cloze" style="background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 12px; cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
                        <div class="flex items-center justify-between gap-2 mb-2.5">
                            <span style="font-size: 2rem; line-height: 1;">✍️</span>
                            <div class="flex items-center gap-1.5">
                                <span id="lobby-wrong-cloze" class="hidden px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">拼錯 0</span>
                                <span id="lobby-unit-cloze" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-950/75 text-amber-300 border border-slate-700 font-mono">0 篇</span>
                            </div>
                        </div>
                        <h3 data-theme-copy="unit.cloze.title" style="color: #f8fafc; margin-bottom: 8px; font-size: 1.2rem;">3. 智慧克漏字填空</h3>
                        <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">單字專屬例句拼寫，強化拼字與文法。</p>
                    </div>

                    <div class="lobby-card" data-target="reading" style="background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 12px; cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
                        <div class="flex items-center justify-between gap-2 mb-2.5">
                            <span style="font-size: 2rem; line-height: 1;">📖</span>
                            <span id="lobby-unit-reading" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-950/75 text-rose-300 border border-slate-700 font-mono">0 篇</span>
                        </div>
                        <h3 data-theme-copy="unit.reading.title" style="color: #f8fafc; margin-bottom: 8px; font-size: 1.2rem;">4. 閱讀測驗專區</h3>
                        <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">多層級閱讀短文與精準題組，提升長文理解力。</p>
                    </div>

                </div>
            </div>
        `;

        function syncUnitBadges(profile) {
            const p = profile || store?.getState?.()?.profile || {};
            const pStats = p.practiceStats || {};
            const qStats = p.questionStats || {};

            const vocabEl = container.querySelector("#lobby-unit-vocab");
            const senEl = container.querySelector("#lobby-unit-sentences");
            const clozeEl = container.querySelector("#lobby-unit-cloze");
            const readingEl = container.querySelector("#lobby-unit-reading");

            if (vocabEl) vocabEl.textContent = `${Number(qStats.vocabulary || 0)} 題`;
            if (senEl) senEl.textContent = `${Number(qStats.sentences || 0)} 題`;
            if (clozeEl) clozeEl.textContent = `${Number(pStats.cloze || 0)} 篇`;
            if (readingEl) readingEl.textContent = `${Number(pStats.reading || 0)} 篇`;
        }

        function syncWrongBadges(book) {
            if (isDestroyed || !book) return;
            const recCnt = Object.keys(book[POOL_RECOGNITION] || {}).length;
            const spellCnt = Object.keys(book[POOL_SPELLING] || {}).length;

            const vocabW = container.querySelector("#lobby-wrong-vocab");
            const senW = container.querySelector("#lobby-wrong-sentences");
            const clozeW = container.querySelector("#lobby-wrong-cloze");

            if (vocabW) {
                vocabW.textContent = `錯題 ${recCnt}`;
                vocabW.classList.toggle("hidden", recCnt === 0);
            }
            if (senW) {
                senW.textContent = `錯題 ${recCnt}`;
                senW.classList.toggle("hidden", recCnt === 0);
            }
            if (clozeW) {
                clozeW.textContent = `拼錯 ${spellCnt}`;
                clozeW.classList.toggle("hidden", spellCnt === 0);
            }
        }

        const currentUid = store?.getState?.()?.userId || localStorage.getItem("boshen_active_user_id") || "50TEST";
        syncWrongBadges(getCachedWrongBook(currentUid));
        loadWrongBook(currentUid, db).then((book) => syncWrongBadges(book)).catch(() => {});

        let unsubscribeStore = null;
        if (store && typeof store.subscribe === "function") {
            unsubscribeStore = store.subscribe((_evt, snapshot) => {
                syncUnitBadges(snapshot?.profile);
            });
        } else {
            syncUnitBadges();
        }

        container.querySelectorAll(".lobby-card").forEach(card => {
            card.addEventListener("mouseenter", () => { card.style.transform = "translateY(-4px)"; });
            card.addEventListener("mouseleave", () => { card.style.transform = "translateY(0)"; });
            card.addEventListener("click", () => {
                const targetModule = card.getAttribute("data-target");
                if (targetModule) { window.location.hash = targetModule; }
            });
        });

        this._cleanup = () => {
            isDestroyed = true;
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
        console.log("Lobby module destroyed.");
    }
};
