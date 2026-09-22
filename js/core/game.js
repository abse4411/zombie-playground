/* ============================================================
 * 游戏主循环 / 状态机
 * 状态：menu → playing ⇄ paused → over / victory
 * 打击感：顿帧(hitstop) + 波次慢镜(slowmo) 时间缩放
 * ============================================================ */
class Game {
  constructor(canvas) {
    ENGINE.init(canvas);
    INPUT.init(canvas);
    PARTICLES.init(ENGINE.scene);

    this.state = 'menu';
    this.player = null;
    this.weapons = null;
    this.spawner = null;
    this.mode = null;
    this.zombies = [];
    this.projectiles = [];
    this.fireZones = []; this.gasClouds = [];
    this.acidPools = [];
    this.loots = [];
    this.destructibles = [];
    this.deployments = [];   // 支援道具实体（轰炸/空投/无人机/哨戒，v16.3）
    this.stats = { shots: 0, hits: 0 };
    this.interactText = null;
    this._last = performance.now();
    this._growlT = 2;
    this._beatT = 0;
    this._lastStart = null;
    this.hitstopT = 0;
    this.slowmoT = 0;
    this.killStreak = 0;
    this.streakT = 0;
    this._fireCount = 0;
    this._fragWindowT = 0;

    // 点击画面重新锁定鼠标（触屏设备不需要）
    canvas.addEventListener('click', () => {
      if (!INPUT.touch && this.state === 'playing' && !INPUT.locked && !SHOPUI.isOpen && !STORY.active) {
        INPUT.requestLock();
      }
    });

    // 防误触关闭（v7.1）：对局中按 Ctrl+W 关闭标签页前弹出确认，避免整局丢失。
    // 注：浏览器保留级快捷键（Ctrl+W）页面无法完全拦截，此确认弹窗是可靠兜底。
    window.addEventListener('beforeunload', (e) => {
      if (this.state === 'playing' || this.state === 'paused') {
        e.preventDefault();
        e.returnValue = '对局进行中，离开将丢失本局进度！';
        return e.returnValue;
      }
    });

    this._loop = this._loop.bind(this);
  }

  start() {
    requestAnimationFrame(this._loop);
    // Web Worker 时钟兜底：后台标签/最小化时以25fps继续驱动（联机房主切屏不掉线）
    try {
      const code = 'let id=null;onmessage=e=>{if(e.data==="start"&&!id)id=setInterval(()=>postMessage(1),40);if(e.data==="stop"&&id){clearInterval(id);id=null}};';
      this._worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      this._worker.onmessage = () => {
        // rAF 饥饿（后台标签/最小化/被节流）时由 Worker 兜底驱动
        if (this.state === 'playing' && performance.now() - this._last > 66) this._frame(performance.now());
      };
      this._worker.postMessage('start');
    } catch (e) { /* Worker 不可用则忽略 */ }
  }

  /* ================= 开局 ================= */
  async startHunt(mapId, diffKey, restore) {
    this._lastStart = { type: 'hunt', mapId, diffKey };
    this._pendingRestore = restore || null;
    if (!(await this._loadFor(mapId, '正在进入猎场…'))) { this._pendingRestore = null; return; }
    this._begin(mapId, () => new HuntMode(this, mapId, diffKey));
  }

  async startMission(idx, skipIntro, diffKey) {
    this._lastStart = { type: 'mission', idx, diffKey: diffKey || 'normal' };
    const m = MISSIONS[idx];
    if (!(await this._loadFor(m.map, '正在部署任务…', m.id))) return;
    // 战役继承：仅当从上一章胜利接续时生效（噩梦不可继承——难度自担）
    this._pendingCarry = (diffKey === 'nightmare') ? null
      : ((SAVE.data.carry && SAVE.data.carry.nextIdx === idx) ? SAVE.data.carry : null);
    this._missionDiff = diffKey || 'normal';
    this._begin(m.map, () => new EncounterMode(this, idx, skipIntro));
  }

  // 开局前懒加载：地图完整数据 + 任务详情（v12.1 资源文件化），带防重入与加载遮罩
  async _loadFor(mapId, tip, missionId) {
    if (this._loadingGame) return false;
    this._loadingGame = true;
    this.showLoading(tip);
    try {
      await RES.loadMap(mapId);
      if (missionId) await RES.loadMission(missionId);
      // 让加载遮罩至少渲染一帧，避免场景构建造成画面冻结感；
      // 后台标签 rAF 会被节流 —— 300ms 超时兜底防止永久挂起（v12.1）
      await new Promise(r => {
        let done = false;
        const fin = () => { if (!done) { done = true; r(); } };
        requestAnimationFrame(() => requestAnimationFrame(fin));
        setTimeout(fin, 300);
      });
      return true;
    } catch (e) {
      console.error(e);
      HUD.toast('✖ 资源加载失败：' + (e.message || e));
      return false;
    } finally {
      this._loadingGame = false;
      this.hideLoading();
    }
  }

  // 加载遮罩（v12.1）
  showLoading(tip) {
    let el = document.getElementById('load-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'load-overlay';
      el.innerHTML = '<div class="load-inner"><div class="load-spin"></div><div id="load-tip"></div></div>';
      document.body.appendChild(el);
    }
    el.querySelector('#load-tip').textContent = tip || '加载中…';
    el.classList.remove('hidden');
  }

  hideLoading() {
    const el = document.getElementById('load-overlay');
    if (el) el.classList.add('hidden');
  }

  /* ---------- 狩猎保存/继续（v14.3） ---------- */
  // 波次间歇或手动保存时快照；恢复时重打保存的那一波（刷怪重置，玩家进度全保留）
  // 角色专属针剂写回存档（v21.0）
  syncCharPerks() {
    if (!this.player || !this.player.charStats) return;
    if (!SAVE.data.charPerks) SAVE.data.charPerks = {};
    SAVE.data.charPerks[this.player.charStats.id] = Object.assign({}, this.player.perks);
    SAVE.commit();
  }

