/* ============================================================
 * 碰撞系统 —— 圆柱体 vs AABB 推挤 / 射线检测
 * ============================================================ */

// 把一个位于 (pos.x, pos.z)、脚底 y=footY、身高 height 的圆柱推出所有碰撞体
function resolveCircleAABBs(pos, radius, height, footY) {
  footY = footY || 0;
  const cols = ENGINE.colliders;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c.maxY < footY + 0.3 || c.minY > footY + height) continue;
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 < 1e-9) {
      // 圆心在碰撞体内：沿最浅方向弹出
      const pl = pos.x - c.minX, pr = c.maxX - pos.x;
      const pn = pos.z - c.minZ, pf = c.maxZ - pos.z;
      const m = Math.min(pl, pr, pn, pf);
      if (m === pl) pos.x = c.minX - radius;
      else if (m === pr) pos.x = c.maxX + radius;
      else if (m === pn) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    } else {
      const d = Math.sqrt(d2), push = (radius - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
}

// 射线 vs 单个 AABB（slab 法），返回 t 或 null
function rayOneAABB(ox, oy, oz, dx, dy, dz, c) {
  let tmin = 0, tmax = Infinity;
  const axes = [
    [ox, dx, c.minX, c.maxX],
    [oy, dy, c.minY, c.maxY],
    [oz, dz, c.minZ, c.maxZ],
  ];
  for (let i = 0; i < 3; i++) {
    const o = axes[i][0], d = axes[i][1], mn = axes[i][2], mx = axes[i][3];
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : (tmax > 0 ? 0 : null);
}

// 射线 vs 全部场景碰撞体，返回最近命中距离（无命中返回 maxT）
function rayAABBs(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT;
  const cols = ENGINE.colliders;
  for (let i = 0; i < cols.length; i++) {
    const t = rayOneAABB(ox, oy, oz, dx, dy, dz, cols[i]);
    if (t !== null && t < best) best = t;
  }
  return best;
}

// 射线 vs 球体，返回 t 或 null
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  const thc = Math.sqrt(r2 - d2);
  const t = tca - thc;
  return t > 0 ? t : (tca + thc > 0 ? 0 : null);
}
