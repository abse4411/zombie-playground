/* ============================================================
 * RES 资源管理器（v12.1）—— 数据资源文件化 / 异步懒加载 / 缓存驱逐
 * - 核心数据（武器/感染体/特长/成就/索引）启动时异步加载
 * - 地图/任务详情用到才加载（startHunt / startMission / 猎场选择页）
 * - JSON 缓存 LRU：核心组常驻，地图/任务组超过上限自动驱逐（长会话内存平稳）
 * - GPU 资源（几何体/材质/纹理）由 ENGINE.clearMap 与实体对象池负责，本层不管
 * ============================================================ */
const RES = {
  core: {},                 // 核心数据引用（boot 后可直读）
  _cache: new Map(),        // url -> 解析后的 JSON（LRU）
  _loading: new Map(),      // url -> Promise（并发去重）
  _group: new Map(),        // 组名 -> Set<url>
  _order: [],               // LRU 淘汰序（最旧在前）
  MAX_CACHE: 48,            // 非核心 JSON 缓存上限
  stats: { loaded: 0, fetches: 0, evicted: 0 },

  /* ---------- 启动加载：全部核心数据 ---------- */
  async boot(onProgress) {
    const steps = [
      ['weapons.json', '武器数据'],
      ['zombies.json', '感染体数据'],
      ['perks.json', '强化数据'],
      ['achievements.json', '成就数据'],
      ['characters.json', '角色数据'],
      ['missions/index.json', '战役索引'],
      ['maps/index.json', '猎场索引'],
    ];
    let done = 0;
    for (const [file, label] of steps) {
      if (onProgress) onProgress(done / steps.length, label);
      const j = await this._fetch('assets/data/' + file, 'core');
      done++;
    }
    // 装配全局符号（下游代码零改动）
    const w = this._cache.get('assets/data/weapons.json');
    window.WEAPONS = w.weapons;
    window.THROWABLES = w.throwables;
    window.ZOMBIE_TYPES = this._cache.get('assets/data/zombies.json').zombieTypes;
    const pj = this._cache.get('assets/data/perks.json').perks;
    for (const id in pj) pj[id].valName = v => this._fmtVal(pj[id].valT, v);   // 回挂格式化函数
    window.PERKS = pj;
    const aj = this._cache.get('assets/data/achievements.json').achievements;
    for (const a of aj) a.goal = this._makeGoal(a);                             // 回挂目标求值器
    window.ACHIEVEMENTS = aj;
    window.CHARACTERS = this._cache.get('assets/data/characters.json').characters;
    const si = this._cache.get('assets/data/missions/index.json');
    window.CAMPAIGN_INTRO = si.campaignIntro;
    window.MISSIONS = si.missions;
    const mi = this._cache.get('assets/data/maps/index.json').maps;
    // MAPS 装配为「元数据 def」：菜单/下拉用；开局时 RES.loadMap 就地补全完整字段
    window.MAPS = {};
    for (const m of mi) window.MAPS[m.id] = m;
    this._mapIds = mi.map(m => m.id);
    if (onProgress) onProgress(1, '完成');
  },

  /* ---------- 地图 / 任务详情：用到才加载 ---------- */
  async loadMap(id) {
    if (!id || !MAPS[id]) throw new Error('未知地图 ' + id);
    if (MAPS[id].props) return MAPS[id];                       // 已是完整数据
    const def = await this._fetch('assets/data/maps/' + id + '.json', 'map:' + id);
    Object.assign(MAPS[id], def);                              // 元数据就地补全
    return MAPS[id];
  },

  async loadMission(id) {
    if (!id) return null;
    const m = MISSIONS.find(x => x.id === id);
    if (!m) throw new Error('未知任务 ' + id);
    if (m.waves) return m;                                     // 详情已加载
    const detail = await this._fetch('assets/data/missions/' + id + '.json', 'mission:' + id);
    Object.assign(m, detail);
    return m;
  },

  // 预取一批地图（猎场选择页画缩略图用），完成后回调可画
  async preloadMaps(ids, onEach) {
    await Promise.all(ids.map(async id => {
      await this.loadMap(id);
      if (onEach) onEach(id);
    }));
  },

  /* ---------- 缓存管理 ---------- */
  _fetch(url, group) {
    if (this._cache.has(url)) {
      this._touch(url);
      return Promise.resolve(this._cache.get(url));
    }
    let p = this._loading.get(url);
    if (p) return p;
    this.stats.fetches++;
    p = fetch(url + '?v=' + (window.__ASSET_VER || '1'))
      .then(r => { if (!r.ok) throw new Error('资源加载失败 ' + url + ' (' + r.status + ')'); return r.json(); })
      .then(j => {
        this._cache.set(url, j);
        this._loading.delete(url);
        this.stats.loaded++;
        this._touch(url);
        this._evict();
        return j;
      })
      .catch(e => { this._loading.delete(url); throw e; });
    this._loading.set(url, p);
    return p;
  },

  _touch(url) {
    const i = this._order.indexOf(url);
    if (i >= 0) this._order.splice(i, 1);
    this._order.push(url);   // 移到最新
  },

  _evict() {
    while (this._order.length > this.MAX_CACHE) {
      const oldest = this._order[0];
      const isCore = this._coreUrl(oldest);
      if (isCore) {
        // 核心资源永驻：挪到队尾跳过
        this._order.shift(); this._order.push(oldest);
        break;
      }
      this._order.shift();
      this._cache.delete(oldest);
      this.stats.evicted++;
    }
  },

  _coreUrl(url) {
    return !url.includes('/maps/') || url.endsWith('maps/index.json');
  },

  // 手动释放一组缓存（退出对局时对当前地图组调用；JSON 很小，主要保证长会话下限）
  releaseGroup(group) {
    let n = 0;
    for (const [url] of this._cache) {
      if (url === group || this._group.get(group)?.has(url)) { this._cache.delete(url); n++; }
    }
    this._group.delete(group);
    return n;
  },

  /* ---------- 特长/成就 函数回挂 ---------- */
  _fmtVal(t, v) {
    return t
      .replace('{v%}', String(Math.round(v * 100)))
      .replace('{v/100}', String(v / 100))
      .replace('{v}', String(v));
  },

  // 复合统计目标（Proxy 无法表达的）在这里特判
  _SPECIAL_GOALS: {
    visit_all: d => [Object.keys(d.mapDone || {}).length, 9],
    spinoff_all: d => [Object.keys(d.spinoffsDone || {}).length, 3],
    rating_all_s: d => [Object.values(d.bestRating || {}).filter(r => r === 'S').length, 10],
  },

  _makeGoal(a) {
    if (this._SPECIAL_GOALS[a.id]) return this._SPECIAL_GOALS[a.id];
    if (a.goal && a.goal.stat !== undefined) {
      const stat = a.goal.stat, target = a.goal.target;
      return d => [Math.min(d[stat] || 0, target), target];
    }
    return () => [0, 1];
  },
};

/* 角色查找辅助（v12.1 随数据外置从 characters.js 移入；CHARACTERS 由 RES.boot 装配） */
function getCharacter(id) {
  const list = window.CHARACTERS || [];
  return list.find(c => c.id === id) || list[0] || null;
}