  captureHuntSave() {
    const g = this, p = g.player, m = g.mode;
    if (!p || !m || m.constructor.name !== 'HuntMode') return null;
    const serW = inst => ({ id: inst.def.id, lvl: inst.lvl || 0, up: inst.upgrades || {}, mag: inst.mag, reserve: inst.reserve });
    const s = {
      v: 1, map: m.mapId, diff: m.diffKey,
      wave: m.state === 'combat' ? m.wave : m.wave + 1,   // 战斗中退出→重打当前波
      at: Date.now(),
      player: {
        x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw,
        hp: p.hp, armor: p.armor, maxArmor: p.maxArmor, money: p.money,
        kills: p.kills, headshots: p.headshots, moneyEarned: p.moneyEarned,
        perks: Object.assign({}, p.perks), medkits: p.medkits, medkitHeal: p.medkitHeal,
        xp: p.xp, xpNext: p.xpNext, level: p.level, rogueLevels: Object.assign({}, p.rogueLevels || {}),
        items: Object.assign({}, p.items), slotMax: Object.assign({}, p.slotMax),
        throwables: { frag: p.throwables.frag.count, molotov: p.throwables.molotov.count, attractor: p.throwables.attractor.count, impact: p.throwables.impact.count },
        stamina: p.stamina,
        current: p.current,
        rack: {
          primary: p.rack.primary.map(serW),
          secondary: p.rack.secondary.map(serW),
          melee: p.rack.melee.map(serW),
        },
        storage: p.storage.map(it => it && it.kind === 'weapon' ? { kind: 'weapon', w: serW(it.inst) } : Object.assign({}, it)),
      },
    };
    SAVE.data.huntSave = s;
    SAVE.commit();
    return s;
  }

  clearHuntSave() {
    if (SAVE.data.huntSave) { delete SAVE.data.huntSave; SAVE.commit(); }
    if (typeof MENU !== 'undefined') MENU.refreshContinue();
  }

  continueHunt() {
    const s = SAVE.data && SAVE.data.huntSave;
    if (!s) { HUD.toast('没有可继续的狩猎存档'); return; }
    this.startHunt(s.map, s.diff, s);
  }

  saveQuitHunt() {
    const s = this.captureHuntSave();
    this.quitToMenu();
    if (s) HUD.toast(`📂 狩猎进度已保存（第 ${s.wave} 波）`);
  }

  _applyHuntRestore(sv) {
    const p = this.player;
    const build = w => {
      if (!WEAPONS[w.id]) return null;
      const inst = new WeaponInstance(WEAPONS[w.id]);
      inst.lvl = w.lvl || 0;
      inst.upgrades = w.up || {};
      inst.mag = Math.max(0, Math.min(w.mag, inst.magSize));
      inst.reserve = Math.max(0, w.reserve);
      return inst;
    };
    // 武器架与手持
    const rack = {};
    for (const slot of ['primary', 'secondary', 'melee']) {
      rack[slot] = (sv.player.rack[slot] || []).map(build).filter(Boolean);
      if (!rack[slot].length && WEAPONS[slot === 'primary' ? 'm4a1' : slot === 'secondary' ? 'p92' : 'knife']) {
        rack[slot] = [new WeaponInstance(WEAPONS[slot === 'primary' ? 'm4a1' : slot === 'secondary' ? 'p92' : 'knife'])];
      }
    }
    p.rack = rack;
    p.weapons = { primary: rack.primary[0] || null, secondary: rack.secondary[0] || null, melee: rack.melee[0] || null };
    const cur = sv.player.current;
    // 恢复时存档侧已补默认武器，'fist' 不保留（虚拟槽仅投掷/道具直接恢复）
    if (cur === 'throw' || cur === 'item') p.current = cur;
    else p.current = (p.weapons[cur]) ? cur : (['secondary', 'primary', 'melee'].find(sl => p.weapons[sl]) || 'secondary');
    // 仓库
    p.storage = (sv.player.storage || []).map(it => it && it.kind === 'weapon'
      ? { kind: 'weapon', inst: build(it.w) }
      : it).filter(it => it && (it.kind !== 'weapon' || it.inst));
    // 数值
    p.hp = Math.min(Math.max(1, sv.player.hp), p.maxHp);
    p.maxArmor = sv.player.maxArmor || 0;
    p.armor = sv.player.armor || 0;
    p.money = sv.player.money;
    p.kills = sv.player.kills || 0;
    p.headshots = sv.player.headshots || 0;
    p.moneyEarned = sv.player.moneyEarned || 0;
    p.perks = Object.assign(zeroPerks(), sv.player.perks || {});
    this.syncCharPerks();   // v21.0：恢复后把局内针剂等级写回角色档
    p.medkits = sv.player.medkits;
    if (sv.player.medkitHeal) p.medkitHeal = sv.player.medkitHeal;
    // 道具与栏位（v18.1）
    p.items = Object.assign({ armorplate: 0, adrenaline: 0 }, sv.player.items || {});
    p.slotMax = Object.assign({ primary: 2, secondary: 1, melee: 1 }, sv.player.slotMax || {});
    p.adrenalineT = 0;
    p.throwables.frag.count = sv.player.throwables.frag;
    p.throwables.molotov.count = sv.player.throwables.molotov;
    p.throwables.attractor.count = sv.player.throwables.attractor;
    if (sv.player.throwables.impact !== undefined) p.throwables.impact.count = sv.player.throwables.impact;
    p.recomputePerks();
    // 等级与局内强化重放（v20.6：经验等级/三选一强化/连携全部还原；必须在 recomputePerks 之后，否则铁壁等对 maxHp 的加成会被覆盖）
    p.level = sv.player.level || 1;
    p.xpNext = sv.player.xpNext || 10;
    p.xp = sv.player.xp || 0;
    p.rogueLevels = Object.assign({}, sv.player.rogueLevels || {});
    for (const pid in p.rogueLevels) {
      const k = typeof ROGUE_PERKS !== 'undefined' && ROGUE_PERKS.find(x => x.id === pid);
      if (k) for (let i = 0; i < p.rogueLevels[pid]; i++) k.apply(p);
    }
    if (typeof SYNERGY !== 'undefined') SYNERGY.check(this);
    p.hp = Math.min(Math.max(1, sv.player.hp), p.maxHp);
    p.stamina = Math.min(sv.player.stamina !== undefined ? sv.player.stamina : p.maxStamina, p.maxStamina);
    p.pos.set(sv.player.x, sv.player.y, sv.player.z);
    p.yaw = sv.player.yaw || 0;
    // 波次：恢复为"重打保存的那一波"
    const m = this.mode;
    m.wave = Math.max(0, sv.wave - 1);
    m.state = 'intermission';
    m.timer = GAMECONFIG.hunt.startCountdown;
    this.weapons._buildViewmodel();
    HUD.banner(`📂 进度已恢复 · 第 ${sv.wave} 波`, '装备与资金已还原 —— 整备好再迎战');
    SAVE.data.huntSave = sv;   // 恢复后保留存档（下次退出再次覆盖）
  }

