# -*- coding: utf-8 -*-
import io

p = 'js/config/maps.js'
s = io.open(p, encoding='utf-8').read()

new_maps = u'''
  /* ========== 6. 迷雾森林（番外·猎人营地） ========== */
  forest: {
    id: 'forest', name: '迷雾森林', subtitle: '树比雾高，雾比夜黑', mode: 'both',
    desc: '滨港郊外的猎人森林。浓雾把视野压到十米以内，树干之间总有影子在动——篝火营地的火光是你唯一的坐标。',
    size: 74, groundColor: 0x1d2418, sky: 0x0a0f14, fogColor: 0x111a16, fogDensity: 0.032, stars: false,
    hemi: { sky: 0x3a5a45, ground: 0x141a10, i: 0.6 },
    dir: { c: 0x7aa888, i: 0.3, x: -20, y: 60, z: 10 },
    lights: [
      { x: 0, y: 2.5, z: 0, c: 0xff9a3c, i: 1.1, d: 22 },
      { x: -20, y: 3.5, z: -18, c: 0xffbb66, i: 0.7, d: 16 },
      { x: 22, y: 3.5, z: 16, c: 0xffbb66, i: 0.6, d: 14 },
      { x: 0, y: 5, z: -34, c: 0x66ff99, i: 0.5, d: 18 },
    ],
    props: [
      { t: 'b', x: -22, z: -14, w: 0.4, h: 3.2, d: 8, c: 0x4a3b28 }, { t: 'b', x: -18, z: -14, w: 0.4, h: 3.2, d: 8, c: 0x4a3b28 },
      { t: 'b', x: -20, z: -17.8, w: 8, h: 3.2, d: 0.4, c: 0x4a3b28 },
      { t: 'b', x: -20, z: -10.2, w: 3, h: 3.2, d: 0.4, c: 0x4a3b28 },
      { t: 'b', x: -20, z: -14, w: 8.6, h: 0.5, d: 8.6, y: 3.2, c: 0x3a2e20 },
      { t: 'c', x: 0, z: 0, r: 0.8, h: 0.3, c: 0x33261a },
      { t: 'b', x: 14, z: -22, w: 3.4, h: 2.2, d: 3.4, ry: 0.4, c: 0x3e4a38 }, { t: 'b', x: 14, z: -22, w: 3.8, h: 0.4, d: 3.8, y: 2.2, ry: 0.4, c: 0x2e3828, nc: true },
      { t: 'b', x: -30, z: 18, w: 3.4, h: 2.2, d: 3.4, ry: -0.5, c: 0x3e4a38 },
      { t: 'b', x: 26, z: 30, w: 3.4, h: 2.2, d: 3.4, ry: 1.1, c: 0x3e4a38 },
      { t: 'b', x: 0, z: -34, w: 5, h: 0.4, d: 5, y: 2.6, c: 0x4a3b28 },
      { t: 'b', x: -1.8, z: -34, w: 0.4, h: 2.6, d: 0.4, c: 0x3a2e20 }, { t: 'b', x: 1.8, z: -34, w: 0.4, h: 2.6, d: 0.4, c: 0x3a2e20 },
      { t: 'b', x: 0, z: -36.2, w: 0.4, h: 2.6, d: 0.4, c: 0x3a2e20 }, { t: 'b', x: 0, z: -31.8, w: 0.4, h: 2.6, d: 0.4, c: 0x3a2e20 },
      { t: 'b', x: 0, z: -28.6, w: 2.4, h: 0.65, d: 1.2, c: 0x3a2e20 },
      { t: 'b', x: 0, z: -30.4, w: 2.4, h: 1.3, d: 1.2, c: 0x423424 },
      { t: 'b', x: 0, z: -32.2, w: 2.4, h: 1.95, d: 1.2, c: 0x463826 },
      { t: 'b', x: -12, z: 12, w: 6, h: 0.9, d: 1.2, ry: 0.3, c: 0x3a2e20 }, { t: 'b', x: 18, z: 4, w: 5, h: 0.9, d: 1.2, ry: -0.4, c: 0x3a2e20 },
      { t: 'c', x: -8, z: -28, r: 1.4, h: 1.6, c: 0x3a3d40 }, { t: 'c', x: 24, z: -12, r: 1.8, h: 2.2, c: 0x3a3d40 }, { t: 'c', x: -34, z: 34, r: 2.2, h: 2.6, c: 0x3a3d40 },
    ],
    structures: [
      { type: 'forestTrees', x: 0, z: 0 },
      { type: 'campfire', x: 0, z: 0 },
      { type: 'deadTree', x: -14, z: -30 }, { type: 'deadTree', x: 30, z: 24 },
      { type: 'lightPole', x: -20, z: -16, c: 0xffbb66, i: 0.5, d: 14 },
    ],
    spawns: [
      { x: -34, z: -34 }, { x: 0, z: -38 }, { x: 34, z: -34 }, { x: -40, z: 0 },
      { x: 40, z: -4 }, { x: -36, z: 36 }, { x: 0, z: 42 }, { x: 36, z: 38 }, { x: -14, z: 40 }, { x: 16, z: 42 },
    ],
    playerSpawn: { x: 0, z: 8, yaw: 0 },
    buyZone: { x: -8, z: 8, r: 4.5 },
  },

  /* ========== 7. 天台突围（多层商场） ========== */
  rooftops: {
    id: 'rooftops', name: '天台突围', subtitle: '购物中心 · 两层楼 + 天台', mode: 'both',
    desc: '滨港购物中心：一层卖场、二层环形回廊、三层天台直升机坪。楼梯是咽喉——守住楼梯口，或者被从楼上包围。',
    size: 60, groundColor: 0x2a2c30, sky: 0x141a22, fogColor: 0x161c24, fogDensity: 0.014,
    hemi: { sky: 0x6a7a8a, ground: 0x181a1e, i: 0.7 },
    dir: { c: 0x9ab0cc, i: 0.45, x: 30, y: 60, z: -20 },
    lights: [
      { x: 0, y: 5, z: 0, c: 0xfff2cc, i: 0.9, d: 30 },
      { x: -18, y: 4.5, z: 14, c: 0x88ccff, i: 0.7, d: 20 },
      { x: 18, y: 4.5, z: -14, c: 0xffcc88, i: 0.7, d: 20 },
      { x: 0, y: 9, z: 0, c: 0xffffff, i: 0.6, d: 26 },
    ],
    props: [
      { t: 'b', x: -20, z: -20, w: 0.6, h: 4.5, d: 40, c: 0x42474e }, { t: 'b', x: 20, z: -20, w: 0.6, h: 4.5, d: 40, c: 0x42474e },
      { t: 'b', x: -20, z: 20, w: 14, h: 4.5, d: 0.6, c: 0x42474e }, { t: 'b', x: 20, z: 20, w: 14, h: 4.5, d: 0.6, c: 0x42474e },
      { t: 'b', x: -6.5, z: 20, w: 7, h: 4.5, d: 0.6, c: 0x42474e }, { t: 'b', x: 6.5, z: 20, w: 7, h: 4.5, d: 0.6, c: 0x42474e },
      { t: 'b', x: 0, z: -14.5, w: 40, h: 0.5, d: 11, y: 4.5, c: 0x3a3f46 },
      { t: 'b', x: 0, z: 14.5, w: 40, h: 0.5, d: 11, y: 4.5, c: 0x3a3f46 },
      { t: 'b', x: -14.5, z: 0, w: 11, h: 0.5, d: 18, y: 4.5, c: 0x3a3f46 },
      { t: 'b', x: 14.5, z: 0, w: 11, h: 0.5, d: 18, y: 4.5, c: 0x3a3f46 },
      { t: 'b', x: 0, z: -9.3, w: 18, h: 0.9, d: 0.3, y: 5.0, c: 0x2c3036, nc: true },
      { t: 'b', x: 0, z: 9.3, w: 18, h: 0.9, d: 0.3, y: 5.0, c: 0x2c3036, nc: true },
      { t: 'b', x: -12, z: -6, w: 6, h: 1.2, d: 1.6, c: 0x4a4438 }, { t: 'b', x: 12, z: 6, w: 6, h: 1.2, d: 1.6, c: 0x4a4438 },
      { t: 'b', x: -12, z: 6, w: 1.6, h: 1.2, d: 5, c: 0x4a4438 }, { t: 'b', x: 12, z: -6, w: 1.6, h: 1.2, d: 5, c: 0x4a4438 },
      { t: 'b', x: 0, z: -18, w: 8, h: 2.2, d: 1.6, c: 0x50483a }, { t: 'b', x: 0, z: 18, w: 8, h: 2.2, d: 1.6, c: 0x50483a },
      { t: 'b', x: -17.5, z: -2, w: 3, h: 0.9, d: 2, c: 0x3e444c },
      { t: 'b', x: -17.5, z: 0, w: 3, h: 1.8, d: 2, c: 0x444a52 },
      { t: 'b', x: -17.5, z: 2, w: 3, h: 2.7, d: 2, c: 0x4a5058 },
      { t: 'b', x: -17.5, z: 4, w: 3, h: 3.6, d: 2, c: 0x50565e },
      { t: 'b', x: -17.5, z: 6, w: 3, h: 4.5, d: 2, c: 0x565c64 },
      { t: 'b', x: 17.5, z: 2, w: 3, h: 0.9, d: 2, c: 0x3e444c },
      { t: 'b', x: 17.5, z: 0, w: 3, h: 1.8, d: 2, c: 0x444a52 },
      { t: 'b', x: 17.5, z: -2, w: 3, h: 2.7, d: 2, c: 0x4a5058 },
      { t: 'b', x: 17.5, z: -4, w: 3, h: 3.6, d: 2, c: 0x50565e },
      { t: 'b', x: 17.5, z: -6, w: 3, h: 4.5, d: 2, c: 0x565c64 },
      { t: 'b', x: -19, z: -19, w: 0.8, h: 9, d: 0.8, c: 0x3a3f46 }, { t: 'b', x: 19, z: -19, w: 0.8, h: 9, d: 0.8, c: 0x3a3f46 },
      { t: 'b', x: -19, z: 19, w: 0.8, h: 9, d: 0.8, c: 0x3a3f46 }, { t: 'b', x: 19, z: 19, w: 0.8, h: 9, d: 0.8, c: 0x3a3f46 },
      { t: 'b', x: 0, z: -16, w: 3.2, h: 6.75, d: 3, c: 0x4a5058 },
      { t: 'b', x: 0, z: -13.4, w: 3.2, h: 5.6, d: 2.2, c: 0x444a52 },
      { t: 'c', x: 0, z: -14, r: 4, h: 0.12, y: 9, c: 0x3a4048, nc: true },
    ],
    structures: [
      { type: 'lightPole', x: -18, z: 14, c: 0x88ccff, i: 0.55, d: 16 },
      { type: 'lightPole', x: 18, z: -14, c: 0xffcc88, i: 0.55, d: 16 },
    ],
    spawns: [
      { x: -26, z: -26 }, { x: 0, z: -28 }, { x: 26, z: -26 }, { x: -28, z: 0 },
      { x: 28, z: 4 }, { x: -26, z: 26 }, { x: 26, z: 26 }, { x: 0, z: 28 }, { x: -24, z: -8 }, { x: 24, z: 8 },
    ],
    playerSpawn: { x: 0, z: 24, yaw: 0 },
    buyZone: { x: 10, z: 24, r: 4.5 },
  },
'''

