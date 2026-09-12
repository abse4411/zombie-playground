/* ============================================================
 * 碰撞系统 —— 圆柱 vs AABB 推挤 / 站立高度 / 射线（v4.1 立体地形）
 * ============================================================ */

// 把圆柱推出所有"腿部高度以上"的碰撞体（低于抬脚高度的台面不阻挡，可自然踏上去）
function resolveCircleAABBs(pos, radius, height, footY, stepHeight) {
  footY = footY || 0;
  stepHeight = stepHeight === undefined ? 0.3 : stepHeight;
  const cols = ENGINE.colliders;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    // 台阶以下不阻挡（可踏步）；胸口(0.9m)以上的顶板只擦头、不侧向推挤
    if (c.maxY < footY + stepHeight || c.minY > footY + 0.9) continue;
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 < 1e-9 || c.minY > footY + 0.2) {
      // 中心已在体内：仅当障碍真正到达腰部以下才从最薄面弹出（头顶擦碰直接忽略）
      if (d2 < 1e-9) {
        const pl = pos.x - c.minX, pr = c.maxX - pos.x;
        const pn = pos.z - c.minZ, pf = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pn, pf);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pn) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    } else {
      const d = Math.sqrt(d2);
      // 推挤上限0.5m：防止贴面瞬间(d→0)产生的巨大位移把角色弹飞/穿墙
      const push = Math.min(0.5, (radius - d) / d);
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
}

// 脚下支撑高度：找 (x,z) 覆盖范围内、顶面不高于 footY+step 的最高台面（0=地面）
function groundHeightAt(x, z, radius, footY, stepHeight) {
  stepHeight = stepHeight === undefined ? 0.55 : stepHeight;
  let g = 0;
  const cols = ENGINE.colliders;
  const r = radius * 0.7;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c.maxY > footY + stepHeight || c.maxY <= g) continue;
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) {
      g = c.maxY;
    }
  }
  return g;
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