  // 应用上一章继承：武器/装备/金钱 + 全补给（v3.1）
  _applyCarry(c) {
    const p = this.player;
    p.money = c.money;
    // 以全量 PERKS 键为基底（v5.4 新增的 tough/scavenger 在旧存档里不存在，undefined 会崩商店）
    p.perks = Object.assign(zeroPerks(), c.perks || {});
    p.recomputePerks();
    p.armor = p.maxArmor;
    p.hp = p.maxHp;
    for (const slot of ['primary', 'secondary', 'melee']) {
      const list = c.weapons && c.weapons[slot];
      p.rack[slot] = [];
      p.weapons[slot] = null;
      if (Array.isArray(list)) {
        for (const w of list) {
          if (!w || !WEAPONS[w.id]) continue;
          const inst = new WeaponInstance(WEAPONS[w.id]);
          inst.lvl = w.lvl || 0;
          inst.mag = inst.magSize;
          inst.reserve = Math.floor(inst.def.reserve * p.reserveMult);
          p.rack[slot].push(inst);
          if (!p.weapons[slot]) p.weapons[slot] = inst;
        }
      }
      if (!p.weapons[slot] && p.rack[slot].length) p.weapons[slot] = p.rack[slot][0];
    }
    // 兜底：继承数据引用的武器全部失效（跨版本旧存档）时补默认配枪
    const FALLBACK_IDS = { primary: 'm4a1', secondary: 'p92', melee: 'knife' };
    for (const slot of ['primary', 'secondary', 'melee']) {
      if (!p.weapons[slot] && WEAPONS[FALLBACK_IDS[slot]]) {
        const inst = new WeaponInstance(WEAPONS[FALLBACK_IDS[slot]]);
        inst.mag = inst.magSize;
        inst.reserve = Math.floor(inst.def.reserve * p.reserveMult);
        p.weapons[slot] = inst;
        p.rack[slot].push(inst);
      }
    }
    if (c.throwables !== undefined || c.frag !== undefined) {
      p.throwables.frag.count = c.frag;
      p.throwables.molotov.count = c.molo;
    }
    p.current = (c.current && p.weapons[c.current]) ? c.current : 'secondary';
    if (!p.weapons[p.current]) p.current = ['secondary', 'melee', 'primary'].find(s => p.weapons[s]);
    // 继承武器超容裁剪（v18.1）：上一章扩容的栏位不带出，超出部分退背包/折现
    for (const slot of ['primary', 'secondary', 'melee']) {
      while (p.rack[slot].length > (p.slotMax ? p.slotMax[slot] : 2)) {
        const drop = p.rack[slot].pop();
        if (p.weapons[slot] === drop) p.weapons[slot] = p.rack[slot][p.rack[slot].length - 1] || null;
        if (!p.storageAdd({ kind: 'weapon', inst: drop })) {
          p.money += Math.round((drop.def.price || 300) * 0.35);
        }
      }
      if (!p.weapons[slot] && p.rack[slot].length) p.weapons[slot] = p.rack[slot][0];
    }
    this.weapons._buildViewmodel();
    HUD.toast('📦 战役继承：装备 / 弹药 / 生命 已全部补满');
  }

  startTutorial() {
    this._lastStart = { type: 'tutorial' };
    (async () => {
      if (!(await this._loadFor('park', '正在准备教学…'))) return;
      this._begin('park', () => new TutorialMode(this));
    })();
  }

