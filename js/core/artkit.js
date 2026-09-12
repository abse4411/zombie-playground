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
      m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: opts.map, roughness: 0.85, metalness: 0.05 });
      if (opts.e) m.emissive = new THREE.Color(opts.e);
    } else if (opts.toon) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04 });
      if (opts.e) m.emissive = new THREE.Color(opts.e);
    } else {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.35 });
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

  // 实例专属 PBR 材质（丧尸/武器受击闪红需要独立材质；CS:GO 式写实明暗）
  function toon(color, emissive) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.03 });
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

  /* ---------- PBR 派生贴图（v3.4：从反照率生成法线/粗糙度） ---------- */
  // 高度→法线（Sobel）
  function _heightToNormal(srcCanvas, strength = 2.2) {
    const S = srcCanvas.width;
    const sctx = srcCanvas.getContext('2d');
    const src = sctx.getImageData(0, 0, S, S).data;
    const out = document.createElement('canvas');
    out.width = out.height = S;
    const octx = out.getContext('2d');
    const dst = octx.createImageData(S, S);
    const hAt = (x, y) => {
      x = (x + S) % S; y = (y + S) % S;
      const i = (y * S + x) * 4;
      return (src[i] + src[i + 1] + src[i + 2]) / 765;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (hAt(x - 1, y) - hAt(x + 1, y)) * strength;
      const dy = (hAt(x, y - 1) - hAt(x, y + 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * S + x) * 4;
      dst.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      dst.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      dst.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
    octx.putImageData(dst, 0, 0);
    return out;
  }

  const _pbr = {};   // key -> {map, normalMap, roughnessMap}
  function pbr(baseKey, baseCanvas, roughness) {
    if (_pbr[baseKey]) return _pbr[baseKey];
    const map = new THREE.CanvasTexture(baseCanvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const normal = new THREE.CanvasTexture(_heightToNormal(baseCanvas));
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    // 粗糙度图：灰度 = 基础粗糙度 ± 亮度扰动
    const S = baseCanvas.width;
    const rc = document.createElement('canvas');
    rc.width = rc.height = S;
    const rctx = rc.getContext('2d');
    rctx.drawImage(baseCanvas, 0, 0);
    const rd = rctx.getImageData(0, 0, S, S);
    for (let i = 0; i < rd.data.length; i += 4) {
      const lum = (rd.data[i] + rd.data[i + 1] + rd.data[i + 2]) / 765;
      const g = Math.round(clamp(roughness + (lum - 0.5) * 0.25, 0.05, 1) * 255);
      rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = g;
    }
    rctx.putImageData(rd, 0, 0);
    const rough = new THREE.CanvasTexture(rc);
    rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
    return _pbr[baseKey] = { map, normalMap: normal, roughnessMap: rough };
  }

  // 地面（PBR 三件套：手绘沥青，无主之地式）
  function groundPBR(hex) {
    const c = handPaint(_makeCanvas('g' + hex, 512, (ctx, S) => {
      ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 4200; i++) {
        const v = Math.random();
        ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(Math.random() * S, Math.random() * S, Math.random() * 2.5 + 1, Math.random() * 2.5 + 1);
      }
      // 碎石颗粒（法线会凸起）
      for (let i = 0; i < 260; i++) {
        const g = randi(60, 150);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.beginPath();
        ctx.arc(Math.random() * S, Math.random() * S, rand(1, 3.2), 0, 7);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      for (let i = 0; i < 16; i++) {
        ctx.lineWidth = Math.random() * 2 + 0.5;
        ctx.beginPath();
        let x = Math.random() * S, y = Math.random() * S;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += rand(-52, 52); y += rand(-52, 52); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `rgba(${randi(8,36)},${randi(8,36)},${randi(8,36)},0.2)`;
        ctx.beginPath();
        ctx.arc(Math.random() * S, Math.random() * S, rand(20, 70), 0, 7);
        ctx.fill();
      }
    }));
    return pbr('gp' + hex, c, 0.82);
  }

  // 建筑外墙 PBR（手绘混凝土）
  function concretePBR(hex) {
    const c = handPaint(_makeCanvas('cw' + hex, 512, (ctx, S) => {
      ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 3600; i++) {
        const v = Math.random();
        ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(Math.random() * S, Math.random() * S, rand(1, 3), rand(1, 3));
      }
      // 模板接缝
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let y = 0; y < S; y += S / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
      // 水渍流痕
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * S;
        const grad = ctx.createLinearGradient(x, 0, x, rand(60, 240));
        grad.addColorStop(0, 'rgba(20,22,25,0.35)');
        grad.addColorStop(1, 'rgba(20,22,25,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, rand(6, 20), 240);
      }
      // 裂缝
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 8; i++) {
        ctx.lineWidth = rand(0.5, 1.8);
        ctx.beginPath();
        let x = Math.random() * S, y = Math.random() * S;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += rand(-40, 40); y += rand(20, 60); ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }));
    return pbr('cw' + hex, c, 0.9);
  }

  function _makeCanvas(key, size, fn) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    fn(c.getContext('2d'), size);
    return c;
  }

  // 手绘笔触层（无主之地式：albedo带方向性笔触与色彩抖动，保留PBR光照）
  function handPaint(srcCanvas, hueJitter = 14, strokes = 260) {
    const S = srcCanvas.width;
    const out = document.createElement('canvas');
    out.width = out.height = S;
    const ctx = out.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);
    const src = ctx.getImageData(0, 0, S, S);
    // 色彩抖动（按块调色，模拟手绘上色）
    for (let i = 0; i < src.data.length; i += 4) {
      const j = ((i >> 2) % 7 === 0) ? rand(-hueJitter, hueJitter) : 0;
      src.data[i] = clamp(src.data[i] + j, 0, 255);
      src.data[i + 1] = clamp(src.data[i + 1] + j * 0.6, 0, 255);
      src.data[i + 2] = clamp(src.data[i + 2] + j * 0.4, 0, 255);
    }
    ctx.putImageData(src, 0, 0);
    // 方向性笔触
    ctx.globalAlpha = 0.10;
    for (let i = 0; i < strokes; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const w = rand(10, 34), h = rand(2, 5);
      const light = Math.random() > 0.5;
      ctx.fillStyle = light ? '#ffffff' : '#000000';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand(-0.5, 0.5));
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return out;
  }

  return { mat, toon, gradientMap, outline, setOutlines, resetOutlines, ground, windows, stripes, panel, sky, groundPBR, concretePBR, pbr, handPaint };
})();
