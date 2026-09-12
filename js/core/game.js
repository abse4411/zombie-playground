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

  startMission(idx, skipIntro) {
    this._lastStart = { type: 'mission', idx };
    const m = MISSIONS[idx];
    // 战役继承：仅当从上一章胜利接续时生效
    this._pendingCarry = (SAVE.data.carry && SAVE.data.carry.nextIdx === idx) ? SAVE.data.carry : null;
    this._begin(m.map, () => new EncounterMode(this, idx, skipIntro));
  }

  // 应用上一章继承：武器/装备/金钱 + 全补给（v3.1）
  _applyCarry(c) {
    const p = this.player;
    p.money = c.money;
    p.perks = Object.assign({ hp: 0, armor: 0, speed: 0, ammo: 0, reload: 0, ap: 0, regen: 0 }, c.perks);
    p.recomputePerks();
    p.armor = p.maxArmor;
    p.hp = p.maxHp;
    for (const slot of ['primary', 'secondary', 'melee']) {
      const w = c.weapons[slot];
      if (w && WEAPONS[w.id]) {
        const inst = new WeaponInstance(WEAPONS[w.id]);
        inst.lvl = w.lvl || 0;
        inst.mag = inst.magSize;   // 弹匣自动补满
        inst.reserve = Math.floor(inst.def.reserve * p.reserveMult);  // 备弹自动补满
        p.weapons[slot] = inst;
      }
    }
    if (c.throwables !== undefined || c.frag !== undefined) {
      p.throwables.frag.count = c.frag;
      p.throwables.molotov.count = c.molo;
    }
    p.current = c.current || 'secondary';
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
    this.weather = { kind: 'clear', t: rand(35, 60) };
    this.runStats = { damageTaken: 0, fragKills: 0 };
    // 可破坏物布置（每局重新生成）
    if (typeof spawnDestructibles !== 'undefined') spawnDestructibles(this);
    // 探索补给箱
    if (typeof spawnSupplyCrates !== 'undefined') spawnSupplyCrates(this);
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
    if (!locked && this.state === 'playing' && !SHOPUI.isOpen && !STORY.active) {
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

    if (this.state === 'playing' && !STORY.active && !SHOPUI.isOpen) {
      this._update(sdt);
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
    const cam = ENGINE.camera;
    cam.position.set(p.pos.x, p.pos.y + GAMECONFIG.player.eyeHeight, p.pos.z);
    cam.rotation.set(p.pitch, p.yaw, 0);
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
      }
    }
    // 清理尸体
    for (let i = zs.length - 1; i >= 0; i--) {
      if (zs[i].remove) { zs[i].dispose(); zs.splice(i, 1); }
    }

    // 投掷物与区域
    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter(pr => !pr.dead);
    for (const f of this.fireZones) f.update(dt, this);
    this.fireZones = this.fireZones.filter(f => !f.dead);
    for (const a of this.acidPools) a.update(dt, this);
    this.acidPools = this.acidPools.filter(a => !a.dead);

    // 掉落物
    for (const l of this.loots) l.update(dt, this);
    this.loots = this.loots.filter(l => !l.dead);

    // 补给箱靠近提示与开启（自动开启式探索）
    this.interactText = null;
    if (this.crates) {
      for (const c of this.crates) {
        if (c.opened) continue;
        const d = dist2d(c.x, c.z, p.pos.x, p.pos.z);
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

    // 补给区交互
    this.interactText = null;
    const bz = ENGINE.mapDef.buyZone;
    const inZone = dist2d(p.pos.x, p.pos.z, bz.x, bz.z) < bz.r;
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
    if (headshot) p.headshots++;
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
