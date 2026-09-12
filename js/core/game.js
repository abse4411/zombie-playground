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
    this.fireZones = [];
    this.acidPools = [];
    this.loots = [];
    this.destructibles = [];
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
  startHunt(mapId, diffKey) {
    this._lastStart = { type: 'hunt', mapId, diffKey };
    this._begin(mapId, () => new HuntMode(this, mapId, diffKey));
  }

  startMission(idx, skipIntro, diffKey) {
    this._lastStart = { type: 'mission', idx, diffKey: diffKey || 'normal' };
    const m = MISSIONS[idx];
    // 战役继承：仅当从上一章胜利接续时生效（噩梦不可继承——难度自担）
    this._pendingCarry = (diffKey === 'nightmare') ? null
      : ((SAVE.data.carry && SAVE.data.carry.nextIdx === idx) ? SAVE.data.carry : null);
    this._missionDiff = diffKey || 'normal';
    this._begin(m.map, () => new EncounterMode(this, idx, skipIntro));
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
    this.weapons._buildViewmodel();
    HUD.toast('📦 战役继承：装备 / 弹药 / 生命 已全部补满');
  }

  startTutorial() {
    this._lastStart = { type: 'tutorial' };
    this._begin('park', () => new TutorialMode(this));
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
    // 成就酬金发放（v8.2奖励）
    if (SAVE.data.bonusMoney > 0) { this.player.money += SAVE.data.bonusMoney; HUD.toast(`🏆 成就酬金 +$${SAVE.data.bonusMoney}`); SAVE.data.bonusMoney = 0; }
    // 角色属性（v6.2）
    const ch = getCharacter(SAVE.data.character || 'raven');
    this.player.charStats = ch;
    this.player.recomputePerks();
    this.player.maxHp = ch.hp + (this.player.perks.hp > 0 ? PERKS.hp.tiers[this.player.perks.hp - 1].val : 0);
    this.player.hp = this.player.maxHp;
    if (ch.armorStart > 0) { this.player.maxArmor = Math.max(this.player.maxArmor, ch.armorStart); this.player.armor = ch.armorStart; }
    this.player.medkits = ch.medkits;
    this.player.medkitHeal = ch.medkitHeal || GAMECONFIG.inventory.medkitHeal;
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
    // 战役继承（在剧情对话前应用）
    if (this._pendingCarry) { this._applyCarry(this._pendingCarry); this._pendingCarry = null; }
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

    if (this.state === 'playing' && !STORY.active && !SHOPUI.isOpen && !(typeof BACKPACK !== 'undefined' && BACKPACK.isOpen)) {
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
    this.fireZones = this.fireZones.filter(f => !f.dead);
    for (const a of this.acidPools) a.update(dt, this);
    this.acidPools = this.acidPools.filter(a => !a.dead);

    // 曳光与头顶血条
    if (typeof TRACERS !== 'undefined') TRACERS.update(dt);
    if (typeof GIBS !== 'undefined') GIBS.update(dt);
    if (typeof HPBARS !== 'undefined') { for (const z of zs) if (z.hpbar && !z.dead) HPBARS.update(z); }

    // 掉落物
    for (const l of this.loots) l.update(dt, this);
    this.loots = this.loots.filter(l => !l.dead);

    // 补给箱靠近提示与开启（自动开启式探索）
    this.interactText = null;
    if (this.crates) {
      for (const c of this.crates) {
        if (c.opened) continue;
        const d = dist2d(c.x, c.z, p.pos.x, p.pos.z);
        c.beam.visible = d < 36;   // 远处隐藏光柱（性能）
        if (d < 3) {
          this.interactText = INPUT.touch ? '走近补给箱自动开启' : '[E] 打开补给箱';
          if (INPUT.justPressed('KeyE') || d < 1.2) c.tryOpen(this);
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
    if (p.alive && inZone) this.interactText = (INPUT.touch ? '点击补给站按钮' : '[E] 打开补给站');
    const shopAnywhere = (this.mode instanceof HuntMode && this.mode.state === 'intermission')
      || (this.mode instanceof TutorialMode && this.mode.shopStep);
    if (p.alive && INPUT.justPressed('KeyE') && inZone) SHOPUI.open(this);
    else if (p.alive && INPUT.justPressed('KeyB') && (inZone || shopAnywhere)) SHOPUI.open(this);

    // 鼠标锁定提示
    HUD.el.lockHint.classList.toggle('hidden', INPUT.locked || INPUT.touch);

    DMGNUM.update(dt);
    PARTICLES.update(dt);
    HUD.update(this);
  }

  /* ================= 击杀 / 死亡 / 胜利 ================= */
  onZombieKilled(z, headshot) {
    const p = this.player;

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
    const total = z.reward + (headshot ? GAMECONFIG.economy.headshotBonus : 0);
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

    // 连杀
    this.streakT = GAMECONFIG.streak.window;
    this.killStreak++;
    { const d = SAVE.data; d.bestStreak = Math.max(d.bestStreak || 0, this.killStreak); }
    if (this.killStreak >= 3) HUD.streak(this.killStreak);
    if (this.killStreak % GAMECONFIG.streak.bonusEvery === 0) {
      p.addMoney(GAMECONFIG.streak.bonusAmount);
      HUD.toast(`🔥 ${this.killStreak} 连杀！奖金 +$${GAMECONFIG.streak.bonusAmount}`);
      AUDIO.streak();
    }

    // 手雷击杀统计（挑战任务用）
    if (this._fragWindowT > 0 && this.runStats) this.runStats.fragKills++;

    // 成就检测
    if (typeof ACHV !== 'undefined') {
      ACHV.event('kill', this, p.current === 'melee' ? 'melee' : null);
      if (z === this.boss) ACHV.event('boss', this);
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
    if (this.state === 'playing' || this.state === 'paused') {
      if (typeof ACHV !== 'undefined') ACHV.event('runEnd', this);
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
    MENU.refreshStats();
  }

  /* ---------- 联机开局（房主广播后双方调用） ---------- */
  startNetGame(data) {
    if (typeof NET !== 'undefined') NET.inGame = true;
    if (data.mode === 'mission') this.startMission(data.missionIdx || 0, true);
    else this.startHunt(data.map || 'park', data.diff || 'normal');
  }

  _cleanupWorld() {
    for (const z of this.zombies) z.dispose();
    this.zombies = [];
    for (const pr of this.projectiles) pr._finish(this);
    this.projectiles = [];
    for (const f of this.fireZones) ENGINE.scene.remove(f.mesh);
    for (const a of this.acidPools) ENGINE.scene.remove(a.mesh);
    this.fireZones = []; this.acidPools = [];
    for (const l of this.loots) l.dispose();
    this.loots = [];
    for (const d of this.destructibles) if (!d.dead) d.dispose();
    this.destructibles = [];
    if (this.playerBody) { ENGINE.scene.remove(this.playerBody.group); this.playerBody = null; }
    if (this.crates) for (const c of this.crates) c.dispose();
    this.crates = [];
    if (this.weapons) this.weapons._disposeViewmodel();
    this.player = null; this.weapons = null; this.mode = null;
    this.interactText = null;
  }

  aliveZombies() {
    let n = 0;
    for (const z of this.zombies) if (!z.dead) n++;
    return n;
  }
}
