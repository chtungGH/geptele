// 直接在模組內引入資料庫 SDK
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

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

export default {
    id: "profile",

    init: async function(container) {
        // 讀取目前記錄的序號，預設使用 TEST01
        let currentLicenseKey = localStorage.getItem("boshen_license_key") || "TEST01";

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
                            <p class="text-slate-400">請直接透過本頁下方的「意見回饋與調查」填寫題號或狀況，我們會儘快修正更新。</p>
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

        container.innerHTML = `
            <div class="space-y-6" style="padding-bottom: 70px;">
                <!-- 頂部導覽列 -->
                <div class="flex items-center justify-between theme-card p-4 rounded-2xl border border-slate-700 shadow-sm" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex items-center space-x-3">
                        <button id="profile-back-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-slate-200">← 返回大廳</button>
                        <h2 class="font-black text-sky-400 text-base">👤 個人學習檔案</h2>
                    </div>
                    <button id="profile-refresh-btn" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer">
                        🔄 重新同步
                    </button>
                </div>

                <!-- 1. 帳號與身分資訊（含頭像顯示與固定頭像挑選器） -->
                <div class="theme-card p-5 rounded-2xl border border-slate-700 shadow-sm space-y-4" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="flex items-center space-x-4">
                            <div class="relative group">
                                <img id="prof-avatar-img" src="${FALLBACK_AVATARS[0].imageUrl}" alt="目前頭像"
                                    class="w-16 h-16 rounded-2xl object-cover border-2 border-sky-400/70 bg-slate-900 shadow-lg" />
                                <span id="prof-avatar-badge" class="hidden"></span>
                            </div>
                            <div>
                                <div class="flex items-center flex-wrap gap-2">
                                    <h3 id="prof-buyer-name" class="font-black text-lg text-slate-100">學習者</h3>
                                    <span id="prof-status-badge" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">載入中</span>
                                    <span id="prof-avatar-name" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">青龍</span>
                                </div>
                                <p class="text-xs text-slate-400 mt-1">
                                    授權序號：<span id="prof-license-text" class="font-mono font-bold text-sky-300">${currentLicenseKey}</span>
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center flex-wrap gap-2">
                            <button id="toggle-avatar-picker-btn" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow">
                                🎨 挑選頭像
                            </button>
                            <button id="switch-account-btn" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer">
                                🔑 切換序號
                            </button>
                        </div>
                    </div>

                    <!-- 固定頭像挑選器面板 -->
                    <div id="avatar-picker-panel" class="hidden bg-slate-900/95 p-4 rounded-2xl border border-slate-700 space-y-3">
                        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div>
                                <h4 class="font-black text-sm text-sky-300">🐉 固定頭像挑選器</h4>
                                <p class="text-[11px] text-slate-400">點選下方頭像即可立即套用並同步至雲端帳號</p>
                            </div>
                            <span id="avatar-save-status" class="text-xs font-bold text-emerald-400"></span>
                        </div>
                        <div id="avatar-picker-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
                    </div>
                </div>

                <!-- 2. 每天打卡記錄 -->
                <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
                        <div>
                            <h3 class="font-black text-base text-amber-300">📅 每天打卡記錄</h3>
                            <p id="checkin-subtext" class="text-xs text-slate-400 mt-0.5">保持每天練習節奏，打卡即可領取 +10 積點獎勵！</p>
                        </div>
                        <button id="daily-checkin-btn" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer shadow">
                            ⏳ 讀取狀態...
                        </button>
                    </div>

                    <div class="grid grid-cols-3 gap-3 text-center">
                        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div class="text-[11px] text-slate-400">連續打卡</div>
                            <div class="text-xl font-black text-amber-400 mt-0.5"><span id="prof-streak">0</span> <span class="text-xs font-bold">天</span></div>
                        </div>
                        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div class="text-[11px] text-slate-400">累計打卡</div>
                            <div class="text-xl font-black text-sky-400 mt-0.5"><span id="prof-total-checkins">0</span> <span class="text-xs font-bold">天</span></div>
                        </div>
                        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div class="text-[11px] text-slate-400">最近打卡日</div>
                            <div id="prof-last-checkin" class="text-xs font-mono font-bold text-slate-200 mt-2">--</div>
                        </div>
                    </div>

                    <!-- 近 7 日打卡燈號 -->
                    <div>
                        <div class="text-[11px] font-bold text-slate-400 mb-2">最近 7 天打卡軌跡：</div>
                        <div id="checkin-week-grid" class="grid grid-cols-7 gap-2 text-center"></div>
                    </div>
                </div>

                <!-- 3. 學習進度（已完成多少練習） -->
                <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex items-center justify-between pb-3 border-b border-slate-700">
                        <div>
                            <h3 class="font-black text-base text-emerald-400">📊 學習進度統計</h3>
                            <p class="text-xs text-slate-400 mt-0.5">各單元已完成的練習題數與回合紀錄</p>
                        </div>
                        <div class="text-right">
                            <span class="text-[11px] text-slate-400 block">累計總練習</span>
                            <span id="prof-total-practices" class="text-lg font-black text-emerald-300">0 題</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                            <div class="text-xs font-bold text-sky-300">🔤 單字選擇</div>
                            <div id="prog-vocab" class="text-xl font-black text-white">0 <span class="text-xs font-normal text-slate-400">題</span></div>
                        </div>
                        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                            <div class="text-xs font-bold text-indigo-300">💬 情境句子</div>
                            <div id="prog-sentence" class="text-xl font-black text-white">0 <span class="text-xs font-normal text-slate-400">題</span></div>
                        </div>
                        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                            <div class="text-xs font-bold text-amber-300">🧩 克漏字填空</div>
                            <div id="prog-cloze" class="text-xl font-black text-white">0 <span class="text-xs font-normal text-slate-400">篇</span></div>
                        </div>
                        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                            <div class="text-xs font-bold text-rose-300">📖 閱讀測驗</div>
                            <div id="prog-reading" class="text-xl font-black text-white">0 <span class="text-xs font-normal text-slate-400">篇</span></div>
                        </div>
                    </div>
                </div>

                <!-- 4. 獎勵與收藏摘要 -->
                <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-4" style="background: #1e293b; color: #f8fafc;">
                    <div class="flex items-center justify-between">
                        <h3 class="font-black text-base text-purple-300">🎒 資源與卡牌收藏摘要</h3>
                        <button id="goto-card-btn" class="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition cursor-pointer">
                            前往卡牌圖鑑 →
                        </button>
                    </div>
                    <div class="grid grid-cols-3 gap-3 text-center">
                        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div class="text-[11px] text-slate-400">持有積點</div>
                            <div class="text-lg font-black text-amber-400 mt-0.5">💰 <span id="prof-coins">0</span></div>
                        </div>
                        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div class="text-[11px] text-slate-400">圖鑑解鎖</div>
                            <div id="prof-card-unlocked" class="text-lg font-black text-purple-300 mt-0.5">0 / 0</div>
                        </div>
                        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div class="text-[11px] text-slate-400">可交換重複卡</div>
                            <div class="text-lg font-black text-emerald-300 mt-0.5"><span id="prof-card-dups">0</span> <span class="text-xs font-bold">張</span></div>
                        </div>
                    </div>
                </div>

                <!-- 5. 說明規範與意見回饋／調查專區 -->
                <div class="theme-card p-5 rounded-2xl border border-slate-700 space-y-5" style="background: #1e293b; color: #f8fafc;">
                    <div class="border-b border-slate-700 pb-3">
                        <h3 class="font-black text-base text-slate-200">📋 平台說明、規範與意見回饋</h3>
                        <p class="text-xs text-slate-400 mt-0.5">點選下方項目可查看詳細說明，或填寫意見調查協助我們優化體驗</p>
                    </div>

                    <!-- 說明與條款按鈕列 -->
                    <div class="flex flex-wrap gap-2">
                        <button class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white transition cursor-pointer" data-doc="guide">📖 使用說明</button>
                        <button class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="faq">❓ 常見問題</button>
                        <button class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="terms">📜 服務條款</button>
                        <button class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="privacy">🔒 隱私權政策</button>
                        <button class="legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer" data-doc="copyright">©️ 版權聲明</button>
                    </div>

                    <!-- 動態顯示說明文件內容 -->
                    <div id="legal-doc-viewer" class="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                        <h4 id="legal-doc-title" class="font-black text-sm text-purple-300"></h4>
                        <div id="legal-doc-body"></div>
                    </div>

                    <!-- 意見回饋與意見調查表單 -->
                    <div class="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-700/80 space-y-4">
                        <div>
                            <h4 class="font-black text-sm text-amber-300">💌 意見回饋與學習體驗調查</h4>
                            <p class="text-xs text-slate-400 mt-0.5">歡迎告訴我們您最喜歡的單元、希望新增的卡牌系列，或回報任何問題！</p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold text-slate-300 mb-1">回饋類型</label>
                                <select id="fb-type" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500">
                                    <option value="功能與新卡牌許願">✨ 功能建議 / 新卡牌系列許願</option>
                                    <option value="學習體驗調查">📊 學習難度與體驗調查</option>
                                    <option value="題目或圖片問題回報">🛠️ 題目內容或圖片顯示回報</option>
                                    <option value="其他意見">💬 其他鼓勵或建議</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-300 mb-1">整體滿意度調查</label>
                                <select id="fb-rating" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500">
                                    <option value="5">⭐⭐⭐⭐⭐ 非常喜歡，很有動力！</option>
                                    <option value="4">⭐⭐⭐⭐ 很不錯，順暢好用</option>
                                    <option value="3">⭐⭐⭐ 普通，還有進步空間</option>
                                    <option value="2">⭐⭐ 有些地方不太習慣</option>
                                    <option value="1">⭐ 遇到問題需要協助</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">最希望未來增加的內容（可複選）</label>
                            <div class="flex flex-wrap gap-2 text-xs" id="fb-topics">
                                <label class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer flex items-center gap-1.5">
                                    <input type="checkbox" value="更多收藏卡牌系列" class="accent-purple-500"> 更多收藏卡牌系列
                                </label>
                                <label class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer flex items-center gap-1.5">
                                    <input type="checkbox" value="重複卡交換功能" class="accent-purple-500"> 重複卡交換功能
                                </label>
                                <label class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer flex items-center gap-1.5">
                                    <input type="checkbox" value="更多閱讀與克漏字題庫" class="accent-purple-500"> 更多閱讀與克漏字題庫
                                </label>
                                <label class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer flex items-center gap-1.5">
                                    <input type="checkbox" value="聽力與發音練習" class="accent-purple-500"> 聽力與發音練習
                                </label>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">詳細建議或問題描述</label>
                            <textarea id="fb-message" rows="3" placeholder="請輸入您的想法、許願的卡牌主題，或遇到的問題..." class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"></textarea>
                        </div>

                        <div class="flex items-center justify-between">
                            <span id="fb-status-msg" class="text-xs font-bold text-emerald-400"></span>
                            <button id="fb-submit-btn" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition cursor-pointer shadow">
                                📨 送出意見回饋
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.querySelector("#profile-back-btn").onclick = () => {
            window.location.hash = "lobby";
        };
        container.querySelector("#goto-card-btn").onclick = () => {
            window.location.hash = "card";
        };

        if (!firebase.apps.length) {
            firebase.initializeApp({
                databaseURL: "https://chtreadingcompre-default-rtdb.firebaseio.com/"
            });
        }
        const db = firebase.database();

        let userData = {};
        let totalMetaCards = 0;
        let avatarCatalog = [...FALLBACK_AVATARS];

        function getTodayStr() {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, "0");
            const d = String(now.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        function getYesterdayStr() {
            const dt = new Date();
            dt.setDate(dt.getDate() - 1);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, "0");
            const d = String(dt.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        function renderLegalDoc(docKey) {
            const doc = LEGAL_DOCS[docKey] || LEGAL_DOCS.guide;
            container.querySelector("#legal-doc-title").textContent = doc.title;
            container.querySelector("#legal-doc-body").innerHTML = doc.content;

            container.querySelectorAll(".legal-tab-btn").forEach(btn => {
                const isActive = btn.getAttribute("data-doc") === docKey;
                btn.className = `legal-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive ? "bg-purple-600 text-white shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`;
            });
        }

        container.querySelectorAll(".legal-tab-btn").forEach(btn => {
            btn.onclick = () => renderLegalDoc(btn.getAttribute("data-doc"));
        });
        renderLegalDoc("guide");

        function getCurrentAvatarObj() {
            const savedId = userData.avatarId || localStorage.getItem(`boshen_avatar_${currentLicenseKey}`) || "AV01";
            return avatarCatalog.find(a => a.id === savedId) || avatarCatalog[0] || FALLBACK_AVATARS[0];
        }

        function renderAvatarPicker() {
            const grid = container.querySelector("#avatar-picker-grid");
            if (!grid) return;

            const activeAvatar = getCurrentAvatarObj();
            grid.innerHTML = avatarCatalog.map(av => {
                const isSelected = av.id === activeAvatar.id;
                return `
                    <button type="button" data-avatar-id="${av.id}"
                        class="avatar-option-btn flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                                ? "bg-sky-500/20 border-sky-400 text-white shadow"
                                : "bg-slate-950/80 border-slate-800 hover:border-slate-600 text-slate-300"
                        }">
                        <img src="${av.imageUrl}" alt="${av.AvatarName}"
                            class="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-900 border border-slate-700" />
                        <div class="min-w-0">
                            <div class="text-xs font-black truncate">${av.AvatarName || av.id}</div>
                            <div class="text-[10px] font-mono text-slate-400">${av.id}</div>
                        </div>
                    </button>
                `;
            }).join("");

            grid.querySelectorAll(".avatar-option-btn").forEach(btn => {
                btn.onclick = async () => {
                    const selectedId = btn.getAttribute("data-avatar-id");
                    const chosen = avatarCatalog.find(a => a.id === selectedId);
                    if (!chosen) return;

                    const statusEl = container.querySelector("#avatar-save-status");
                    statusEl.textContent = "儲存中...";

                    try {
                        await db.ref(`licenses/${currentLicenseKey}`).update({
                            avatarId: chosen.id,
                            avatarUrl: chosen.imageUrl
                        });
                        userData.avatarId = chosen.id;
                        userData.avatarUrl = chosen.imageUrl;
                        localStorage.setItem(`boshen_avatar_${currentLicenseKey}`, chosen.id);
                        renderProfileUI();
                        renderAvatarPicker();
                        statusEl.textContent = `✅ 已套用「${chosen.AvatarName}」`;
                        setTimeout(() => { statusEl.textContent = ""; }, 2500);
                    } catch (err) {
                        console.error(err);
                        statusEl.textContent = "";
                        alert("❌ 頭像儲存失敗：" + err.message);
                    }
                };
            });
        }

        function renderWeekCheckins(checkinHistory = {}) {
            const weekGrid = container.querySelector("#checkin-week-grid");
            const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
            let html = "";

            for (let i = 6; i >= 0; i--) {
                const dt = new Date();
                dt.setDate(dt.getDate() - i);
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, "0");
                const d = String(dt.getDate()).padStart(2, "0");
                const dateStr = `${y}-${m}-${d}`;
                const checked = Boolean(checkinHistory[dateStr]);
                const isToday = i === 0;

                html += `
                    <div class="p-2 rounded-xl border ${
                        checked
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-300"
                            : isToday
                                ? "bg-slate-900 border-sky-500/50 text-slate-300"
                                : "bg-slate-950/60 border-slate-800 text-slate-500"
                    }">
                        <div class="text-[10px]">週${dayNames[dt.getDay()]}</div>
                        <div class="text-xs font-bold mt-0.5">${m}/${d}</div>
                        <div class="text-sm mt-1">${checked ? "✅" : isToday ? "⏳" : "·"}</div>
                    </div>
                `;
            }
            weekGrid.innerHTML = html;
        }

        function renderProfileUI() {
            const today = getTodayStr();
            const buyer = userData.buyer || "學習夥伴";
            const status = userData.status || "啟用";
            const coins = Number(userData.coins) || 0;
            const streak = Number(userData.streak) || 0;
            const checkinHistory = userData.checkinHistory || {};
            const lastCheckinDate = userData.lastCheckinDate || userData.latestLoginDate || "";
            const isCheckedToday = Boolean(checkinHistory[today]) || lastCheckinDate === today;

            if (lastCheckinDate && !checkinHistory[lastCheckinDate]) {
                checkinHistory[lastCheckinDate] = true;
            }
            const totalCheckinDays = Object.keys(checkinHistory).length;

            // 更新頭像顯示
            const currentAvatar = getCurrentAvatarObj();
            const avatarImg = container.querySelector("#prof-avatar-img");
            const avatarNameEl = container.querySelector("#prof-avatar-name");
            if (avatarImg) {
                avatarImg.src = userData.avatarUrl || currentAvatar.imageUrl;
                avatarImg.alt = currentAvatar.AvatarName || "頭像";
            }
            if (avatarNameEl) {
                avatarNameEl.textContent = currentAvatar.AvatarName || currentAvatar.id;
            }

            container.querySelector("#prof-buyer-name").textContent = buyer;
            container.querySelector("#prof-license-text").textContent = currentLicenseKey;
            container.querySelector("#prof-status-badge").textContent = status;
            container.querySelector("#prof-coins").textContent = coins;
            container.querySelector("#prof-streak").textContent = streak;
            container.querySelector("#prof-total-checkins").textContent = totalCheckinDays;
            container.querySelector("#prof-last-checkin").textContent = lastCheckinDate || "尚未打卡";

            const checkinBtn = container.querySelector("#daily-checkin-btn");
            const checkinSub = container.querySelector("#checkin-subtext");
            if (isCheckedToday) {
                checkinBtn.disabled = true;
                checkinBtn.textContent = "✅ 今日已完成打卡";
                checkinSub.textContent = "太棒了！今天的學習打卡已完成，明天繼續保持！";
            } else {
                checkinBtn.disabled = false;
                checkinBtn.textContent = "✨ 立即打卡 (+10點)";
                checkinSub.textContent = "今天尚未打卡，點擊右側按鈕完成每日簽到並領取 +10 積點！";
            }

            renderWeekCheckins(checkinHistory);

            // 學習進度
            const progress = userData.progress || {};
            const vocabCount = Number(progress.vocab) || 0;
            const sentenceCount = Number(progress.sentence) || 0;
            const clozeCount = Number(progress.cloze) || 0;
            const readingCount = Number(progress.reading) || 0;
            const totalCount = vocabCount + sentenceCount + clozeCount + readingCount;

            container.querySelector("#prog-vocab").innerHTML = `${vocabCount} <span class="text-xs font-normal text-slate-400">題</span>`;
            container.querySelector("#prog-sentence").innerHTML = `${sentenceCount} <span class="text-xs font-normal text-slate-400">題</span>`;
            container.querySelector("#prog-cloze").innerHTML = `${clozeCount} <span class="text-xs font-normal text-slate-400">篇</span>`;
            container.querySelector("#prog-reading").innerHTML = `${readingCount} <span class="text-xs font-normal text-slate-400">篇</span>`;
            container.querySelector("#prof-total-practices").textContent = `${totalCount} 次練習`;

            // 卡牌收藏摘要
            const cardsObj = userData.cards || {};
            let unlockedTypes = 0;
            let duplicateCopies = 0;
            Object.values(cardsObj).forEach(qty => {
                const n = Number(qty) || 0;
                if (n > 0) {
                    unlockedTypes++;
                    if (n > 1) duplicateCopies += (n - 1);
                }
            });
            container.querySelector("#prof-card-unlocked").textContent = `${unlockedTypes} / ${totalMetaCards}`;
            container.querySelector("#prof-card-dups").textContent = duplicateCopies;
        }

        async function loadProfileData() {
            try {
                const [userSnap, metaSnap, avatarsSnap] = await Promise.all([
                    db.ref(`licenses/${currentLicenseKey}`).once("value"),
                    db.ref("cards_meta").once("value"),
                    db.ref("avatars").once("value")
                ]);
                userData = userSnap.val() || {};
                const metaObj = metaSnap.val() || {};
                totalMetaCards = Object.keys(metaObj).length;

                if (avatarsSnap.exists()) {
                    const list = Object.values(avatarsSnap.val()).filter(item => item && item.imageUrl);
                    if (list.length > 0) {
                        avatarCatalog = list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
                    }
                }

                renderProfileUI();
                renderAvatarPicker();
            } catch (err) {
                console.error(err);
                alert("❌ 讀取個人資料失敗：" + err.message);
            }
        }

        container.querySelector("#toggle-avatar-picker-btn").onclick = () => {
            const panel = container.querySelector("#avatar-picker-panel");
            panel.classList.toggle("hidden");
            if (!panel.classList.contains("hidden")) {
                renderAvatarPicker();
            }
        };

        // 每日打卡按鈕事件
        container.querySelector("#daily-checkin-btn").onclick = async () => {
            const today = getTodayStr();
            const yesterday = getYesterdayStr();
            const checkinHistory = { ...(userData.checkinHistory || {}) };
            const lastDate = userData.lastCheckinDate || "";

            if (checkinHistory[today] || lastDate === today) return;

            const rewardCoins = 10;
            const nextCoins = (Number(userData.coins) || 0) + rewardCoins;
            const nextStreak = (lastDate === yesterday || checkinHistory[yesterday])
                ? (Number(userData.streak) || 0) + 1
                : 1;
            checkinHistory[today] = true;

            try {
                await db.ref(`licenses/${currentLicenseKey}`).update({
                    coins: nextCoins,
                    streak: nextStreak,
                    lastCheckinDate: today,
                    latestLoginDate: today,
                    checkinHistory: checkinHistory
                });

                userData.coins = nextCoins;
                userData.streak = nextStreak;
                userData.lastCheckinDate = today;
                userData.checkinHistory = checkinHistory;
                renderProfileUI();
            } catch (err) {
                console.error(err);
                alert("❌ 打卡儲存失敗：" + err.message);
            }
        };

        // 切換測試或授權序號
        container.querySelector("#switch-account-btn").onclick = () => {
            const inputKey = prompt("請輸入要切換的授權序號（例如 TEST01）：", currentLicenseKey);
            if (!inputKey) return;
            const cleanKey = inputKey.trim().toUpperCase().replace(/[.#$\[\]\/]/g, "_");
            if (!cleanKey) return;
            currentLicenseKey = cleanKey;
            localStorage.setItem("boshen_license_key", currentLicenseKey);
            loadProfileData();
        };

        container.querySelector("#profile-refresh-btn").onclick = () => {
            loadProfileData();
        };

        // 送出意見回饋與意見調查
        container.querySelector("#fb-submit-btn").onclick = async () => {
            const type = container.querySelector("#fb-type").value;
            const rating = Number(container.querySelector("#fb-rating").value) || 5;
            const message = container.querySelector("#fb-message").value.trim();
            const checkedTopics = Array.from(container.querySelectorAll("#fb-topics input:checked")).map(el => el.value);
            const statusMsg = container.querySelector("#fb-status-msg");
            const submitBtn = container.querySelector("#fb-submit-btn");

            if (!message && checkedTopics.length === 0) {
                alert("請至少勾選一項希望增加的內容，或填寫您的意見與建議！");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "送出中...";

            try {
                await db.ref("user_feedback").push({
                    licenseKey: currentLicenseKey,
                    type: type,
                    rating: rating,
                    wantedTopics: checkedTopics,
                    message: message,
                    createdAt: new Date().toISOString()
                });

                container.querySelector("#fb-message").value = "";
                container.querySelectorAll("#fb-topics input:checked").forEach(el => { el.checked = false; });
                statusMsg.textContent = "✅ 感謝您的回饋！我們已收到您的寶貴意見。";
                setTimeout(() => { statusMsg.textContent = ""; }, 4000);
            } catch (err) {
                console.error(err);
                alert("❌ 回饋送出失敗：" + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "📨 送出意見回饋";
            }
        };

        loadProfileData();
    },

    destroy: function() {
        console.log("Profile module destroyed.");
    }
};