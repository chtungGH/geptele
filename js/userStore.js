// gept-local-test/js/userStore.js
const UserStore = (() => {
  const ACTIVE_ID_KEY = 'boshen_active_user_id';
  const LEGACY_KEY = 'boshen_license_key';
  const PROFILE_PREFIX = 'boshen_profile_';
  const RULES_CACHE_KEY = 'boshen_game_rules_cache';
  const THEME_KEY = 'boshen_active_theme';
  const DEFAULT_THEME = 'default';
  const listeners = new Set();

  // 預設積點與商城規則（離線或尚未從 Google Sheets 同步時的保底值）
  const DEFAULT_RULES = {
    vocab_per_correct: 5,
    cloze_per_correct: 5,
    sentences_per_correct: 5,
    reading_elem1_per_correct: 5,
    reading_elem2_per_correct: 10,
    reading_elem3_per_correct: 15,
    daily_checkin_bonus: 10,
    streak_point_cap: 200,
    gacha_pack_cost: 30,
    skin_tier1_cost: 100,
    skin_tier2_cost: 200
  };

  let dbRefFactory = null;
  let dbOps = null;
  let activeFirebaseUnsub = null;
  let rulesFirebaseUnsub = null;
  let firebaseSyncPromise = null;
  let syncedUserId = null;
  let updateQueue = Promise.resolve();

  function readCachedRules() {
    const raw = localStorage.getItem(RULES_CACHE_KEY);
    if (!raw) return { ...DEFAULT_RULES };
    try {
      return { ...DEFAULT_RULES, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_RULES };
    }
  }

  let gameRules = readCachedRules();

  function normalizeTheme(themeId) {
    const clean = String(themeId || '').trim();
    if (!clean) return DEFAULT_THEME;
    if (typeof window !== 'undefined' && window.ThemeManager && typeof window.ThemeManager.isValidTheme === 'function') {
      return window.ThemeManager.isValidTheme(clean) ? clean : DEFAULT_THEME;
    }
    return clean;
  }

  function readCachedTheme() {
    return normalizeTheme(localStorage.getItem(THEME_KEY) || DEFAULT_THEME);
  }

  const defaultQuestionStats = () => ({
    vocabulary: 0,
    sentences: 0,
    cloze: 0,
    reading: 0
  });

  const defaultProfile = (userId) => ({
    userId,
    name: userId === 'GUEST' ? '訪客學員' : userId,
    points: 150,
    streakPoints: 0,
    theme: readCachedTheme(),
    cards: {},
    practiceStats: {
      vocabulary: 0,
      reading: 0,
      cloze: 0,
      clozeReading: 0,
      sentences: 0,
      totalCount: 0
    },
    questionStats: defaultQuestionStats(),
    updatedAt: 0
  });

  const initialId = String(
    localStorage.getItem(ACTIVE_ID_KEY) ||
    localStorage.getItem(LEGACY_KEY) ||
    '50TEST'
  ).trim().toUpperCase();

  function isLocalOnlyUser(uid) {
    return uid === 'GUEST' || uid === '50TEST';
  }

  function getStorageKey(uid = state.userId) {
    return `${PROFILE_PREFIX}${uid}`;
  }

  function normalizeProfile(uid, rawObj = {}) {
    const base = defaultProfile(uid);
    return {
      ...base,
      ...rawObj,
      theme: normalizeTheme(rawObj?.theme || base.theme),
      streakPoints: Number(rawObj?.streakPoints || 0),
      practiceStats: {
        ...base.practiceStats,
        ...(rawObj?.practiceStats || {})
      },
      questionStats: {
        ...base.questionStats,
        ...(rawObj?.questionStats || {})
      }
    };
  }

  function readFromLocal(uid) {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return null;
    try {
      return normalizeProfile(uid, JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function saveToLocal(uid, profileData) {
    localStorage.setItem(getStorageKey(uid), JSON.stringify(profileData));
    if (uid === state.userId && profileData?.theme) {
      localStorage.setItem(THEME_KEY, normalizeTheme(profileData.theme));
    }
  }

  let state = {
    userId: initialId,
    profile: readFromLocal(initialId) || defaultProfile(initialId)
  };
  localStorage.setItem(ACTIVE_ID_KEY, initialId);
  localStorage.setItem(LEGACY_KEY, initialId);
  localStorage.setItem(THEME_KEY, normalizeTheme(state.profile.theme));

  function getTheme() {
    return normalizeTheme(state.profile?.theme || localStorage.getItem(THEME_KEY) || DEFAULT_THEME);
  }

  function syncThemeToDOM(themeId = getTheme()) {
    const safeTheme = normalizeTheme(themeId);
    if (typeof document !== 'undefined' && document.documentElement) {
      if (document.documentElement.dataset.theme !== safeTheme) {
        document.documentElement.dataset.theme = safeTheme;
      }
    }
    if (typeof window !== 'undefined' && typeof window.applyTheme === 'function') {
      window.applyTheme(safeTheme, document);
    }
  }

  function getState() {
    return {
      userId: state.userId,
      profile: structuredClone(state.profile),
      rules: { ...gameRules }
    };
  }

  // 取得單一規則數值（例如 UserStore.getRule('streak_point_cap') -> 200）
  function getRule(ruleKey, fallbackValue) {
    if (ruleKey in gameRules && typeof gameRules[ruleKey] === 'number' && !Number.isNaN(gameRules[ruleKey])) {
      return gameRules[ruleKey];
    }
    return fallbackValue !== undefined ? fallbackValue : (DEFAULT_RULES[ruleKey] || 0);
  }

  function getAllRules() {
    return { ...gameRules };
  }

  // 依模組與等級計算本次練習應得點數
  // options.level 支援 'elem1' | 'elem2' | 'elem3'
  function calcPracticePoints(moduleName, correctCount, options = {}) {
    const count = Math.max(0, Number(correctCount) || 0);
    if (count === 0) return 0;

    let ruleKey = `${moduleName}_per_correct`;
    if (moduleName === 'vocabulary') {
      ruleKey = 'vocab_per_correct';
    } else if ((moduleName === 'reading' || moduleName === 'clozeReading') && options.level) {
      const lvl = String(options.level).trim().toLowerCase();
      ruleKey = `reading_${lvl}_per_correct`;
    }

    return count * getRule(ruleKey, 5);
  }

  function refreshDOM() {
    const { userId, profile } = getState();
    const totalCards = Object.values(profile.cards || {}).reduce((sum, n) => sum + Number(n || 0), 0);
    const uniqueCards = Object.values(profile.cards || {}).filter((n) => Number(n || 0) > 0).length;

    const map = {
      'user.id': userId,
      'user.name': profile.name,
      'user.points': profile.points ?? 0,
      'user.totalCards': totalCards,
      'user.uniqueCards': uniqueCards,
      'user.totalPractice': profile.practiceStats?.totalCount || 0,
      'rule.gachaCost': getRule('gacha_pack_cost', 30)
    };

    document.querySelectorAll('[data-bind]').forEach((el) => {
      const key = el.getAttribute('data-bind');
      if (key in map) {
        el.textContent = map[key];
      }
    });

    if (typeof window.__setTopBarStatus === 'function') {
      window.__setTopBarStatus({
        id: userId,
        points: Number(profile.points ?? 0),
        uniqueCards,
        totalCards,
        practiceCount: Number(profile.practiceStats?.totalCount || 0)
      });
    }

    if (typeof document !== 'undefined' && document.documentElement) {
      const targetTheme = normalizeTheme(profile.theme);
      if (document.documentElement.dataset.theme !== targetTheme) {
        syncThemeToDOM(targetTheme);
      }
    }
  }

  function emit(eventName, payload = null) {
    const snapshot = getState();
    refreshDOM();
    listeners.forEach((cb) => {
      try {
        cb(eventName, snapshot, payload);
      } catch (err) {
        console.error('[UserStore] listener error:', err);
      }
    });
  }

  // 掛載 Firebase game_config/rules 即時監聽（試算表同步後前端自動套用新費率）
  function attachGameRulesListener() {
    if (!dbRefFactory || !dbOps) return;

    if (typeof rulesFirebaseUnsub === 'function') {
      rulesFirebaseUnsub();
      rulesFirebaseUnsub = null;
    }

    const rulesRef = dbRefFactory('game_config/rules');
    rulesFirebaseUnsub = dbOps.onValue(rulesRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const raw = snapshot.val() || {};
      const nextRules = { ...DEFAULT_RULES };

      Object.keys(raw).forEach((k) => {
        const item = raw[k];
        const pts = typeof item === 'number' ? item : Number(item?.points);
        if (!Number.isNaN(pts)) {
          nextRules[k] = pts;
        }
      });

      gameRules = nextRules;
      localStorage.setItem(RULES_CACHE_KEY, JSON.stringify(gameRules));
      emit('rules:updated', { rules: { ...gameRules } });
    });
  }

  // 支援 Modular SDK ({ db, ref, get, set, onValue }) 或 Compat SDK ({ compatDb })
  function initFirebase(config = {}) {
    if (config.compatDb) {
      const cdb = config.compatDb;
      dbRefFactory = (path) => cdb.ref(path);
      dbOps = {
        get: (r) => r.once('value'),
        set: (r, val) => r.set(val),
        onValue: (r, cb) => {
          const handler = (snap) => cb(snap);
          r.on('value', handler);
          return () => r.off('value', handler);
        }
      };
    } else if (config.db && config.ref && config.get && config.set && config.onValue) {
      dbRefFactory = (path) => config.ref(config.db, path);
      dbOps = {
        get: config.get,
        set: config.set,
        onValue: config.onValue
      };
    } else {
      console.warn('[UserStore] initFirebase 缺少必要參數');
      return Promise.resolve(getState());
    }

    attachGameRulesListener();
    return switchUser(state.userId);
  }

  // 自動偵測全域 firebase compat 實例（各模組載入 firebase-database-compat 後自動接軌）
  function tryAutoBindCompatFirebase(skipInitialSwitch = false) {
    if (dbRefFactory && dbOps) return true;
    if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.database === 'function') {
      try {
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp({
            databaseURL: 'https://chtreadingcompre-default-rtdb.firebaseio.com/'
          });
        }
        const cdb = window.firebase.database();
        if (skipInitialSwitch) {
          dbRefFactory = (path) => cdb.ref(path);
          dbOps = {
            get: (r) => r.once('value'),
            set: (r, val) => r.set(val),
            onValue: (r, cb) => {
              const handler = (snap) => cb(snap);
              r.on('value', handler);
              return () => r.off('value', handler);
            }
          };
          attachGameRulesListener();
        } else {
          initFirebase({ compatDb: cdb });
        }
        return true;
      } catch (err) {
        console.error('[UserStore] Auto-bind Firebase failed:', err);
      }
    }
    return false;
  }

  // 確保在寫入雲端前，已完成目前帳號的首次 Firebase 同步（避免尚未讀雲端就被本地預設值覆蓋）
  async function ensureFirebaseSynced() {
    const bound = tryAutoBindCompatFirebase();
    if (!bound || !dbRefFactory || !dbOps || isLocalOnlyUser(state.userId)) return;
    if (firebaseSyncPromise) {
      await firebaseSyncPromise;
    } else if (syncedUserId !== state.userId) {
      await switchUser(state.userId);
    }
  }

  function seedProfileFromLicense(targetProfile, licVal = {}) {
    if (!licVal || typeof licVal !== 'object') return;
    const hasLocalUpdates = Number(targetProfile.updatedAt || 0) > 0;

    if (!hasLocalUpdates && licVal.coins !== undefined && licVal.coins !== null && !Number.isNaN(Number(licVal.coins))) {
      targetProfile.points = Number(licVal.coins);
    }
    if (licVal.cards && typeof licVal.cards === 'object') {
      targetProfile.cards = {
        ...licVal.cards,
        ...(targetProfile.cards || {})
      };
    }
    if (licVal.buyer || licVal.name) {
      targetProfile.name = licVal.buyer || licVal.name;
    }
    if (Array.isArray(licVal.ownedSkins) && !Array.isArray(targetProfile.ownedSkins)) {
      targetProfile.ownedSkins = [...licVal.ownedSkins];
    }
    if (licVal.activeSkin && !targetProfile.activeSkin) {
      targetProfile.activeSkin = licVal.activeSkin;
    }
    if (!hasLocalUpdates && licVal.theme) {
      targetProfile.theme = normalizeTheme(licVal.theme);
    }

    const licPStats = licVal.practiceStats || {};
    const licQStats = licVal.questionStats || {};
    const licProgress = licVal.progress || {};

    ['vocabulary', 'reading', 'cloze', 'clozeReading', 'sentences', 'totalCount'].forEach((k) => {
      const localVal = Number(targetProfile.practiceStats?.[k] || 0);
      const remoteVal = Number(licPStats[k] || 0);
      targetProfile.practiceStats[k] = Math.max(localVal, remoteVal);
    });

    if (licVal.totalPractice !== undefined && licVal.totalPractice !== null) {
      targetProfile.practiceStats.totalCount = Math.max(
        Number(targetProfile.practiceStats.totalCount || 0),
        Number(licVal.totalPractice || 0)
      );
    }

    const qFallbackMap = {
      vocabulary: licQStats.vocabulary ?? licProgress.vocab ?? 0,
      sentences: licQStats.sentences ?? licProgress.sentence ?? 0,
      cloze: licQStats.cloze ?? licProgress.cloze ?? 0,
      reading: licQStats.reading ?? licProgress.reading ?? 0
    };
    Object.keys(qFallbackMap).forEach((k) => {
      const localVal = Number(targetProfile.questionStats?.[k] || 0);
      const remoteVal = Number(qFallbackMap[k] || 0);
      targetProfile.questionStats[k] = Math.max(localVal, remoteVal);
    });
  }

  function buildLicenseMirrorPayload(profile) {
    const pStats = profile.practiceStats || {};
    const qStats = profile.questionStats || {};
    return {
      coins: Number(profile.points ?? 0),
      cards: profile.cards || {},
      theme: normalizeTheme(profile.theme),
      practiceStats: {
        vocabulary: Number(pStats.vocabulary || 0),
        reading: Number(pStats.reading || 0),
        cloze: Number(pStats.cloze || 0),
        clozeReading: Number(pStats.clozeReading || 0),
        sentences: Number(pStats.sentences || 0),
        totalCount: Number(pStats.totalCount || 0)
      },
      questionStats: {
        vocabulary: Number(qStats.vocabulary || 0),
        sentences: Number(qStats.sentences || 0),
        cloze: Number(qStats.cloze || 0),
        reading: Number(qStats.reading || 0)
      },
      totalPractice: Number(pStats.totalCount || 0),
      progress: {
        vocab: Number(qStats.vocabulary || 0),
        sentence: Number(qStats.sentences || 0),
        cloze: Number(pStats.cloze || 0),
        reading: Number(pStats.reading || 0)
      }
    };
  }

  async function switchUser(newUserId) {
    tryAutoBindCompatFirebase(true);

    const targetId = String(newUserId || '50TEST')
      .trim()
      .toUpperCase()
      .replace(/[.#$\[\]\/]/g, '_');

    if (typeof activeFirebaseUnsub === 'function') {
      activeFirebaseUnsub();
      activeFirebaseUnsub = null;
    }

    state.userId = targetId;
    localStorage.setItem(ACTIVE_ID_KEY, targetId);
    localStorage.setItem(LEGACY_KEY, targetId);

    state.profile = readFromLocal(targetId) || defaultProfile(targetId);
    emit('user:switched', { userId: targetId });

    // 試用帳號 50TEST：僅在本地尚未建立紀錄時讀取一次雲端 licenses/50TEST 當初始值，之後進度僅存本機避免多人互蓋
    if (dbRefFactory && dbOps && targetId === '50TEST') {
      if (Number(state.profile.updatedAt || 0) === 0) {
        try {
          const licSnap = await dbOps.get(dbRefFactory(`licenses/${targetId}`));
          if (state.userId === targetId && licSnap.exists()) {
            seedProfileFromLicense(state.profile, licSnap.val());
            saveToLocal(targetId, state.profile);
            emit('profile:synced', { source: 'trial-seed' });
          }
        } catch (err) {
          console.warn('[UserStore] Trial 50TEST initial seed failed:', err);
        }
      }
      syncedUserId = targetId;
      return getState();
    }

    if (dbRefFactory && dbOps && !isLocalOnlyUser(targetId)) {
      const userRef = dbRefFactory(`users/${targetId}/profile`);
      const syncTask = (async () => {
        try {
          const snap = await dbOps.get(userRef);
          if (state.userId !== targetId) return;

          if (snap.exists()) {
            const remoteData = normalizeProfile(targetId, snap.val());
            if ((remoteData.updatedAt || 0) >= (state.profile.updatedAt || 0)) {
              state.profile = remoteData;
              saveToLocal(targetId, state.profile);
              emit('profile:synced', { source: 'firebase' });
            } else {
              await dbOps.set(userRef, state.profile);
            }
          } else {
            // 若 users/{uid}/profile 尚未建立，先嘗試從 licenses/{uid} 承接既有積點、卡牌與練習進度作為初始值
            try {
              const licSnap = await dbOps.get(dbRefFactory(`licenses/${targetId}`));
              if (state.userId !== targetId) return;
              if (licSnap.exists()) {
                seedProfileFromLicense(state.profile, licSnap.val());
              }
            } catch (licErr) {
              console.warn('[UserStore] Seed from licenses failed:', licErr);
            }

            if (state.userId !== targetId) return;
            state.profile.updatedAt = Date.now();
            saveToLocal(targetId, state.profile);
            await dbOps.set(userRef, state.profile);
            emit('profile:synced', { source: 'firebase-seed' });
          }

          if (state.userId === targetId) {
            const unsubscribe = dbOps.onValue(userRef, (snapshot) => {
              if (!snapshot.exists() || state.userId !== targetId) return;
              const incoming = normalizeProfile(targetId, snapshot.val());
              if ((incoming.updatedAt || 0) > (state.profile.updatedAt || 0)) {
                state.profile = incoming;
                saveToLocal(targetId, state.profile);
                emit('profile:synced', { source: 'firebase-realtime' });
              }
            });
            activeFirebaseUnsub = unsubscribe;
            syncedUserId = targetId;
          }
        } catch (err) {
          console.error('[UserStore] Firebase sync failed:', err);
          // 若 users/{uid}/profile 讀取受限，降級改從 licenses/{uid} 承接既有資料
          try {
            const licSnap = await dbOps.get(dbRefFactory(`licenses/${targetId}`));
            if (state.userId === targetId && licSnap.exists()) {
              seedProfileFromLicense(state.profile, licSnap.val());
              saveToLocal(targetId, state.profile);
              emit('profile:synced', { source: 'firebase-license-fallback' });
            }
          } catch (licErr) {
            console.warn('[UserStore] License fallback sync failed:', licErr);
          } finally {
            if (state.userId === targetId) {
              syncedUserId = targetId;
            }
          }
        } finally {
          if (firebaseSyncPromise === syncTask) {
            firebaseSyncPromise = null;
          }
        }
      })();

      firebaseSyncPromise = syncTask;
      await syncTask;
    }

    return getState();
  }

  function updateProfile(updaterFn) {
    const task = updateQueue.then(async () => {
      await ensureFirebaseSynced();

      const uid = state.userId;
      const draft = normalizeProfile(uid, structuredClone(state.profile));
      const next = updaterFn(draft) || draft;
      const normalizedNext = normalizeProfile(uid, next);
      normalizedNext.userId = uid;
      normalizedNext.updatedAt = Date.now();

      state.profile = normalizedNext;
      saveToLocal(uid, state.profile);
      emit('profile:updated');

      if (dbRefFactory && dbOps && !isLocalOnlyUser(uid)) {
        try {
          const userRef = dbRefFactory(`users/${uid}/profile`);
          await dbOps.set(userRef, state.profile);
        } catch (err) {
          console.error('[UserStore] Firebase users write failed:', err);
        }

        if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.database === 'function') {
          try {
            await window.firebase.database().ref(`licenses/${uid}`).update(
              buildLicenseMirrorPayload(state.profile)
            );
          } catch (err) {
            console.error('[UserStore] Firebase licenses mirror write failed:', err);
          }
        }
      }

      return getState();
    });

    updateQueue = task.catch(() => {});
    return task;
  }

  // 重置單波連續取分累積（例如開始新回合或分批 10 題重啟時可呼叫）
  async function resetStreakPoints() {
    return updateProfile((profile) => {
      profile.streakPoints = 0;
    });
  }

  // 切換全站主題（同步更新 localStorage、Firebase 與跨分頁）
  async function setTheme(themeId) {
    const nextTheme = normalizeTheme(themeId);
    localStorage.setItem(THEME_KEY, nextTheme);
    state.profile.theme = nextTheme;
    syncThemeToDOM(nextTheme);

    await updateProfile((profile) => {
      profile.theme = nextTheme;
    });

    emit('theme:updated', { theme: nextTheme });
    return nextTheme;
  }

  // 共用練習結算函式：
  // 寫法 1（依動態規則自動算點）：recordPracticeResult('reading', { correctCount: 8, level: 'elem3' })
  // 寫法 2（直接傳固定點數）：recordPracticeResult('cloze', 50)
  async function recordPracticeResult(moduleName, scoreOrOptions = 10, opts = {}) {
    await ensureFirebaseSynced();

    const validKey = ['vocabulary', 'reading', 'cloze', 'clozeReading', 'sentences'].includes(moduleName)
      ? moduleName
      : 'vocabulary';

    let rawPoints = 0;
    let answeredCount = 0;

    if (typeof scoreOrOptions === 'object' && scoreOrOptions !== null) {
      const { correctCount = 0, level, minPoints = 0 } = scoreOrOptions;
      answeredCount = Math.max(0, Number(correctCount) || 0);
      rawPoints = Math.max(minPoints, calcPracticePoints(validKey, answeredCount, { level }));
    } else {
      rawPoints = Math.max(0, Number(scoreOrOptions) || 0);
    }

    const cap = Math.max(0, Number(getRule('streak_point_cap', 200)) || 200);
    let actualEarned = rawPoints;

    await updateProfile((profile) => {
      const baseStreak = opts.resetStreakBefore ? 0 : Number(profile.streakPoints || 0);
      const remainingCap = Math.max(0, cap - baseStreak);
      actualEarned = Math.min(rawPoints, remainingCap);

      profile.points = Number(profile.points || 0) + actualEarned;
      profile.streakPoints = baseStreak + actualEarned;

      profile.practiceStats[validKey] = Number(profile.practiceStats[validKey] || 0) + 1;
      profile.practiceStats.totalCount = Number(profile.practiceStats.totalCount || 0) + 1;

      if (validKey === 'reading' || validKey === 'clozeReading') {
        profile.questionStats.reading = Number(profile.questionStats.reading || 0) + 1;
      } else if (validKey in profile.questionStats) {
        profile.questionStats[validKey] = Number(profile.questionStats[validKey] || 0) + answeredCount;
      }
    });

    return {
      earnedPoints: actualEarned,
      rawPoints,
      capped: actualEarned < rawPoints,
      state: getState()
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVE_ID_KEY && e.newValue && e.newValue !== state.userId) {
      switchUser(e.newValue);
      return;
    }

    if (e.key === THEME_KEY && e.newValue) {
      const nextTheme = normalizeTheme(e.newValue);
      if (state.profile.theme !== nextTheme) {
        state.profile.theme = nextTheme;
        syncThemeToDOM(nextTheme);
        emit('theme:updated', { theme: nextTheme, source: 'cross-tab' });
      }
      return;
    }

    if (e.key === RULES_CACHE_KEY && e.newValue) {
      try {
        gameRules = { ...DEFAULT_RULES, ...JSON.parse(e.newValue) };
        emit('rules:updated', { rules: { ...gameRules } });
      } catch (err) {
        console.error('[UserStore] Cross-tab rules parse error:', err);
      }
      return;
    }

    if (e.key === getStorageKey(state.userId) && e.newValue) {
      try {
        const incoming = normalizeProfile(state.userId, JSON.parse(e.newValue));
        if ((incoming.updatedAt || 0) >= (state.profile.updatedAt || 0)) {
          state.profile = incoming;
          localStorage.setItem(THEME_KEY, normalizeTheme(state.profile.theme));
          syncThemeToDOM(state.profile.theme);
          emit('profile:synced', { source: 'cross-tab' });
        }
      } catch (err) {
        console.error('[UserStore] Cross-tab parse error:', err);
      }
    }
  });

  function subscribe(callback) {
    tryAutoBindCompatFirebase();
    listeners.add(callback);
    refreshDOM();
    callback('init', getState(), null);
    return () => listeners.delete(callback);
  }

  return {
    DEFAULT_RULES,
    initFirebase,
    getRule,
    getAllRules,
    getTheme,
    setTheme,
    calcPracticePoints,
    resetStreakPoints,
    switchUser,
    updateProfile,
    recordPracticeResult,
    refreshDOM,
    subscribe,
    getState
  };
})();

window.UserStore = UserStore;
window.recordPracticeResult = (moduleName, scoreOrOptions, opts) =>
  UserStore.recordPracticeResult(moduleName, scoreOrOptions, opts);