  _begin(mapId, makeMode) {
    AUDIO.init(); AUDIO.resume();
    // 清空残留输入（防止重开局时鼠标/按键仍被视为按住）
    INPUT.keys = {}; INPUT.lmb = false; INPUT.rmb = false;
    INPUT.lmbEdge = false; INPUT.dx = 0; INPUT.dy = 0; INPUT.wheel = 0;
    this._cleanupWorld();
    const mapDef = MAPS[mapId];
    ENGINE.buildMap(mapDef);
    ENGINE.scene.add(ENGINE.camera);
    this.player = new Player();
    this.player.spawnAt(mapDef);
    this.weapons = new WeaponSystem(this.player);
    this.spawner = new SpawnSystem(this);
    this.deployments = [];
    this.mode = makeMode();
    this.stats = { shots: 0, hits: 0 };
    this._growlT = 2; this._beatT = 0;
    this.hitstopT = 0; this.slowmoT = 0;
    this.killStreak = 0; this.streakT = 0;
    this._fireCount = 0; this._fragWindowT = 0;
    this._lootTipShown = false;
    this._buyCount = 0; this._throwCount = 0; this._meleeKillCount = 0; this._flawlessCount = 0;
    this._lastMapId = mapId; this._lastWin = false;
    if (typeof ACHV !== 'undefined' && ACHV.event('runBegin', this) === undefined) { /* 事件位 */ }
    this.weather = { kind: 'clear', t: rand(35, 60) };
    this.runStats = { damageTaken: 0, fragKills: 0 };
    if (typeof STORY !== 'undefined') STORY.cancel();   // 防上一局残留对话冻结新对局
    // 第一人称身体（低头可见）
    this.playerBody = buildPlayerBody(CHARACTER_BODY_COLORS[SAVE.data.character || 'raven']);
    ENGINE.scene.add(this.playerBody.group);
    // 可破坏物布置（每局重新生成）
    if (typeof spawnDestructibles !== 'undefined') spawnDestructibles(this);
    // 探索补给箱
    if (typeof spawnSupplyCrates !== 'undefined') spawnSupplyCrates(this);
    // 尸巢（v10.3 往日不再）
    if (typeof NESTS !== 'undefined') NESTS.spawnFor(this);
    // 成就专属武器注入（v8.4）
    if (SAVE.data.unlockedWeapons && SAVE.data.unlockedWeapons.length) {
      const _p = this.player;
      for (const wid of SAVE.data.unlockedWeapons) {
        if (!WEAPONS[wid]) continue;
        const slot = WEAPONS[wid].slot;
        if (!_p.rack[slot].some(r => r.def.id === wid)) {
          const inst = new WeaponInstance(WEAPONS[wid]);
          inst.mag = inst.magSize;
          inst.reserve = Math.floor(inst.def.reserve * _p.reserveMult);
          _p.rack[slot].push(inst);
          if (!_p.weapons[slot]) { _p.weapons[slot] = inst; if (_p.current === 'secondary' && slot === 'primary') _p.current = 'primary'; }
        }
      }
      if (this.weapons) this.weapons._buildViewmodel();
    }
    // 元进度永久强化（v10.8）
    if (typeof META !== 'undefined') META.apply(this.player);
    // 成就酬金发放（v8.2奖励）
    if (SAVE.data.bonusMoney > 0) { this.player.money += SAVE.data.bonusMoney; HUD.toast(`🏆 成就酬金 +$${SAVE.data.bonusMoney}`); SAVE.data.bonusMoney = 0; }
    // 角色属性（v6.2）；强化针剂按角色独立载入（v21.0：各角色等级互不共享、跨局持久）
    const ch = getCharacter(SAVE.data.character || 'raven');
    this.player.charStats = ch;
    this.player.perks = Object.assign(zeroPerks(), (SAVE.data.charPerks || {})[ch.id] || {});
    this.player.recomputePerks();
    this.player.maxHp = ch.hp + (this.player.perks.hp > 0 ? PERKS.hp.tiers[this.player.perks.hp - 1].val : 0);
    this.player.hp = this.player.maxHp;
    if (ch.armorStart > 0) { this.player.maxArmor = Math.max(this.player.maxArmor, ch.armorStart); this.player.armor = ch.armorStart; }
    this.player.medkits = ch.medkits;
    this.player.medkitHeal = ch.medkitHeal || GAMECONFIG.inventory.medkitHeal;
    // 武器栏位容量（v18.1）：按角色 slots 配置（商城扩容为局内升级，重开会重置为角色基准）
    this.player.slotMax = Object.assign({ primary: 2, secondary: 1, melee: 1 }, ch.slots || {});
    if (!this.player.items) this.player.items = { armorplate: 0, adrenaline: 0 };
    else this.player.items = Object.assign({ armorplate: 0, adrenaline: 0 }, this.player.items);
    this.player.itemSel = 'medkit';
    this.player.adrenalineT = 0;
    // 角色差异化体力（v13.2）：recomputePerks 已按 charStats 计算，出生回满
    this.player.stamina = this.player.maxStamina;
    // 解锁角色被动（v8.3）
    if (ch.passive) {
      const pv = ch.passive;
      this.player.explodeMult = pv.explodeMult || 1;
      if (pv.throwMaxBonus) this.player.throwMaxBonus = pv.throwMaxBonus;
      if (pv.fragFull) { this.player.throwables.frag.count = THROWABLES.frag.max; this.player.throwables.molotov.count = Math.min(THROWABLES.molotov.max, THROWABLES.molotov.max); }
      if (pv.scopePenaltyHalf) this.player.scopePenaltyHalf = true;
      if (pv.startWeapon && WEAPONS[pv.startWeapon] && !this.player.rack.primary.some(r => r.def.id === pv.startWeapon)) {
        const inst = new WeaponInstance(WEAPONS[pv.startWeapon]);
        inst.mag = inst.magSize;
        inst.reserve = Math.floor(inst.def.reserve * this.player.reserveMult);
        this.player.rack.primary.push(inst);
        this.player.weapons.primary = inst;
        this.player.current = 'primary';
        if (this.weapons) this.weapons._buildViewmodel();
      }
    } else {
      this.player.explodeMult = 1;
      this.player.throwMaxBonus = 0;
      this.player.scopePenaltyHalf = false;
    }
    // 各槽超容裁剪（v18.1）：被动开局武器/继承武器可能超出角色槽数，退背包或折现
    for (const slot of ['primary', 'secondary', 'melee']) {
      const rack = this.player.rack[slot];
      while (rack.length > this.player.slotMax[slot]) {
        const drop = rack.pop();
        if (this.player.weapons[slot] === drop) this.player.weapons[slot] = rack[rack.length - 1] || null;
        if (!this.player.storageAdd({ kind: 'weapon', inst: drop })) {
          const val = Math.round((drop.def.price || 300) * 0.35);
          this.player.money += val;
          HUD.toast(`💼 ${drop.def.name} 已折现 $${val}（栏位不足）`);
        }
      }
      if (!this.player.weapons[slot] && rack.length) this.player.weapons[slot] = rack[0];
    }
    // 战役继承（在剧情对话前应用）
    if (this._pendingCarry) { this._applyCarry(this._pendingCarry); this._pendingCarry = null; }
    // 狩猎进度恢复（v14.3：在角色/继承之后最后应用，覆盖装备与波次）
    if (this._pendingRestore && this.mode && this.mode.constructor.name === 'HuntMode') {
      this._applyHuntRestore(this._pendingRestore);
    }
    this._pendingRestore = null;
    // 联机：标记在局
    if (typeof NET !== 'undefined' && NET.role !== 'off') NET.inGame = true;
    this.state = 'playing';
    MENU.hideAll();
    HUD.show();
    this.mode.start();
    AUDIO.startAmbient();
    AUDIO.startMusic();
    AUDIO.startWind(ENGINE.mapDef.id === 'base' ? 1.6 : 1);   // 极地基地风声更强
    AUDIO.stopFireLoop();
    AUDIO.stopRainLoop();
    if (!STORY.active) this.requestLock();
  }

  onStoryDone() {
    if (this.state === 'playing') this.requestLock();
  }

  requestLock() { if (!INPUT.touch) INPUT.requestLock(); }

  onPointerLockChange(locked) {
    // UI面板（商店/背包/剧情）打开时的解锁不视为暂停
    const uiOpen = SHOPUI.isOpen || STORY.active || (typeof BACKPACK !== 'undefined' && BACKPACK.isOpen);
    if (!locked && !uiOpen && this.state === 'playing') {
      this.pause();
    }
  }

  /* ================= 打击感 ================= */
  hitstop(d) { this.hitstopT = Math.max(this.hitstopT, d); }
  slowmo(d) { this.slowmoT = Math.max(this.slowmoT, d); }

  // 触屏 / 低配模式的刷怪上限乘区
  get capMult() {
    return ENGINE.quality.capMult * (INPUT.touch ? 0.72 : 1);
  }

  // 血月等天气的丧尸强化
  get weatherMult() {
    return this.weather && this.weather.kind === 'blood'
      ? { hp: 1.3, speed: 1.1, reward: 1.5 } : null;
  }

  _weatherTick(dt) {
    const w = this.weather;
    if (!w) return;
    w.t -= dt;
    if (w.kind === 'rain') {
      PARTICLES.rainStep(this.player.pos.x, this.player.pos.z, Math.round(16 * ENGINE.quality.particleMult));
    }
    if (w.t > 0) return;
    const roll = Math.random();
    let next = 'clear';
    if (roll < 0.16) next = 'fog';
    else if (roll < 0.36) next = 'rain';
    else if (roll < 0.54 && this.mode instanceof HuntMode && (this.mode.wave || 0) >= 3) next = 'blood';
    this._setWeather(next);
  }

  _setWeather(kind) {
    this.weather.kind = kind;
    this.weather.t = kind === 'blood' ? 42 : rand(30, 55);
    ENGINE.applyWeather(kind);
    if (kind === 'rain') { AUDIO.startRainLoop(); HUD.toast('🌧 暴雨来临'); }
    else AUDIO.stopRainLoop();
    if (kind === 'fog') HUD.toast('🌫 浓雾弥漫，小心视野盲区');
    if (kind === 'blood') { HUD.banner('🌕 血月升起', '感染体狂化：更强，但赏金 +50%'); AUDIO.hordeHorn(); }
  }

