/* ============================================================
 * 投掷物 / 手雷爆炸 / 火焰区 / 酸液池
 * ============================================================ */
const PROJ_CFG = {
  frag:    { r: 0.11, c: 0x3d5a3d, e: 0x000000, g: 13 },
  molotov: { r: 0.12, c: 0x8a4b1f, e: 0x552200, g: 13 },
  acid:    { r: 0.15, c: 0x66cc33, e: 0x2a6600, g: 9 },
};

function pointBlocked(x, y, z) {
  for (const c of ENGINE.colliders) {
    if (x > c.minX && x < c.maxX && y > c.minY && y < c.maxY && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}

class Projectile {
  constructor(kind, x, y, z, vx, vy, vz, opts = {}) {
    this.kind = kind;
    const c = PROJ_CFG[kind];
    this.r = c.r; this.g = c.g;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.fuse = opts.fuse !== undefined ? opts.fuse : 3;
    this.opts = opts;
    this.dead = false; this.landed = false;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(c.r, 10, 8),
      new THREE.MeshLambertMaterial({ color: c.c, emissive: c.e })
    );
    this.mesh.position.set(x, y, z);
    ENGINE.scene.add(this.mesh);
  }

  get pos() { return this.mesh.position; }

  update(dt, game) {
    const p = this.pos;
    this.fuse -= dt;
    this.vy -= this.g * dt;

    // 分轴移动 + 撞墙反弹
    let px = p.x; p.x += this.vx * dt;
    if (pointBlocked(p.x, p.y, p.z)) { p.x = px; this.vx *= -0.4; this.wallHit = true; }
    let pz = p.z; p.z += this.vz * dt;
    if (pointBlocked(p.x, p.y, p.z)) { p.z = pz; this.vz *= -0.4; this.wallHit = true; }
    p.y += this.vy * dt;

    if (p.y <= this.r) {
      p.y = this.r;
      if (Math.abs(this.vy) > 2.2) { this.vy *= -0.35; this.vx *= 0.65; this.vz *= 0.65; }
      else { this.vy = 0; this.vx *= 0.9; this.vz *= 0.9; this.landed = true; }
    }

    if (this.kind === 'molotov') PARTICLES.flames(p.x, p.y, p.z, 1);
    if (this.kind === 'acid' && Math.random() < 0.4) PARTICLES.acidSplash(p.x, p.y, p.z);

    const pd = dist2d(p.x, p.z, game.player.pos.x, game.player.pos.z);

    if (this.kind === 'frag' && this.fuse <= 0) {
      this._finish(game);
      explodeGrenade(game, p.x, p.y, p.z, THROWABLES.frag);
      return;
    }
    if (this.kind === 'molotov' && (this.landed || this.wallHit || this.fuse <= 0)) {
      this._finish(game);
      spawnFireZone(game, p.x, p.z, THROWABLES.molotov);
      AUDIO.fireIgnite();
      return;
    }
    if (this.kind === 'acid') {
      // 命中玩家或落地
      if (pd < 0.9 && p.y < 2.2) {
        const R = this.opts.R;
        game.player.takeDamage(R.dmg * (game.mode ? 1 : 1), game);
        game.player.slowT = 2;
        this._finish(game);
        spawnAcidPool(game, p.x, p.z, R);
        return;
      }
      if (this.landed) {
        this._finish(game);
        spawnAcidPool(game, p.x, p.z, this.opts.R);
        return;
      }
    }
    if (this.fuse < -4) this._finish(game); // 保险
  }

  _finish(game) {
    this.dead = true;
    ENGINE.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
  }
}

/* ---------- 手雷爆炸 ---------- */
function explodeGrenade(game, x, y, z, cfg, selfMult) {
  selfMult = selfMult !== undefined ? selfMult : cfg.selfMult;
  PARTICLES.explosion(x, y, z);
  const pd = dist2d(x, z, game.player.pos.x, game.player.pos.z);
  AUDIO.explode(pd);
  ENGINE.shake(clamp(0.5 - pd * 0.02, 0.08, 0.5));
  for (const zb of game.zombies) {
    if (zb.dead) continue;
    const d = dist2d(x, z, zb.pos.x, zb.pos.z);
    if (d < cfg.radius) {
      const dmg = cfg.damage * (1 - (d / cfg.radius) * 0.55);
      // 爆风击退：从爆心向外推
      const nx = (zb.pos.x - x) / (d || 1), nz = (zb.pos.z - z) / (d || 1);
      const kb = GAMECONFIG.feel ? GAMECONFIG.feel.kbExplosion : 6;
      zb.takeDamage(dmg, false, { x: zb.pos.x, y: 1.1 * zb.group.scale.x, z: zb.pos.z }, game,
        { x: nx * kb, z: nz * kb });
    }
  }
  const pr = cfg.radius * 0.75;
  if (pd < pr && game.player.alive) {
    game.player.takeDamage(cfg.damage * selfMult * (1 - pd / pr), game);
  }
  // 波及可破坏物（链式引爆在 Destructible.destroy 内处理）
  if (typeof Destructible !== 'undefined' && game.destructibles) {
    for (const d of game.destructibles) {
      if (d.dead) continue;
      const dd = dist2d(x, z, d.x, d.z);
      if (dd < cfg.radius) d.hit(cfg.damage * (1 - dd / cfg.radius), game, true);
    }
  }
}

function explodeBloater(game, z) {
  const cfg = { damage: z.type.explode.dmg, radius: z.type.explode.radius, selfMult: 0.3 };
  explodeGrenade(game, z.pos.x, 0.8, z.pos.z, cfg);
  spawnAcidPool(game, z.pos.x, z.pos.z, { poolDps: 10, poolRadius: 2.4, poolTime: 3 });
}

/* ---------- 火焰区 / 酸液池 ---------- */
class Zone {
  constructor(x, z, kind, cfg) {
    this.x = x; this.z = z; this.kind = kind;
    this.r = kind === 'fire' ? cfg.radius : cfg.poolRadius;
    this.dps = kind === 'fire' ? cfg.dps : cfg.poolDps;
    this.ttl = kind === 'fire' ? cfg.duration : cfg.poolTime;
    this.dead = false; this.tick = 0;
    const color = kind === 'fire' ? 0xff6a1a : 0x55cc22;
    this.mesh = new THREE.Mesh(
      new THREE.CircleGeometry(this.r, 26),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.05, z);
    ENGINE.scene.add(this.mesh);
  }

  update(dt, game) {
    this.ttl -= dt;
    if (this.ttl <= 0) { this.dead = true; ENGINE.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); return; }
    this.mesh.material.opacity = 0.22 + Math.sin(ENGINE.time * 9) * 0.08;
    if (this.kind === 'fire') {
      const a = Math.random() * TAU, rr = Math.random() * this.r;
      PARTICLES.flames(this.x + Math.cos(a) * rr, 0.2, this.z + Math.sin(a) * rr, 2);
    } else if (Math.random() < 0.3) {
      PARTICLES.acidSplash(this.x + rand(-this.r, this.r) * 0.7, 0.2, this.z + rand(-this.r, this.r) * 0.7);
    }
    // 伤害判定（每 0.25s 一跳）
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      const step = this.dps * 0.25;
      const selfMult = this.kind === 'fire' ? 0.35 : 0.5;
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        if (dist2d(this.x, this.z, zb.pos.x, zb.pos.z) < this.r) {
          zb.takeDamage(step, false, null, game);
        }
      }
      if (game.player.alive && dist2d(this.x, this.z, game.player.pos.x, game.player.pos.z) < this.r) {
        game.player.takeDamage(step * selfMult, game);
      }
    }
  }
}

function spawnFireZone(game, x, z, cfg) { game.fireZones.push(new Zone(x, z, 'fire', cfg)); }
function spawnAcidPool(game, x, z, R) { if (R) game.acidPools.push(new Zone(x, z, 'acid', R)); }

/* ---------- 吐酸者弹道 ---------- */
function spawnAcid(game, zombie, R) {
  const p = game.player;
  const ox = zombie.pos.x, oy = 1.5 * zombie.group.scale.x, oz = zombie.pos.z;
  const d = dist2d(ox, oz, p.pos.x, p.pos.z);
  const t = clamp(d / R.speed, 0.25, 2.2);
  // 预判 + 抛物线解算
  const tx = p.pos.x + p.vel.x * t * 0.5;
  const tz = p.pos.z + p.vel.z * t * 0.5;
  const vx = (tx - ox) / t, vz = (tz - oz) / t;
  const vy = (1.2 - oy + 0.5 * PROJ_CFG.acid.g * t * t) / t;
  const proj = new Projectile('acid', ox, oy, oz, vx, vy, vz, { fuse: 4, R });
  game.projectiles.push(proj);
  AUDIO.acidSpit(d);
}
