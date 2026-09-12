/* ============================================================
 * 刷怪系统 —— 狩猎波次预算 / 遭遇战波次队列
 * ============================================================ */
class SpawnSystem {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.pool = [];
    this.budget = 0;
    this.cap = 10;
    this.interval = 2;
    this.timer = 0;
    this.mults = { hp: 1, speed: 1, dmg: 1, reward: 1 };
    this.active = false;
  }

  reset() {
    this.queue = []; this.pool = []; this.budget = 0;
    this.active = false; this.timer = 0;
    this.mults = { hp: 1, speed: 1, dmg: 1, reward: 1 };
  }

  /* 狩猎模式：按波次配置预算与成长 */
  setHuntWave(wave, diff) {
    const H = GAMECONFIG.hunt;
    this.budget = H.baseBudget + H.budgetPerWave * (wave - 1);
    this.cap = Math.min(H.maxCap, H.baseCap + H.capPerWave * (wave - 1));
    this.interval = Math.max(H.spawnIntervalMin, H.spawnIntervalStart + H.spawnIntervalPerWave * (wave - 1));
    this.timer = 0.6;
    this.mults = {
      hp: diff.hp * (1 + H.hpPerWave * (wave - 1)),
      speed: Math.min(H.maxSpeedMult, diff.speed * (1 + H.speedPerWave * (wave - 1))),
      dmg: diff.dmg,
      reward: diff.reward,
    };
    this.pool = [];
    const mapId = ENGINE.mapDef.id;
    for (const id in ZOMBIE_TYPES) {
      const z = ZOMBIE_TYPES[id];
      if (z.minWave > wave) continue;
      if (z.parkOnly && mapId !== 'park') continue;
      this.pool.push({ id, weight: z.weight });
    }
    this.active = true;
  }

  /* 遭遇战：投放波次编队 */
  addComposition(comp) {
    const list = [];
    for (const id in comp) {
      for (let i = 0; i < comp[id]; i++) list.push(id);
    }
    // 洗牌
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.queue.push(...list);
    this.active = true;
  }

  setMults(m) { this.mults = m; }

  remaining() {
    let r = this.queue.length;
    if (this.budget > 0) r += Math.ceil(this.budget / 1.6);
    return r;
  }

  exhausted() { return this.queue.length === 0 && this.budget <= 0; }

  update(dt) {
    if (!this.active) return;
    if (typeof NET !== 'undefined' && NET.role === 'client') return;   // 联机客户端不由本地刷怪
    this.timer -= dt;
    if (this.timer > 0) return;
    const cap = Math.max(3, Math.floor(this.cap * (this.game.capMult || 1)));
    if (this.game.aliveZombies() >= cap) { this.timer = 0.35; return; }

    let typeId = null;
    if (this.queue.length) {
      typeId = this.queue.pop();
    } else if (this.budget > 0) {
      const pick = weightedPick(this.pool);
      typeId = pick.id;
      this.budget -= ZOMBIE_TYPES[typeId].cost;
    }
    if (!typeId) { this.active = false; return; }

    this.spawnOne(typeId);
    this.timer = this.interval * rand(0.6, 1.4);
  }

  spawnOne(typeId, x, z, opts = {}) {
    if (typeof NET !== 'undefined' && NET.role === 'client') return null;  // 客户端怪物由房主同步
    let sx = x, sz = z;
    if (sx === undefined) {
      const pts = ENGINE.mapDef.spawns;
      const p = this.game.player.pos;
      const far = pts.filter(s => dist2d(s.x, s.z, p.x, p.z) > 15);
      const use = far.length ? choice(far) : choice(pts);
      sx = use.x + rand(-2.5, 2.5);
      sz = use.z + rand(-2.5, 2.5);
    }
    // 变异感染体判定（v6.9）：概率随章节进度与波次递增（14%基础 → 上限45%）
    const wv = this.game.mode.wave !== undefined ? this.game.mode.wave : (this.game.mode.wavePtr || 0);
    const chapter = this.game.mode.idx || 0;
    if (!opts.boss && !opts.dummy && ZOMBIE_TYPES[typeId].cost < 10 && wv >= 4) {
      const mutChance = Math.min(0.45, GAMECONFIG.elites.chance + wv * 0.012 + chapter * 0.03);
      if (Math.random() < mutChance) opts.affix = choice(GAMECONFIG.elites.list);
    }
    const zb = new Zombie(typeId, sx, sz, this.mults, opts);
    // 血月强化
    const wm = this.game.weatherMult;
    if (wm) {
      zb.maxHp = Math.round(zb.maxHp * wm.hp); zb.hp = zb.maxHp;
      zb.speed *= wm.speed;
      zb.reward = Math.round(zb.reward * wm.reward);
    }
    this.game.zombies.push(zb);
    PARTICLES.dust(sx, 0.4, sz, 7);
    // 地狱犬登场嚎叫（COD Zombies 式预警）
    if (zb.type.quadruped && Math.random() < 0.45) {
      AUDIO.howl(dist2d(sx, sz, this.game.player.pos.x, this.game.player.pos.z));
    }
    return zb;
  }

  spawnExtra(typeId) { this.spawnOne(typeId); }
}