  onBossSpawned(z) {
    this.boss = z;
    HUD.showBossBar(z.displayName);
    ENGINE.shake(0.3);
  }

  onPlayerDamaged() {
    this.killStreak = 0;
    this.streakT = 0;
    if (this.runStats) this.runStats.damageTaken++;
  }

  /* ================= 主循环 ================= */
  _loop(t) {
    requestAnimationFrame(this._loop);
    this._frame(t);
  }

  /* 帧驱动（rAF + Worker时钟兜底共用）：后台标签/切屏时联机模拟不中断 */
  _frame(t) {
    if (t - this._last < 5) return;   // 去重：rAF与Worker双驱动
    // 帧率上限（移动端省电）：按渲染时间戳节流
    const cap = SAVE.data.settings.fpsCap;
    if (cap > 0 && t - (this._lastRender || 0) < 1000 / cap - 2) return;
    const rawDt = (t - this._last) / 1000;
    this._last = t;
    if (cap > 0) this._lastRender = t;
    ENGINE.tickFps(rawDt);

    const dt = clamp(rawDt, 0, 0.05);
    let ts = 1;
    if (this.hitstopT > 0) { this.hitstopT -= rawDt; ts = 0.02; }
    else if (this.slowmoT > 0) { this.slowmoT -= rawDt; ts = GAMECONFIG.feel.slowmoScale; }
    const sdt = dt * ts;

    ENGINE.update(sdt);
    STORY.update(dt);

    if (this.state === 'playing' && !STORY.active && !SHOPUI.isOpen && !(typeof BACKPACK !== 'undefined' && BACKPACK.isOpen) && !(typeof LEVELUP !== 'undefined' && LEVELUP.isOpen)) {
      this._update(sdt);
    }
    // Tab 背包开关
    if (this.state === 'playing' && !SHOPUI.isOpen && !STORY.active && typeof BACKPACK !== 'undefined' && INPUT.justPressed('Tab')) {
      BACKPACK.toggle(this);
    }
    ENGINE.render();
    if (typeof TOUCH !== 'undefined') TOUCH.sync();
    INPUT.endFrame();
  }

  _update(dt) {
    const p = this.player;

    // 玩家 & 武器
    if (p.alive) {
      p.update(dt, this);
      this.weapons.update(dt, this);
    }

    // 相机跟随 + 镜头抖动
    // 相机Y独立平滑：上台阶时物理Y瞬跳会造成镜头猛抖（v6.9修复），
    // 大幅位移（跳跃/坠落/重生）直接跟随，台阶小幅变化快速收敛
    const cam = ENGINE.camera;
    if (this._camY === undefined || !p.onGround || Math.abs(p.pos.y - this._camY) > 1.2) this._camY = p.pos.y;
    else this._camY += (p.pos.y - this._camY) * Math.min(1, 13 * dt);
    cam.position.set(p.pos.x, this._camY + GAMECONFIG.player.eyeHeight, p.pos.z);
    cam.rotation.set(p.pitch, p.yaw, 0);
    // 动作相机语言（v8.7）：踢腿后仰下沉/翻滚侧倾/近战横摆
    const pb = this.playerBody;
    if (pb && pb.actT > 0) {
      const D = pb.actDur || 0.3, k = 1 - pb.actT / D, pulse = Math.sin(clamp(k, 0, 1) * Math.PI);
      if (pb.action === 'kick') { cam.position.y -= 0.06 * pulse; cam.rotation.x -= 0.05 * pulse; }
      else if (pb.action === 'dash') cam.rotation.z += (pb.actDir || 1) * 0.06 * pulse;
      else if (pb.action === 'swing') { cam.position.x += Math.sin(p.yaw + Math.PI / 2) * 0.05 * pulse; cam.position.z += Math.cos(p.yaw + Math.PI / 2) * 0.05 * pulse; }
      else if (pb.action === 'throw') cam.rotation.x += 0.04 * pulse;
    }
    if (ENGINE.shakeAmt > 0) {
      cam.position.x += rand(-1, 1) * ENGINE.shakeAmt * 0.25;
      cam.position.y += rand(-1, 1) * ENGINE.shakeAmt * 0.25;
      cam.rotation.z = rand(-1, 1) * ENGINE.shakeAmt * 0.05;
    } else {
      cam.rotation.z = 0;
    }

    // 丧尸更新
    for (const z of this.zombies) z.update(dt, this);
    // 丧尸间分离
    const zs = this.zombies;
    for (let i = 0; i < zs.length; i++) {
      const a = zs[i];
      if (a.dead || a.state === 'rise') continue;
      for (let j = i + 1; j < zs.length; j++) {
        const b = zs[j];
        if (b.dead || b.state === 'rise') continue;
        let dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        const min = 0.72 * (a.type.scale + b.type.scale);
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (min - d) / d * 0.5;
          dx *= push; dz *= push;
          a.pos.x -= dx; a.pos.z -= dz;
          b.pos.x += dx; b.pos.z += dz;
        }
      }
    }
    // 玩家 vs 丧尸防穿模：圆体互相推挤（丧尸让70%，玩家让30%）
    if (p.alive) {
      for (const z of zs) {
        if (z.dead || z.state === 'rise') continue;
        let dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z;
        const d2 = dx * dx + dz * dz;
        const min = 0.42 * (1 + z.type.scale);
        // 仅同层高度才推挤（站高台时不被下层丧尸卡住）
        if (d2 > min * min || d2 < 0.0001 || Math.abs((z.pos.y || 0) - p.pos.y) > 1.2) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        dx *= push; dz *= push;
        p.pos.x += dx * 0.3; p.pos.z += dz * 0.3;
        z.pos.x -= dx * 0.7; z.pos.z -= dz * 0.7;
        // 每次推挤后立即墙体约束：绝不allow玩家中心进入墙体（否则"弹出最近面"会把人弹到墙外侧）
        resolveCircleAABBs(p.pos, GAMECONFIG.player.radius, 1.7, p.pos.y, 0.55);
        resolveCircleAABBs(z.pos, 0.42 * z.type.scale, 1.8 * z.type.scale, z.pos.y || 0, 0.6);
      }
    }
    // 清理尸体（上限12具，超过加速移除最老尸体降低draw call）
    let corpseCount = 0;
    for (let i = zs.length - 1; i >= 0; i--) {
      if (zs[i].dead) corpseCount++;
      if (zs[i].remove) { zs[i].dispose(); zs.splice(i, 1); }
    }
    if (corpseCount > 12) {
      for (const z of zs) { if (z.dead && z.deadT < 1.2) z.deadT = 1.2; }
    }

