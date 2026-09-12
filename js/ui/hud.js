/* ============================================================
 * HUD —— 状态条 / 弹药 / 雷达 / 播报 / 屏幕效果 / 教学面板
 * ============================================================ */
const HUD = {
  el: {},
  _dmgFlash: 0, _hmT: null, _bannerT: null, _toastT: null, _streakT: null, _dirT: null,

  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      hud: $('hud'), hitmarker: $('hitmarker'), scope: $('scope-overlay'),
      vignette: $('vignette'), lowHp: $('low-hp'),
      waveLabel: $('wave-label'), objectiveLabel: $('objective-label'),
      killfeed: $('killfeed'), radar: $('radar'),
      hpFill: $('hp-fill'), hpText: $('hp-text'),
      armorFill: $('armor-fill'), armorText: $('armor-text'),
      moneyVal: $('money-val'), killsVal: $('kills-val'), headshotVal: $('headshot-val'),
      throwFrag: $('throw-frag'), throwMolo: $('throw-molo'),
      weaponName: $('weapon-name'), ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'),
      slots: document.querySelectorAll('#slots-row .slot'),
      interact: $('interact-prompt'), reloadHint: $('reload-hint'),
      banner: $('banner'), bannerMain: $('banner-main'), bannerSub: $('banner-sub'),
      lockHint: $('lock-hint'),
      objPanel: $('objective-panel'), objText: $('objective-text'),
      objHint: $('objective-hint'), objProg: $('objective-progress'),
      streak: $('streak-banner'), dmgDir: $('dmg-dir'),
      bloodLayer: $('blood-layer'), fps: $('fps-counter'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'),
    };
    this.radarCtx = this.el.radar.getContext('2d');
    $('btn-tut-skip').addEventListener('click', () => {
      if (GAME && GAME.state === 'playing') { HUD.hideObjective(); GAME.quitToMenu(); }
    });
  },

  show() { this.el.hud.classList.remove('hidden'); },
  hide() { this.el.hud.classList.add('hidden'); this.hideObjective(); },

  /* ---------- Boss 血条 ---------- */
  showBossBar(name) {
    this.el.bossBar.classList.remove('hidden');
    this.el.bossName.textContent = name;
    this.el.bossFill.style.width = '100%';
  },
  updateBossBar(z) {
    this.el.bossFill.style.width = clamp(z.hp / z.maxHp * 100, 0, 100) + '%';
  },
  hideBossBar() { this.el.bossBar.classList.add('hidden'); },

  /* ---------- 教学目标面板 ---------- */
  showObjective(lines) {
    this.el.objPanel.classList.remove('hidden');
    this.el.objText.textContent = lines[0] || '';
    this.el.objHint.textContent = lines[1] || '';
    this.el.objProg.textContent = '';
  },
  setObjective(text, hint, idx, total) {
    this.el.objPanel.classList.remove('hidden');
    this.el.objText.textContent = text;
    this.el.objHint.textContent = hint || '';
    this.el.objProg.textContent = idx ? `进度 ${idx}/${total}` : '';
  },
  hideObjective() { this.el.objPanel.classList.add('hidden'); },

  /* ---------- 打击反馈 ---------- */
  damageFlash() { this._dmgFlash = 1; },

  hitmarker(head) {
    const h = this.el.hitmarker;
    h.classList.remove('show', 'head');
    void h.offsetWidth;
    h.classList.add('show');
    if (head) h.classList.add('head');
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => h.classList.remove('show', 'head'), 95);
  },

  streak(n) {
    const s = this.el.streak;
    s.textContent = `${n} 连杀！`;
    s.classList.remove('hidden', 'pop');
    void s.offsetWidth;
    s.classList.add('pop');
    clearTimeout(this._streakT);
    this._streakT = setTimeout(() => { s.classList.add('hidden'); s.classList.remove('pop'); }, 1400);
  },

  // 受击方向指示：把红色扇形旋转到伤害来源方向
  showDamageDir(srcPos) {
    if (!GAME || !GAME.player) return;
    const p = GAME.player;
    const ang = Math.atan2(srcPos.x - p.pos.x, srcPos.z - p.pos.z);
    // 相对视角角度（0 = 正前方）
    let rel = ang - p.yaw + Math.PI;
    this.el.dmgDir.style.transform = `translate(-50%,-50%) rotate(${rel}rad)`;
    this.el.dmgDir.style.opacity = '0.9';
    clearTimeout(this._dirT);
    this._dirT = setTimeout(() => { this.el.dmgDir.style.opacity = '0'; }, 700);
  },

  // 屏幕血溅（近距离击杀 / 爆头）
  bloodSplat() {
    const layer = this.el.bloodLayer;
    if (layer.children.length > 7) layer.removeChild(layer.firstChild);
    const d = document.createElement('div');
    d.className = 'blood-splat';
    const size = rand(60, 150);
    d.style.width = d.style.height = size + 'px';
    d.style.left = rand(5, 85) + '%';
    d.style.top = rand(5, 80) + '%';
    d.style.transform = `rotate(${rand(0, 360)}deg) scale(${rand(0.7, 1.3)})`;
    layer.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 900);
  },

  // 拾取播报（右侧中部，带稀有度色）
  pickup(text, rarity) {
    const feed = document.getElementById('pickup-feed');
    if (!feed) return;
    const d = document.createElement('div');
    d.className = 'pickup-item r' + (rarity || 0);
    d.textContent = text;
    feed.appendChild(d);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2800);
  },

  banner(main, sub) {
    const b = this.el.banner;
    b.classList.remove('hidden');
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub || '';
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.add('hidden'), 2500);
  },

  killfeed(text, cls) {
    const d = document.createElement('div');
    d.className = 'kf' + (cls ? ' ' + cls : '');
    d.textContent = text;
    this.el.killfeed.appendChild(d);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.removeChild(this.el.killfeed.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4200);
  },

  toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 2300);
  },

  setScope(on) {
    this.el.scope.classList.toggle('hidden', !on);
    this.el.hud.classList.toggle('scoped', on);
  },

  update(game) {
    const p = game.player;
    // 生命 / 护甲
    this.el.hpFill.style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
    this.el.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.el.armorFill.style.width = (p.maxArmor > 0 ? clamp(p.armor / p.maxArmor * 100, 0, 100) : 0) + '%';
    this.el.armorText.textContent = `护甲 ${Math.round(p.armor)}${p.maxArmor ? ' / ' + p.maxArmor : ''}`;
    this.el.moneyVal.textContent = fmtMoney(p.money);
    this.el.killsVal.textContent = `击杀 ${p.kills}`;
    this.el.headshotVal.textContent = `爆头 ${p.headshots}`;
    // 医疗包
    const mk = document.getElementById('medkit-count');
    if (mk) {
      mk.textContent = p.medkits;
      mk.parentElement.classList.toggle('empty', p.medkits <= 0);
    }

    // 武器
    const w = game.weapons.w;
    if (w) {
      this.el.weaponName.textContent = w.def.name + (w.lvl ? ` Lv.${w.lvl}` : '');
      this.el.weaponName.className = w.lvl ? ('wpn-lv' + w.lvl) : '';
      if (w.def.melee) {
        this.el.ammoMag.textContent = '∞';
        this.el.ammoMag.className = '';
        this.el.ammoReserve.textContent = '';
      } else {
        this.el.ammoMag.textContent = w.mag;
        this.el.ammoReserve.textContent = '/ ' + w.reserve;
        this.el.ammoMag.className = w.mag === 0 ? 'empty' : (w.mag <= w.def.mag * 0.3 ? 'low' : '');
      }
    }
    for (const s of this.el.slots) {
      const slot = s.dataset.slot;
      const inst = p.weapons[slot];
      s.innerHTML = `<b>${slot === 'primary' ? 1 : slot === 'secondary' ? 2 : 3}</b> ${inst ? inst.def.name : '—'}`;
      s.classList.toggle('active', p.current === slot);
    }
    this.el.throwFrag.innerHTML = `💣 ×${p.throwables.frag.count} <i>${INPUT.touch ? '💣键' : '[G]'}</i>`;
    this.el.throwMolo.innerHTML = `🔥 ×${p.throwables.molotov.count} <i>${INPUT.touch ? '🧪键' : '[T]'}</i>`;

    // 模式信息
    if (game.mode) {
      const info = game.mode.getTopInfo();
      this.el.waveLabel.textContent = info.wave;
      this.el.objectiveLabel.textContent = info.objective;
    }

    // 屏幕效果
    this._dmgFlash = Math.max(0, this._dmgFlash - 0.028);
    const lowK = p.alive ? clamp(1 - p.hp / 38, 0, 1) : 0.9;
    this.el.vignette.style.opacity = clamp(this._dmgFlash * 0.9 + lowK * 0.45, 0, 0.95);
    this.el.lowHp.classList.toggle('hidden', p.hp > 30 || !p.alive);

    // 换弹提示
    const showReload = w && !w.def.melee && w.mag === 0 && game.weapons.reloadT <= 0 && w.reserve > 0;
    this.el.reloadHint.classList.toggle('hidden', !showReload);

    // 交互提示
    if (game.interactText) {
      this.el.interact.textContent = game.interactText;
      this.el.interact.classList.remove('hidden');
    } else this.el.interact.classList.add('hidden');

    // FPS + GPU draw call 统计
    const gs = ENGINE.gpuStats();
    this.el.fps.textContent = `${Math.round(ENGINE._fpsEma)} FPS · ${gs.calls}dc`;

    // 队友列表（联机）
    if (typeof NET !== 'undefined' && NET.role !== 'off') {
      const tl = document.getElementById('team-list');
      const rows = [];
      if (game.player) rows.push(`<div class="tm me"><b>${NET.myName}</b><span>${Math.ceil(game.player.hp)}HP</span></div>`);
      for (const id in NET.remote) {
        const r = NET.remote[id];
        rows.push(`<div class="tm"><b>${r.name}</b><span>${Math.max(0, Math.round(r.hp))}HP</span></div>`);
      }
      if (rows.length > 1) {
        tl.innerHTML = rows.join('');
        tl.classList.remove('hidden');
      } else tl.classList.add('hidden');
    }

    // 准星随ADS收拢 + 开火扩散
    const ch = document.getElementById('crosshair');
    ch.style.opacity = (game.weapons.adsT > 0.85 && w && w.def.scope) ? '0' : '1';
    const gap = 6 + (w && !w.def.melee ? game.weapons.adsT * -4 : 0) + (p.moving ? 3 : 0)
      + (game.weapons._fireKick || 0) * 7;
    for (const c of ch.children) {
      if (c.classList.contains('ch-t')) c.style.top = `-${gap + 8}px`;
      if (c.classList.contains('ch-b')) c.style.top = `${gap}px`;
      if (c.classList.contains('ch-l')) c.style.left = `-${gap + 8}px`;
      if (c.classList.contains('ch-r')) c.style.left = `${gap}px`;
    }

    this._drawRadar(game);
  },

  _drawRadar(game) {
    const ctx = this.radarCtx;
    const S = 150, c = S / 2;
    const R = GAMECONFIG.radar.range;
    const scale = (c - 8) / R;
    const p = game.player;
    ctx.clearRect(0, 0, S, S);

    if (ENGINE.mapDef) {
      const bz = ENGINE.mapDef.buyZone;
      const dx = (bz.x - p.pos.x) * scale, dz = (bz.z - p.pos.z) * scale;
      if (Math.abs(dx) < c && Math.abs(dz) < c) {
        ctx.strokeStyle = 'rgba(82,183,136,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c + dx, c + dz, Math.max(3, bz.r * scale), 0, TAU);
        ctx.stroke();
      }
      for (const z of game.zombies) {
        if (z.dead || z.state === 'rise') continue;
        const zx = (z.pos.x - p.pos.x) * scale, zz = (z.pos.z - p.pos.z) * scale;
        if (Math.abs(zx) > c - 4 || Math.abs(zz) > c - 4) continue;
        let color = '#ff5555', size = 2.2;
        if (z.type.big) { color = '#ff2222'; size = 3.6; }
        else if (z.typeId === 'screamer') { color = '#ffd23f'; size = 2.8; }
        else if (z.typeId === 'spitter') { color = '#7dff5a'; size = 2.4; }
        else if (z.typeId === 'armored') { color = '#ffaa33'; size = 2.6; }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c + zx, c + zz, size, 0, TAU);
        ctx.fill();
      }
      // 补给箱雷达标记（引导探索）
      if (game.crates) {
        for (const c of game.crates) {
          if (c.opened) continue;
          const cx = (c.x - p.pos.x) * scale, cz = (c.z - p.pos.z) * scale;
          if (Math.abs(cx) > c - 5 || Math.abs(cz) > c - 5) continue;
          ctx.fillStyle = c.tier === 'elite' ? '#b05cff' : '#3aa0ff';
          ctx.fillRect(c + cx - 2.5, c + cz - 2.5, 5, 5);
        }
      }
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + fx * 8, c + fz * 8);
      ctx.stroke();
      ctx.fillStyle = '#7CFC9A';
      ctx.beginPath();
      ctx.arc(c, c, 2.4, 0, TAU);
      ctx.fill();
    }
  },
};
