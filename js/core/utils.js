/* ============================================================
 * 通用工具函数
 * ============================================================ */
const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
// 角度插值（处理绕圈）
function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
function weightedPick(items) {
  // items: [{weight, ...}]
  let total = 0;
  for (const it of items) total += it.weight;
  let r = Math.random() * total;
  for (const it of items) { r -= it.weight; if (r <= 0) return it; }
  return items[items.length - 1];
}
function fmtMoney(n) { return '$' + Math.round(n); }

/* ---------- GPU 资源释放工具（v12.1） ----------
 * 遍历释放几何体 + 非缓存材质 + 实体自有纹理（__ownedTex 标记的克隆贴图）
 * 共享缓存资源（ART.__cached 材质 / 无标记贴图）不释放 —— 由全局缓存复用 */
function disposeObject3D(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (m.__cached) continue;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap']) {
        const t = m[key];
        if (t && t.__ownedTex) t.dispose();
      }
      m.dispose();
    }
  });
}
