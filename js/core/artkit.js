/* ============================================================
 * 美术工具箱 —— 无主之地式美漫风渲染支持
 * Toon 卡通分档着色 / 反向壳描边 / 程序化纹理 / 材质缓存
 * ============================================================ */
const ART = (() => {

  /* ---------- Toon 分档渐变 ---------- */
  let _grad = null;
  function gradientMap() {
    if (_grad) return _grad;
    // 3档明暗：暗部/中间调/亮部（暗部提亮保持美漫可读性）
    const data = new Uint8Array([
      128, 128, 128, 255,
      186, 186, 186, 255,
      255, 255, 255, 255,
    ]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _grad = tex;
    return _grad;
  }

  /* ---------- 材质缓存（同色共享，大幅减少状态切换） ---------- */
  const _mats = {};
  function mat(color, opts = {}) {
    const key = `m|${color}|${opts.e || 0}|${opts.toon ? 1 : 0}|${opts.mapKey || ''}|${opts.opacity || 1}`;
    if (_mats[key]) return _mats[key];
    let m;
    if (opts.map) {
      m = new THREE.MeshLambertMaterial({ color: 0xffffff, map: opts.map });
      if (opts.e) m.emissive = new THREE.Color(opts.e);
    } else if (opts.toon) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
      if (opts.e) m.emissive = new THREE.Color(opts.e);
    } else {
      m = new THREE.MeshLambertMaterial({ color });
      if (opts.e) m.emissive = new THREE.Color(opts.e);
    }
    if (opts.opacity !== undefined && opts.opacity < 1) {
      m.transparent = true;
      m.opacity = opts.opacity;
    }
    m.__cached = true;
    _mats[key] = m;
    return m;
  }

  // 实例专属 Toon 材质（丧尸受击闪红需要独立材质）
  function toon(color, emissive) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    if (emissive) m.emissive = new THREE.Color(emissive);
    return m;
  }

  /* ---------- 反向壳描边（美漫标志性的粗黑轮廓线） ---------- */
  let _outlineMat = null;
  function outlineMat() {
    if (!_outlineMat) { _outlineMat = new THREE.MeshBasicMaterial({ color: 0x150d10, side: THREE.BackSide }); _outlineMat.__cached = true; }
    return _outlineMat;
  }
  // 给 mesh 添加描边壳；仅在高画质下由引擎开关控制
  const outlineMeshes = [];
  function outline(mesh, scale = 1.07) {
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.geometry.type === 'PlaneGeometry' || mesh.geometry.type === 'CircleGeometry' || mesh.geometry.type === 'RingGeometry') return;
    const o = new THREE.Mesh(mesh.geometry, outlineMat());
    o.scale.setScalar(scale);
    o.userData.isOutline = true;
    mesh.add(o);
    outlineMeshes.push(o);
  }
  // 开关描边（性能档位）
  function setOutlines(on) {
    for (const o of outlineMeshes) o.visible = on;
  }
  function resetOutlines() { outlineMeshes.length = 0; }

  /* ---------- 程序化 Canvas 纹理 ---------- */
  const _texs = {};
  function _make(key, size, fn) {
    if (_texs[key]) return _texs[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    fn(ctx, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    _texs[key] = t;
    return t;
  }

  // 地面：沥青底噪 + 裂缝 + 色斑
  function ground(hex) {
    return _make('g' + hex, 512, (ctx, S) => {
      ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, S, S);
      // 噪点
      for (let i = 0; i < 2600; i++) {
        const v = Math.random();
        ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.09)';
        ctx.fillRect(Math.random() * S, Math.random() * S, Math.random() * 3 + 1, Math.random() * 3 + 1);
      }
      // 裂缝
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      for (let i = 0; i < 14; i++) {
        ctx.lineWidth = Math.random() * 1.6 + 0.4;
        ctx.beginPath();
        let x = Math.random() * S, y = Math.random() * S;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += rand(-46, 46); y += rand(-46, 46);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 修补色块
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = `rgba(${randi(10, 40)},${randi(10, 40)},${randi(10, 40)},0.18)`;
        ctx.beginPath();
        ctx.arc(Math.random() * S, Math.random() * S, rand(18, 60), 0, 7);
        ctx.fill();
      }
    });
  }

  // 建筑窗格
  function windows(hex) {
    return _make('w' + hex, 256, (ctx, S) => {
      ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, S, S);
      const cols = 4, rows = 5, pad = 12;
      const cw = (S - pad * (cols + 1)) / cols, ch = (S - pad * (rows + 1)) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const lit = Math.random();
        ctx.fillStyle = lit > 0.86 ? 'rgba(255,214,140,0.85)' : lit > 0.7 ? 'rgba(60,90,110,0.9)' : 'rgba(12,16,20,0.95)';
        ctx.fillRect(pad + c * (cw + pad), pad + r * (ch + pad), cw, ch);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(pad + c * (cw + pad), pad + r * (ch + pad), cw, ch);
      }
      // 污渍
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.fillRect(Math.random() * S, Math.random() * S, rand(4, 26), rand(10, 60));
      }
    });
  }

  // 斜纹（帐篷/摊位雨棚）
  function stripes(c1, c2) {
    return _make('s' + c1 + c2, 128, (ctx, S) => {
      ctx.fillStyle = '#' + c1.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#' + c2.toString(16).padStart(6, '0');
      const w = S / 6;
      for (let i = -6; i < 12; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * w, 0); ctx.lineTo((i + 1) * w, 0);
        ctx.lineTo((i + 1) * w - S, S); ctx.lineTo(i * w - S, S);
        ctx.fill();
      }
    });
  }

  // 金属板（墙体/集装箱）
  function panel(hex) {
    return _make('p' + hex, 256, (ctx, S) => {
      ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, S, S);
      // 竖向波纹
      for (let x = 0; x < S; x += 32) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(x, 0, 6, S);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x + 6, 0, 3, S);
      }
      // 铆钉
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let x = 16; x < S; x += 64) for (let y = 12; y < S; y += 60) {
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
      }
      // 锈迹
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(${randi(90, 130)},${randi(50, 70)},30,0.16)`;
        ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, rand(4, 22), 0, 7); ctx.fill();
      }
    });
  }

  /* ---------- 天空穹顶（垂直渐变 + 星点） ---------- */
  function sky(topHex, fogHex, stars) {
    return _make('sky' + topHex + fogHex + (stars ? 1 : 0), 256, (ctx, S) => {
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, '#' + topHex.toString(16).padStart(6, '0'));
      g.addColorStop(0.62, '#' + fogHex.toString(16).padStart(6, '0'));
      g.addColorStop(1, '#' + fogHex.toString(16).padStart(6, '0'));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      if (stars) {
        for (let i = 0; i < 90; i++) {
          const y = Math.random() * S * 0.55;
          ctx.fillStyle = `rgba(255,255,255,${rand(0.15, 0.7)})`;
          ctx.fillRect(Math.random() * S, y, rand(1, 2.2), rand(1, 2.2));
        }
      }
    });
  }

  return { mat, toon, gradientMap, outline, setOutlines, resetOutlines, ground, windows, stripes, panel, sky };
})();
