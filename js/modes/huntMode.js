/* ============================================================
 * 狩猎模式 —— 无尽波次，活到死为止
 * ============================================================ */
class HuntMode {
  constructor(game, mapId, diffKey) {
    this.game = game;
    this.mapId = mapId;
    this.diffKey = diffKey;
    this.diff = DIFFICULTIES[diffKey];
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
      // 尸潮突袭：成群奔跑者涌来
      const n = Math.round(GAMECONFIG.director.hordeBase + this.wave * GAMECONFIG.director.hordePerWave);
      const list = [];
      for (let i = 0; i < n; i++) list.push(Math.random() < 0.6 ? 'runner' : 'walker');
      g.spawner.queue.push(...list);
      g.spawner.active = true;
      HUD.banner('⚠ 尸潮突袭', '它们从四面八方涌来！');
      AUDIO.hordeHorn();
    } else if (roll < 0.75) {
      // 空投资金
      const amt = GAMECONFIG.director.airdropMoney;
      g.player.addMoney(amt);
      HUD.toast(`📦 黎明会空投补给 +$${amt}`);
      AUDIO.purchase();
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
        SAVE.recordHunt(this.mapId, this.wave, g.player.kills);
      }
    } else {
      this._directorTick(dt);
      g.spawner.update(dt);
      if (g.spawner.exhausted() && g.aliveZombies() === 0) {
        const bonus = GAMECONFIG.economy.waveBonusBase + GAMECONFIG.economy.waveBonusPerWave * this.wave;
        g.player.addMoney(bonus);
        HUD.killfeed(`第 ${this.wave} 波清除 · 奖励 +$${bonus}`, 'big');
        HUD.toast(`第 ${this.wave} 波已清除，休整片刻 —— [B] 打开补给站`);
        AUDIO.waveClear();
        g.slowmo(GAMECONFIG.feel.slowmoWave);   // 清场慢镜
        g.player.fovPunch = 0.7;                // 终结镜头
        this.state = 'intermission';
        this.timer = GAMECONFIG.hunt.intermission;
        // 波间小回复
        g.player.hp = Math.min(g.player.maxHp, g.player.hp + 15);
        SAVE.recordHunt(this.mapId, this.wave, g.player.kills);
      }
    }
  }

  getTopInfo() {
    const g = this.game;
    if (this.state === 'intermission') {
      return {
        wave: `休整 ${Math.ceil(this.timer)}s`,
        objective: `下一波：第 ${this.wave + 1} 波 · [B] 随时打开补给站`,
      };
    }
    return {
      wave: `第 ${this.wave} 波`,
      objective: `剩余丧尸 ≈ ${g.aliveZombies() + g.spawner.remaining()} · 尽可能多地击杀`,
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