marker = u'/* ---------- 地图缩略图（菜单卡片预览） ---------- */'
assert marker in s
s = s.replace(marker, new_maps + marker, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('maps added')

# 结构构建器
s = io.open(p, encoding='utf-8').read()
structs = u'''
  // 森林树阵（程序化密集树干+树冠，留出空地/营地/楼梯净空）
  forestTrees(g, s, def) {
    const S = def.size - 4;
    const leafMat = mkMat(0x24371f);
    const leafMat2 = mkMat(0x1e2f1a);
    let placed = 0, guard = 0;
    const bz = def.buyZone, p0 = def.playerSpawn;
    const clearings = [{ x: 0, z: 0, r: 7 }, { x: -20, z: -14, r: 8 }, { x: 0, z: -34, r: 6 }, { x: 14, z: -22, r: 5 }];
    while (placed < 42 && guard++ < 300) {
      const x = rand(-S, S), z = rand(-S, S);
      if (clearings.some(c => dist2d(x, z, c.x, c.z) < c.r)) continue;
      if (dist2d(x, z, bz.x, bz.z) < bz.r + 2) continue;
      if (dist2d(x, z, p0.x, p0.z) < 4) continue;
      const h = rand(4.5, 7.5);
      const trunk = mkCyl(rand(0.35, 0.55), h, 0x3a2c1e);
      put(trunk, x, h / 2, z); g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(rand(1.6, 2.6), rand(3, 5), 8), Math.random() > 0.5 ? leafMat : leafMat2);
      put(crown, x, h + 1.4, z, rand(0, TAU)); g.add(crown);
      colCyl(x, z, 0.5, h);
      placed++;
    }
  },

  // 中央篝火（动态火焰粒子）
  campfire(g, s) {
    ENGINE.anims.push(() => {
      if (Math.random() < 0.5) {
        const a = Math.random() * TAU, r = Math.random() * 0.5;
        PARTICLES.flames(s.x + Math.cos(a) * r, 0.4, s.z + Math.sin(a) * r, 1);
      }
    });
  },
'''
old_marker = u'''  // 沙袋环形工事'''
assert old_marker in s
s = s.replace(old_marker, structs + old_marker, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('structs added')