    // 投掷物与区域
    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter(pr => !pr.dead);
    for (const f of this.fireZones) f.update(dt, this);
    if (typeof BLOODPOOLS !== 'undefined') BLOODPOOLS.update(dt);   // v21.7 血泊渐隐
    this.fireZones = this.fireZones.filter(f => !f.dead);
    for (const a of this.acidPools) a.update(dt, this);
    this.acidPools = this.acidPools.filter(a => !a.dead);

    // 曳光与头顶血条
    if (typeof TRACERS !== 'undefined') TRACERS.update(dt);
    if (typeof GIBS !== 'undefined') GIBS.update(dt);
    if (typeof HPBARS !== 'undefined') { for (const z of zs) if (z.hpbar && !z.dead) HPBARS.update(z); }

    // 尸巢孵化
    if (typeof NESTS !== 'undefined') NESTS.update(dt, this);
    // 经验宝石（v10.6）
    if (typeof XPGEMS !== 'undefined') XPGEMS.update(dt, this);
    // 宝箱（v10.7）
    if (typeof CHESTS !== 'undefined') CHESTS.update(dt, this);
    // 掉落物
    for (const l of this.loots) l.update(dt, this);
    this.loots = this.loots.filter(l => !l.dead);

    // 地面拾取列表 + E键拾取（v18.2）：优先级 拾取 > 补给箱 > 商城
    this._updatePickupList(dt);

    // 支援道具实体（v16.3）：轰炸引导/空投箱/无人机/哨戒塔
    for (const d of this.deployments) d.update(dt, this);
    this.deployments = this.deployments.filter(d => !d.dead);

    // 补给箱靠近提示与开启（自动开启式探索）
    this.interactText = null;
    if (this.crates) {
      for (const c of this.crates) {
        if (c.opened) continue;
        const d = dist2d(c.x, c.z, p.pos.x, p.pos.z);
        c.beam.visible = d < 36;   // 远处隐藏光柱（性能）
        if (d < 3) {
          this.interactText = INPUT.touch ? '走近补给箱自动开启' : '[E] 打开补给箱';
          if (!this._pickupEaten && (INPUT.justPressed('KeyE') || d < 1.2)) c.tryOpen(this);
          break;
        }
      }
    }
    // 火焰环境声
    const fc = this.fireZones.length;
    if (fc > 0 && this._fireCount === 0) AUDIO.startFireLoop();
    if (fc === 0 && this._fireCount > 0) AUDIO.stopFireLoop();
    this._fireCount = fc;

    // 模式信息 + Boss 血条
    if (this.mode) this.mode.update(dt);
    if (this.boss && !this.boss.dead) HUD.updateBossBar(this.boss);

    // 天气系统
    this._weatherTick(dt);

    // 连杀计时
    if (this.streakT > 0) {
      this.streakT -= dt;
      if (this.streakT <= 0) this.killStreak = 0;
    }
    // 手雷击杀归因窗口
    if (this._fragWindowT > 0) this._fragWindowT -= dt;

    // 紧张度分层 + 动态音乐
    const tension = clamp(this.aliveZombies() / 16, 0, 1);
    AUDIO.setTension(tension);
    AUDIO.musicTick(tension);

    // 主角身体同步（低头可见）
    if (this.playerBody) syncPlayerBody(this.playerBody, p, dt);

    // 联机同步
    if (typeof NET !== 'undefined' && NET.active) NET.netTick(dt);

    // 终结镜头 FOV 冲击衰减
    if (this.player.fovPunch > 0) this.player.fovPunch = Math.max(0, this.player.fovPunch - dt * 2.2);

    // 环境音：丧尸低吼
    this._growlT -= dt;
    if (this._growlT <= 0) {
      this._growlT = rand(1.2, 3.4);
      const alive = zs.filter(z => !z.dead && z.state !== 'rise' && !z.dummy);
      if (alive.length) {
        const z = choice(alive);
        AUDIO.growl(dist2d(z.pos.x, z.pos.z, p.pos.x, p.pos.z), z.growlPitch);
      }
    }
    // 低血量心跳
    if (p.alive && p.hp < 30) {
      this._beatT -= dt;
      if (this._beatT <= 0) { this._beatT = 1.05; AUDIO.heartbeat(); }
    }

    // 补给区交互（v9.8 升级为安全屋：屏障挡尸+缓慢回血）
    this.interactText = null;
    const bz = ENGINE.mapDef.buyZone;
    const inZone = dist2d(p.pos.x, p.pos.z, bz.x, bz.z) < bz.r;
    // 安全屋屏障：丧尸被推出圈外（L4D safe room 规则）
    for (const z of this.zombies) {
      if (z.dead || z.boss) continue;
      const dz2 = dist2d(z.pos.x, z.pos.z, bz.x, bz.z);
      if (dz2 < bz.r + 0.3) {
        const push = (bz.r + 0.4 - dz2) / (dz2 || 1);
        z.pos.x += (z.pos.x - bz.x) * push;
        z.pos.z += (z.pos.z - bz.z) * push;
      }
    }
    // 安全屋回血：圈内每秒+3（战斗中躲圈=战术撤退）
    if (inZone && p.alive && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 3 * dt);
    if (p.alive && inZone) this.interactText = (INPUT.touch ? '点击补给站按钮' : '[B] 打开补给站');
    const shopAnywhere = (this.mode instanceof HuntMode && this.mode.state === 'intermission')
      || (this.mode instanceof TutorialMode && this.mode.shopStep);
    // v19.5：补给站统一用 B 键打开（E 专司拾取与补给箱），避免与拾取冲突
    if (p.alive && INPUT.justPressed('KeyB') && (inZone || shopAnywhere)) SHOPUI.open(this);

    // 鼠标锁定提示
    HUD.el.lockHint.classList.toggle('hidden', INPUT.locked || INPUT.touch);

