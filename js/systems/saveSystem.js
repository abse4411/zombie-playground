/* ============================================================
 * 存档系统 —— localStorage 持久化
 * ============================================================ */
const SAVE = {
  key: 'zg_zombie_playground_v1',
  data: null,

  defaults() {
    return {
      settings: { sens: 1, volume: 0.8, quality: 'auto', touchSens: 1, fpsCap: 0, autoReload: true, scopeSens: 0.7, autoPickup: true },
      missionsDone: 0,
      totalKills: 0,
      totalRuns: 0,
      tutorialDone: false,
      bestWave: {},           // mapId -> 最深波次
      huntBest: { wave: 0, kills: 0 },
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      this.data = raw ? Object.assign(this.defaults(), JSON.parse(raw)) : this.defaults();
    } catch (e) {
      this.data = this.defaults();
    }
  },

  commit() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { }
  },

  recordHunt(mapId, wave, kills) {
    const b = this.data.bestWave;
    if (!b[mapId] || wave > b[mapId]) b[mapId] = wave;
    if (wave > this.data.huntBest.wave) {
      this.data.huntBest = { wave, kills: Math.max(this.data.huntBest.kills || 0, kills) };
    }
    this.commit();
  },

  completeMission(idx) {
    if (idx + 1 > this.data.missionsDone) {
      this.data.missionsDone = idx + 1;
      this.commit();
    }
  },

  /* ---------- 存档迁移（v2.9） ---------- */
  export() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  },

  import(code) {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj.settings === undefined) throw new Error('格式无效');
    this.data = Object.assign(this.defaults(), obj);
    this.commit();
    return true;
  },
};
