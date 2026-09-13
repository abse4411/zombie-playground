/* ============================================================
 * 狩猎模式 —— 无尽波次，活到死为止
 * ============================================================ */
class HuntMode {
  constructor(game, mapId, diffKey) {
    this.game = game;
    this.mapId = mapId;
    this.diffKey = diffKey;
    this.diff = DIFFICULTIES[diffKey] || DIFFICULTIES.normal;
    this.wave = 0;
    this.state = 'intermission';
    this.timer = GAMECONFIG.hunt.startCountdown;
    // 导演系统（World War Z 式随机事件）
    this.directorT = rand(GAMECONFIG.director.minDelay, GAMECONFIG.director.maxDelay);
  }

  start() {
    HUD.banner('准备迎敌', `难度：${this.diff.name} · [B] 打开补给站`);
    SAVE.data.totalRuns++;
    SAVE.commit();
  }

  /* ---------- 导演事件 ---------- */
  _directorTick(dt) {
    const g = this.game;
    if (this.state !== 'combat') return;
    this.directorT -= dt;
    if (this.directorT > 0) return;
    this.directorT = rand(GAMECONFIG.director.minDelay, GAMECONFIG.director.maxDelay);
    const roll = Math.random();
    if (roll < 0.5 && g.aliveZombies() < g.spawner.cap * 0.7) {
      if (this.wave >= 5 && Math.random() < 0.4) {
        // 尸潮爆发（v16.2）：警报后一次性环形合围
        g.spawner.hordeBurst(GAMECONFIG.hordeBurst.baseN + this.wave * GAMECONFIG.hordeBurst.perWave);
      } else {
        // 尸潮突袭：成群奔跑者涌来
        const n = Math.round(GAMECONFIG.director.hordeBase + this.wave * GAMECONFIG.director.hordePerWave);
        const list = [];
        for (let i = 0; i < n; i++) list.push(Math.random() < 0.6 ? 'runner' : 'walker');
        g.spawner.queue.push(...list);
        g.spawner.active = true;
        HUD.banner('⚠ 尸潮突袭', '它们从四面八方涌来！');
        AUDIO.hordeHorn();
      }
    } else if (roll < 0.75) {
      // 空投资金
      const amt = GAMECONFIG.director.airdropMoney;
      g.player.addMoney(amt);
      HUD.toast(`📦 黎明会空投补给 +$${amt}`);
      AUDIO.purchase();
    } else if (roll < 0.9 && this.wave >= 5 && !g.zombies.some(z => z.mini && !z.dead)) {
      // 小Boss事件（v15.4）：场上没有存活小Boss时随机空降一个
      const roster = GAMECONFIG.minibossRoster || [];
      if (roster.length) g.spawner.spawnMiniboss(choice(roster));
    } else {
      // 精英提前登场
      const type = choice(GAMECONFIG.director.eliteTypes);
      if (ZOMBIE_TYPES[type].minWave <= this.wave + 3) {
        g.spawner.spawnOne(type);
        HUD.killfeed(`⚠ 感染体异常活动：${ZOMBIE_TYPES[type].name} 出现！`, 'big');
        AUDIO.scream(0);
      }
    }
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.wave++;
        g.spawner.setHuntWave(this.wave, this.diff);
        // 变异情景（v16.1）：第3波起每波60%抽取，持续整波（风险=回报配对）
        this.scenario = null; this._mutBonus = 0;
        if (this.wave >= 3 && Math.random() < 0.6) {
          const S = choice(GAMECONFIG.scenarios);
          this.scenario = S;
          this._mutBonus = S.mutate || 0;
          const m2 = g.spawner.mults;
          if (S.hp) m2.hp *= S.hp;
          if (S.speed) m2.speed = Math.min(GAMECONFIG.hunt.maxSpeedMult * 1.25, m2.speed * S.speed);
          if (S.dmg) m2.dmg *= S.dmg;
          if (S.reward) m2.reward *= S.reward;
          if (S.cap) g.spawner.cap = Math.min(GAMECONFIG.hunt.maxCap, Math.round(g.spawner.cap * S.cap));
          if (S.interval) g.spawner.interval = Math.max(GAMECONFIG.hunt.spawnIntervalMin, g.spawner.interval * S.interval);
          const self2 = this;
          setTimeout(() => {
            const g3 = window.GAME;
            if (!g3 || g3.state !== 'playing' || g3.mode !== self2) return;
            HUD.banner(S.icon + ' 变异情景 · ' + S.name, S.desc);
            AUDIO.hordeHorn();
            if (S.burst) g3.spawner.hordeBurst(GAMECONFIG.hordeBurst.baseN + this.wave * GAMECONFIG.hordeBurst.perWave * 0.7);
          }, 1400);
        }
        this.state = 'combat';
        // Boss 波：每5波暴君Ω登场
        if (this.wave % GAMECONFIG.boss.everyWaves === 0) {
          HUD.banner(`第 ${this.wave} 波 · BOSS`, '暴君 Ω 挡在你们面前');
          const b = g.spawner.spawnOne('brute', undefined, undefined, { boss: true });
          if (b && g.onBossSpawned) g.onBossSpawned(b);
        } else {
          HUD.banner(`第 ${this.wave} 波`, '它们来了');
        }
        AUDIO.waveHorn();
        // 波次无伤检测标记（完美防御成就）
        this._waveDmgMark = g.runStats ? g.runStats.damageTaken : 0;
        SAVE.recordHunt(this.mapId, this.wave, g.player.kills);
        if (typeof ACHV !== 'undefined') ACHV.event('wave', g, this.wave);
        // 小Boss（v15.4）：第4波起每3波轮换登场（延迟2.5s让玩家先接敌）
        // 猎王领地情景（v16.1）：从第4波起每2波必出
        const miniByScenario = this.scenario && this.scenario.miniAtWave && this.wave >= this.scenario.miniAtWave && this.wave % 2 === 0;
        if (GAMECONFIG.minibossRoster && ((this.wave >= 4 && (this.wave - 4) % 3 === 0) || miniByScenario)) {
          const roster = GAMECONFIG.minibossRoster;
          // v20.1：小Boss数量随波次上升——4~11波1个，12~19波2个，20+波3个，错峰登场
          const count = Math.min(3, 1 + Math.floor(this.wave / 8));
          const self = this;
          for (let i = 0; i < count; i++) {
            const mbId = roster[(Math.floor(this.wave / 3) + i) % roster.length];
            setTimeout(() => {
              const g2 = window.GAME;
              if (!g2 || g2.state !== 'playing' || g2.mode !== self || !g2.spawner) return;
              g2.spawner.spawnMiniboss(mbId);
            }, 2500 + i * 1600);
          }
        }
      }
    } else {
      this._directorTick(dt);
      g.spawner.directorTick(dt);   // L4D三态导演+尸潮事件（v9.8）
      g.spawner.update(dt);
      if (g.spawner.exhausted() && g.aliveWaveZombies() === 0) {
        // 场外事件尸（尸潮/兽群迁徙）随波次结束退场——不占击杀、不给奖励（v20.6）
        const retreat = [];
        for (const zb of g.zombies) {
          if (!zb.dead && zb._horde) retreat.push(zb);
        }
        for (const zb of retreat) {
          zb.dead = true;
          PARTICLES.spawn('smoke', zb.pos.x, 1.0, zb.pos.z, 6, { speed: 1.2, life: 0.6, color: [0.4, 0.4, 0.4], color2: [0.2, 0.2, 0.2] });
          if (zb.group) { disposeObject3D(zb.group); ENGINE.scene.remove(zb.group); zb.group = null; }
        }
        if (retreat.length) HUD.toast('🌫 尸潮散去——剩余感染体随波次退场');
        const bonus = GAMECONFIG.economy.waveBonusBase + GAMECONFIG.economy.waveBonusPerWave * this.wave;
        g.player.addMoney(bonus);
        HUD.killfeed(`第 ${this.wave} 波清除 · 奖励 +$${bonus}`, 'big');
        HUD.toast(`第 ${this.wave} 波已清除，休整片刻 —— [B] 打开补给站`);
        AUDIO.waveClear();
        g.slowmo(GAMECONFIG.feel.slowmoWave);   // 清场慢镜
        g.player.fovPunch = 0.7;                // 终结镜头
        this.state = 'intermission';
        this.timer = GAMECONFIG.hunt.intermission;
        g.captureHuntSave();   // 波次间歇自动存档（v14.3）
        // 波间小回复
        g.player.hp = Math.min(g.player.maxHp, g.player.hp + 15);
        if (typeof ACHV !== 'undefined' && g.runStats.damageTaken === this._waveDmgMark) ACHV.event('flawless', g);
        SAVE.recordHunt(this.mapId, this.wave, g.player.kills);
      }
    }
  }

  getTopInfo() {
    const g = this.game;
    const scTxt = this.scenario ? ` ${this.scenario.icon}${this.scenario.name}` : '';
    if (this.state === 'intermission') {
      return {
        wave: `休整 ${Math.ceil(this.timer)}s`,
        objective: `下一波：第 ${this.wave + 1} 波 · [B] 随时打开补给站`,
      };
    }
    return {
      wave: `第 ${this.wave} 波${scTxt}`,
      objective: `剩余丧尸 ≈ ${g.aliveWaveZombies() + g.spawner.remaining()} · 尽可能多地击杀`,
    };
  }

  resultStats() {
    const g = this.game, p = g.player;
    return [
      ['存活波次', `${this.wave}`, 'gold'],
      ['总击杀', `${p.kills}`, 'red'],
      ['爆头击杀', `${p.headshots}`, ''],
      ['命中率', g.stats.shots ? Math.round(g.stats.hits / g.stats.shots * 100) + '%' : '—', ''],
      ['赚取资金', fmtMoney(p.moneyEarned), 'gold'],
      ['历史最佳', `第 ${SAVE.data.huntBest.wave || '—'} 波`, ''],
    ];
  }
}
