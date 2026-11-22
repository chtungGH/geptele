// modules/profile/legalFeedback.js
// 平台說明、規範與外連 Google 表單意見回饋子模組

const GOOGLE_FORM_URL = "https://forms.gle/yJVDKyRJwrNuaoTJ7";

const LEGAL_DOCS = {
    guide: {
        title: "📖 使用說明",
        content: `
            <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p><strong>1. 學習單元：</strong>可由學習大廳進入「單字選擇」、「情境句子」、「克漏字填空」與「閱讀測驗」進行練習，系統會自動累積練習紀錄與答題積點。</p>
                <p><strong>2. 每日打卡：</strong>每天登入個人資料頁完成打卡，可累積連續學習天數並獲得每日簽到積點。</p>
                <p><strong>3. 卡牌與商城：</strong>累積的積點可用於「卡牌」抽取收藏卡包，或至「商城」兌換造型與道具。</p>
            </div>
        `
    },
    faq: {
        title: "❓ 常見問題 (FAQ)",
        content: `
            <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div>
                    <p class="font-bold text-amber-300">Q1：為什麼抽到的卡片顯示「x2」或「x3」？</p>
                    <p class="text-slate-400">代表您抽到了重複的卡片，系統會自動幫您累計持有張數，不會覆蓋掉原本已解鎖的圖鑑。</p>
                </div>
                <div>
                    <p class="font-bold text-amber-300">Q2：更換電腦或平板後，學習紀錄和卡牌會不見嗎？</p>
                    <p class="text-slate-400">不會。所有積點、打卡與卡牌資料皆隨您的授權序號保存在雲端，只要輸入同一組序號即可同步讀取。</p>
                </div>
                <div>
                    <p class="font-bold text-amber-300">Q3：發現題目翻譯或圖片顯示異常怎麼辦？</p>
                    <p class="text-slate-400">請直接點擊上方「💌 意見回饋表單」回報題號或狀況，我們會儘快修正更新。</p>
                </div>
            </div>
        `
    },
    terms: {
        title: "📜 服務條款",
        content: `
            <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>歡迎使用「博深數位學習小站」。使用本平台服務即表示您同意遵守以下規範：</p>
                <p>1. 授權序號僅供個人或家庭授權範圍內之裝置使用，請勿公開散布、轉售或以自動化程式異常刷取積點與資料。</p>
                <p>2. 平台得視教學與系統維護需要，適時調整題庫內容、積點規則及卡牌系列配置。</p>
            </div>
        `
    },
    privacy: {
        title: "🔒 隱私權政策",
        content: `
            <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>我們重視每一位學習者與家長的隱私安全：</p>
                <p>1. 本平台僅收集維持學習服務所需之必要紀錄（包含授權序號識別碼、打卡日期、練習次數、積點與卡牌收藏狀態）。</p>
                <p>2. 您所填寫的意見回饋僅用於改善題庫品質與系統功能，絕不會將資料出售或提供予無關第三方。</p>
            </div>
        `
    },
    copyright: {
        title: "©️ 版權聲明",
        content: `
            <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>© 2026 博深數位學習小站 版權所有。</p>
                <p>本網站內之程式碼架構、互動介面設計、題庫編排及專屬收藏卡牌圖像，均受著作權法保護。未經書面許可，禁止重製、改作或用於商業用途。</p>
            </div>
        `
    }
};

export function renderLegalFeedbackSection(container) {
    if (!container) return;

    const defaultDoc = LEGAL_DOCS.guide;

    container.innerHTML = `
        <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                    <h3 class="font-black text-base text-slate-200">📋 平台說明、規範與意見回饋</h3>
                    <p class="text-xs text-slate-400 mt-0.5">點選下方項目可查看詳細說明，或直接開啟表單填寫意見回饋</p>
                </div>
                <a href="${GOOGLE_FORM_URL}" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition shadow shrink-0">
                    <span>💌 意見回饋表單</span>
                    <span class="text-[10px]">↗</span>
                </a>
            </div>

            <!-- 說明與條款按鈕列 -->
            <div class="flex flex-wrap gap-2">
                <button type="button" class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white shadow transition cursor-pointer" data-doc="guide">📖 使用說明</button>
                <button type="button" class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="faq">❓ 常見問題</button>
                <button type="button" class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="terms">📜 服務條款</button>
                <button type="button" class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="privacy">🔒 隱私權政策</button>
                <button type="button" class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="copyright">©️ 版權聲明</button>
            </div>

            <!-- 動態顯示說明文件內容 -->
            <div id="legal-doc-viewer" class="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 id="legal-doc-title" class="font-black text-sm text-purple-300">${defaultDoc.title}</h4>
                <div id="legal-doc-body">${defaultDoc.content}</div>
            </div>
        </div>
    `;
}

export function bindLegalFeedbackSection(container) {
    if (!container) return;

    const titleEl = container.querySelector("#legal-doc-title");
    const bodyEl = container.querySelector("#legal-doc-body");
    const tabs = container.querySelectorAll(".legal-tab-btn");

    tabs.forEach(btn => {
        btn.onclick = () => {
            const docKey = btn.getAttribute("data-doc");
            const doc = LEGAL_DOCS[docKey] || LEGAL_DOCS.guide;
            if (titleEl) titleEl.textContent = doc.title;
            if (bodyEl) bodyEl.innerHTML = doc.content;

            tabs.forEach(t => {
                const isActive = t.getAttribute("data-doc") === docKey;
                t.className = `legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive ? "bg-purple-600 text-white shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`;
            });
        };
    });
}