    DMGNUM.update(dt);
    PARTICLES.update(dt);
    HUD.update(this);
  }

  /* ================= 拾取列表（v18.2） ================= */
  _updatePickupList(dt) {
    const p = this.player;
    const rows = [];
    for (const l of this.loots) {
      if (l.dead || l.life <= 0 || l.pickupDelay > 0) continue;
      if (l.autoCollects(this)) continue;   // 自动拾取物不进列表（靠近触碰即收）
      const d = dist2d(l.group.position.x, l.group.position.z, p.pos.x, p.pos.z);
      if (d > 2.6) continue;
      // v21.9：高度门——E 拾取列表同样忽略跨楼层掉落物
      if (Math.abs(p.pos.y - l.group.position.y) > 1.6) continue;
      rows.push({ l, d });
    }
    rows.sort((a, b) => a.d - b.d);
    const top = rows.slice(0, 4);
    this._pickupEaten = false;
    // E 拾取最近的手动物品（武器替换 / 溢出道具入背包）
    if (p.alive && top.length && INPUT.justPressed('KeyE')) {
      for (const r of top) {
        if (r.l.collect(this, true) === 'collected') { this._pickupEaten = true; break; }
      }
    }
    // 列表 UI（拾取后重算本帧列表，避免显示已消失项）
    const shown = this._pickupEaten ? [] : top;
    HUD.renderPickupList(shown.map(r => {
      const cc = r.l.canCollect(this);
      return { name: r.l.name(), rarity: r.l.rarity, ok: cc.ok, reason: cc.reason, nearest: r === top[0] };
    }));
  }

  // 背包条目丢弃到地面（v18.2，背包UI丢弃按钮调用）
  dropStorageEntry(idx) {
    const p = this.player;
    const entry = p.storage[idx];
    if (!entry) return;
    const pos = tossPos(this);
    if (entry.kind === 'weapon' && entry.inst) {
      spawnGroundDrop(this, 'weapon', pos.x, pos.z, {
        inst: entry.inst, rarity: rarityForPrice(entry.inst.def.price), delay: 1.2, toss: true,
      });
      HUD.toast(`🗑 已丢弃 ${entry.inst.def.name}（3秒后可拾回）`);
    } else if (entry.kind === 'item') {
      const n = entry.count || 1;
      for (let i = 0; i < n; i++) {
        spawnGroundDrop(this, entry.itemId, pos.x + rand(-0.4, 0.4), pos.z + rand(-0.4, 0.4), { amount: 1, delay: 1.2, toss: true });
      }
      HUD.toast(`🗑 已丢弃 ${entry.name || entry.itemId} ×${n}`);
    }
    p.storage.splice(idx, 1);
  }

  /* ================= 击杀 / 死亡 / 胜利 ================= */
  onZombieKilled(z, headshot) {
    const p = this.player;
    // Boss 专属补给箱（v10.2 CSOL式：Boss掉物品）
    if (z.boss && z.bossCfg) {
      const roll = Math.random();
      if (roll < 0.4) {
        const cash = randi(1500, 3000);
        this.loots.push(new LootDrop('big', z.pos.x, z.pos.z, cash));
      } else if (roll < 0.7) {
        // 满弹药补给
        for (const slot of ['primary', 'secondary']) {
          for (const inst of p.rack[slot]) { inst.reserve = Math.floor(inst.def.reserve * p.reserveMult); inst.mag = inst.magSize; }
        }
        HUD.toast('📦 Boss补给：全弹药补满！');
      } else {
        const wd = rollWeaponDrop ? rollWeaponDrop() : null;
        if (wd) {
          this.loots.push(new LootDrop('weapon', z.pos.x + 1, z.pos.z, 0, { inst: wd.inst, rarity: Math.min(3, wd.rarity + 1) }));
          HUD.toast('🎁 Boss掉落了稀有武器！');
        }
      }
    }

    // 联机：房主侧队友击杀 → 转发奖励与播报，不计入自己
    if (typeof NET !== 'undefined' && NET.role === 'host' && z._lastHitBy) {
      NET.send({ t: 'ev', k: 'kill', by: z._lastHitBy, name: z.displayName, reward: z.reward, head: !!headshot });
      HUD.killfeed(`🤝 队友击杀 ${z.displayName}`);
      if (z === this.boss) { this.boss = null; HUD.hideBossBar(); this.slowmo(1.0); }
      return;
    }

    p.kills++;
    if (headshot) { p.headshots++; const d = SAVE.data; d.totalHeadshots = (d.totalHeadshots || 0) + 1; }
    if (p.current === 'melee') { this._meleeKillCount++; const d = SAVE.data; d.bestMeleeKills = Math.max(d.bestMeleeKills || 0, this._meleeKillCount); }
    if (this._fragWindowT > 0) { const d = SAVE.data; d.totalFragKills = (d.totalFragKills || 0) + 1; }
    if (z.burnT !== undefined && z.burnT > -99 && z._burnDeath) { const d = SAVE.data; d.totalBurnKills = (d.totalBurnKills || 0) + 1; }
    // 连杀结算（v20.4）：先叠连杀数再算钱——基础赏金已大幅下调，连杀乘区负责补回
    this.streakT = GAMECONFIG.streak.window + (p.streakWinBonus || 0);
    this.killStreak++;
    { const d = SAVE.data; d.bestStreak = Math.max(d.bestStreak || 0, this.killStreak); }
    const streakMult = 1 + Math.min(GAMECONFIG.streak.maxMult + (p.streakCapBonus || 0), this.killStreak * GAMECONFIG.streak.multPerKill);
    const total = Math.round((z.reward + (headshot ? GAMECONFIG.economy.headshotBonus : 0)) * streakMult);
    p.addMoney(total);
    SAVE.data.totalKills++;
    if (p.kills % 25 === 0) SAVE.commit();

    // Boss 击杀
    if (z === this.boss) {
      this.boss = null;
      HUD.hideBossBar();
      this.slowmo(1.0);
      p.fovPunch = 1;
      HUD.toast(`☠ ${z.displayName} 已被击倒！ 赏金 +$${total}`);
      AUDIO.victory();
    }

    // 连杀播报 + 里程碑爆赏（v20.4：10/25/50/100 节点额外奖金）
    if (this.killStreak >= 3) HUD.streak(this.killStreak, streakMult);
    for (const ms of GAMECONFIG.streak.milestones) {
      if (this.killStreak === ms.at) {
        const amt = Math.round(ms.amount * (p.cashMult || 1));
        p.addMoney(amt);
        HUD.toast(`🏆 ${ms.at} 连杀里程碑！奖金 +$${amt}`);
        AUDIO.streak();
      }
    }

    // 手雷击杀统计（挑战任务用）
    if (this._fragWindowT > 0 && this.runStats) this.runStats.fragKills++;

    // 成就检测
    if (typeof ACHV !== 'undefined') {
      ACHV.event('kill', this, p.current === 'melee' ? 'melee' : null);
      if (z === this.boss && !z._isMini) ACHV.event('boss', this);   // 小Boss不计入幕末Boss成就（v15.3）
    }

    // 顿帧（爆头击杀更狠）
    this.hitstop(headshot ? GAMECONFIG.feel.hitstopHeadKill : GAMECONFIG.feel.hitstopKill);

    // 近距离血溅屏幕
    const d = dist2d(z.pos.x, z.pos.z, p.pos.x, p.pos.z);
    if (d < 4.5) HUD.bloodSplat();

    HUD.killfeed(`${headshot ? '☠ 爆头击杀' : '击杀'} ${z.displayName} +$${total}`, headshot ? 'head' : '');
  }

  playerDied() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    AUDIO.defeat();
    AUDIO.stopAmbient();
    AUDIO.stopMusic();
    AUDIO.stopFireLoop();
    AUDIO.stopRainLoop();
    AUDIO.stopWind();
    INPUT.releaseLock();
    if (typeof NET !== 'undefined') NET.reportDead();
    const mode = this.mode;
    const isMission = mode instanceof EncounterMode;
    setTimeout(() => {
      if (this.state !== 'over') return;
      document.getElementById('over-title').textContent = isMission ? '任务失败' : '你被尸潮吞没了';
      document.getElementById('over-sub').textContent = isMission
        ? MISSIONS[mode.idx].name + ' · 黎明会会记住你的牺牲'
        : '黎明会会记住你的牺牲';
      document.getElementById('over-stats').innerHTML =
        mode.resultStats().map(([k, v, cls]) =>
          `<div class="stat-cell"><div class="st-label">${k}</div><div class="st-val ${cls}">${v}</div></div>`).join('');
      HUD.hide();
      HUD.setScope(false);
      MENU.show('screen-over');
      MENU.refreshStats();
      SAVE.commit();
    }, 1300);
  }

  showVictory(idx) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = 'victory';
    this._lastWin = true;
    if (typeof ACHV !== 'undefined') ACHV.event('runEnd', this);
    if (typeof META !== 'undefined') META.award(this);
    AUDIO.victory();
    AUDIO.stopAmbient();
    AUDIO.stopFireLoop();
    INPUT.releaseLock();
    const mode = this.mode;
    document.getElementById('victory-story').textContent =
      MISSIONS[idx].outro.map(l => `${l.s}：「${l.t}」`).join('\n\n');
    document.getElementById('victory-stats').innerHTML =
      mode.resultStats().map(([k, v, cls]) =>
        `<div class="stat-cell"><div class="st-label">${k}</div><div class="st-val ${cls}">${v}</div></div>`).join('');
    document.getElementById('btn-vic-next').classList.toggle('hidden', idx + 1 >= MISSIONS.length);
    HUD.hide();
    HUD.setScope(false);
    MENU.show('screen-victory');
    MENU.refreshStats();
    SAVE.commit();
  }

  /* ================= 暂停 / 重开 / 退出 ================= */
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    INPUT.releaseLock();
    AUDIO.stopAmbient();
    AUDIO.stopMusic();
    AUDIO.stopWind();
    MENU.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    MENU.hideAll();
    AUDIO.startAmbient();
    this.requestLock();
  }

  restart() {
    if (!this._lastStart) return this.quitToMenu();
    if (this._lastStart.type === 'hunt') this.clearHuntSave();   // 重新开始=放弃旧进度（v14.3）
    this.state = 'playing';
    if (this._lastStart.type === 'hunt') {
      this.startHunt(this._lastStart.mapId, this._lastStart.diffKey);
    } else if (this._lastStart.type === 'tutorial') {
      this.startTutorial();
    } else {
      this.startMission(this._lastStart.idx, true);
    }
  }

  quitToMenu() {
    if ((this.state === 'playing' || this.state === 'paused') && this.player) {
      if (typeof ACHV !== 'undefined') ACHV.event('runEnd', this);
      if (typeof META !== 'undefined') META.award(this);
    }
    this.state = 'menu';
    this._cleanupWorld();
    ENGINE.clearMap();
    HUD.hide();
    HUD.setScope(false);
    AUDIO.stopAmbient();
    AUDIO.stopMusic();
    AUDIO.stopFireLoop();
    AUDIO.stopRainLoop();
    AUDIO.stopWind();
    INPUT.releaseLock();
    if (typeof NET !== 'undefined' && NET.role !== 'off') { NET.inGame = false; MENU.refreshNetUI(); }
    if (typeof STORY !== 'undefined') STORY.cancel();
    MENU.show('screen-menu');
    if (typeof MENU.refreshContinue === 'function') MENU.refreshContinue();
    MENU.refreshStats();
  }

  /* ---------- 联机开局（房主广播后双方调用） ---------- */
  startNetGame(data) {
    if (typeof NET !== 'undefined') NET.inGame = true;
    if (data.mode === 'mission') this.startMission(data.missionIdx || 0, true);
    else this.startHunt(data.map || 'park', data.diff || 'normal');
  }

  _cleanupWorld() {
    const veil = document.getElementById('dark-veil');
    if (veil) veil.classList.add('hidden');   // v21.3：换局移除血月视野限制
    for (const z of this.zombies) z.dispose();
    this.zombies = [];
    this.boss = null;   // 清除Boss引用（防残留引用跨局污染血条，v15.4）
    HUD.hideBossBar();
    if (typeof clearZombiePool === 'function') clearZombiePool();   // 释放模型池 GPU 资源（v12.1）
    for (const pr of this.projectiles) pr._finish(this);
    this.projectiles = [];
    for (const f of this.fireZones) { disposeObject3D(f.mesh); ENGINE.scene.remove(f.mesh); }
    for (const a of this.acidPools) { disposeObject3D(a.mesh); ENGINE.scene.remove(a.mesh); }
    this.fireZones = []; this.gasClouds = []; this.acidPools = [];
    for (const l of this.loots) l.dispose();
    this.loots = [];
    for (const d of this.deployments) d.dispose();   // 支援实体释放（v16.3）
    this.deployments = [];
    for (const d of this.destructibles) if (!d.dead) d.dispose();
    this.destructibles = [];
    if (this.playerBody) {
      disposeObject3D(this.playerBody.group);   // 身体几何体逐局新建，退局释放（v12.1）
      ENGINE.scene.remove(this.playerBody.group);
      this.playerBody = null;
    }
    if (typeof NESTS !== 'undefined') NESTS.clear(this);
    if (typeof XPGEMS !== 'undefined') XPGEMS.clear();
    if (typeof CHESTS !== 'undefined') CHESTS.clear();
    if (typeof BLOODPOOLS !== 'undefined') BLOODPOOLS.clear();
    if (this.crates) for (const c of this.crates) c.dispose();
    this.crates = [];
    if (this.weapons) { this.weapons._disposeViewmodel(); this.weapons.disposeFx(); }
    this.player = null; this.weapons = null; this.mode = null;
    this.interactText = null;
  }

  aliveZombies() {
    let n = 0;
    for (const z of this.zombies) if (!z.dead) n++;
    return n;
  }
  // 波次判定用：排除尸潮/兽群等场外事件尸（v20.6——事件尸不再卡死波次推进）
  aliveWaveZombies() {
    let n = 0;
    for (const z of this.zombies) if (!z.dead && !z._horde) n++;
    return n;
  }
}
