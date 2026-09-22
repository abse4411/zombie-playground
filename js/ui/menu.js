/* ============================================================
 * 菜单系统 —— 主菜单 / 任务与地图选择 / 图鉴 / 设置 / 暂停
 * ============================================================ */
const MENU = {
  game: null, diff: 'normal', missionDiff: 'normal', settingsFrom: 'menu', codexTab: 'zombies',
  screens: {},

  init(game) {
    this.game = game;
    document.querySelectorAll('.screen').forEach(s => { this.screens[s.id] = s; });

    const $ = id => document.getElementById(id);
    $('btn-encounter').addEventListener('click', () => { AUDIO.uiClick(); this.buildMissionCards(); this.show('screen-missions'); });
    $('btn-hunt').addEventListener('click', () => { AUDIO.uiClick(); this.buildMapCards(); this.show('screen-maps'); });
    // 继续狩猎（v14.3）：存在狩猎存档时显示进度入口
    const cont = $('btn-continue');
    cont.addEventListener('click', () => { AUDIO.uiClick(); this.hideAll(); GAME.continueHunt(); });
    this.refreshContinue = () => {
      const sv = SAVE.data && SAVE.data.huntSave;
      cont.classList.toggle('hidden', !sv);
      if (sv) {
        const mapName = MAPS[sv.map] ? MAPS[sv.map].name : sv.map;
        cont.textContent = `📂 继续狩猎 · ${mapName} 第 ${sv.wave} 波`;
      }
    };
    this.refreshContinue();
    $('btn-tutorial').addEventListener('click', () => { AUDIO.uiClick(); GAME.startTutorial(); });
    $('btn-character').addEventListener('click', () => { AUDIO.uiClick(); this.show('screen-character'); CHARPREVIEW.init(document.getElementById('char-canvas')); CHARPREVIEW.show(SAVE.data.character || 'raven'); this.buildCharCards(); });
    $('btn-net').addEventListener('click', () => { AUDIO.uiClick(); this.show('screen-net'); this.initNetUI(); });
    $('btn-meta').addEventListener('click', () => { AUDIO.uiClick(); this.buildMeta(); this.show('screen-meta'); });
    $('btn-codex').addEventListener('click', () => { AUDIO.uiClick(); this.buildCodex(); this.show('screen-codex'); });
    $('btn-help').addEventListener('click', () => { AUDIO.uiClick(); this.show('screen-help'); });
    $('btn-settings').addEventListener('click', () => { AUDIO.uiClick(); this.settingsFrom = 'menu'; this.show('screen-settings'); });

    // 画质档位
    const qBtns = document.querySelectorAll('.q-btn');
    const savedQ = SAVE.data.settings.quality || 'auto';
    qBtns.forEach(b => b.classList.toggle('active', b.dataset.q === savedQ));
    qBtns.forEach(b => b.addEventListener('click', () => {
      const q = b.dataset.q;
      ENGINE.autoMode = (q === 'auto');
      ENGINE.setQuality(q);
      qBtns.forEach(x => x.classList.toggle('active', x === b));
      AUDIO.uiClick();
      HUD.toast(`画质：${GAMECONFIG.quality[q] ? GAMECONFIG.quality[q].name : '自动'}`);
    }));

    document.querySelectorAll('.btn-back').forEach(b =>
      b.addEventListener('click', () => { AUDIO.uiClick(); this.show('screen-menu'); }));

    // 存档管理（v19.4）：导出文件 / 导入文件 / 清空
    $('btn-save-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(SAVE.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      a.href = URL.createObjectURL(blob);
      a.download = `zombie-playground-save-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      AUDIO.uiClick();
      HUD.toast('💾 存档已导出到下载目录');
    });
    $('btn-save-import').addEventListener('click', () => {
      if (GAME.state !== 'menu') { HUD.toast('请先退回主菜单再导入存档'); AUDIO.denied(); return; }
      $('save-file-input').click();
    });
    $('save-file-input').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result).trim();
          let obj = null;
          try { obj = JSON.parse(text); } catch (e1) { obj = null; }
          if (obj && typeof obj === 'object' && obj.settings !== undefined) {
            SAVE.data = Object.assign(SAVE.defaults(), obj);   // 新版 JSON 存档文件
          } else {
            SAVE.import(text);   // 兼容旧版 base64 导出码
          }
          SAVE.commit();
          AUDIO.purchase();
          HUD.toast('✅ 存档已导入');
          this.refreshContinue(); this.refreshStats();
        } catch (err) {
          AUDIO.denied();
          HUD.toast('❌ 导入失败：' + (err.message || '格式无效'));
        }
      };
      reader.onerror = () => { AUDIO.denied(); HUD.toast('❌ 文件读取失败'); };
      reader.readAsText(f);
    });
    let clearArmed = false;
    $('btn-save-clear').addEventListener('click', () => {
      if (GAME.state !== 'menu') { HUD.toast('请先退回主菜单再清空存档'); AUDIO.denied(); return; }
      if (!clearArmed) {
        clearArmed = true;
        $('btn-save-clear').textContent = '⚠ 再点一次确认清空';
        AUDIO.emptyClick();
        setTimeout(() => { clearArmed = false; $('btn-save-clear').textContent = '🗑 清空全部存档'; }, 3000);
        return;
      }
      clearArmed = false;
      $('btn-save-clear').textContent = '🗑 清空全部存档';
      localStorage.removeItem(SAVE.key);
      SAVE.data = SAVE.defaults();
      SAVE.commit();
      AUDIO.uiClick();
      HUD.toast('🗑 存档已全部清空');
      this.refreshContinue(); this.refreshStats();
    });

    // 难度（狩猎）：切换时刷新难度介绍栏
    document.querySelectorAll('#difficulty-row .diff-btn').forEach(b =>
      b.addEventListener('click', () => {
        this.diff = b.dataset.diff;
        document.querySelectorAll('#difficulty-row .diff-btn').forEach(x => x.classList.toggle('active', x === b));
        this.refreshDiffInfo();
        AUDIO.uiClick();
      }));
    document.querySelector('#difficulty-row .diff-btn[data-diff="normal"]').classList.add('active');
    // 遭遇战难度（v8.5）：独立记忆
    document.querySelectorAll('#difficulty-row2 .diff2-btn').forEach(b =>
      b.addEventListener('click', () => {
        this.missionDiff = b.dataset.diff;
        document.querySelectorAll('#difficulty-row2 .diff2-btn').forEach(x => x.classList.toggle('active', x === b));
        AUDIO.uiClick();
      }));
    document.querySelector('#difficulty-row2 .diff2-btn[data-diff="normal"]').classList.add('active');

    // 图鉴页签
    document.querySelectorAll('.codex-tab').forEach(b =>
      b.addEventListener('click', () => {
        this.codexTab = b.dataset.tab;
        document.querySelectorAll('.codex-tab').forEach(x => x.classList.toggle('active', x === b));
        this.buildCodex();
        AUDIO.uiClick();
      }));

    // 设置
    const sens = $('sens-slider'), vol = $('vol-slider');
    sens.value = SAVE.data.settings.sens;
    vol.value = SAVE.data.settings.volume;
    $('sens-val').textContent = Number(SAVE.data.settings.sens).toFixed(2);
    $('vol-val').textContent = Math.round(SAVE.data.settings.volume * 100) + '%';
    sens.addEventListener('input', () => {
      SAVE.data.settings.sens = parseFloat(sens.value);
      $('sens-val').textContent = parseFloat(sens.value).toFixed(2);
      SAVE.commit();
    });
    vol.addEventListener('input', () => {
      SAVE.data.settings.volume = parseFloat(vol.value);
      $('vol-val').textContent = Math.round(parseFloat(vol.value) * 100) + '%';
      AUDIO.setVolume(SAVE.data.settings.volume);
      SAVE.commit();
    });
    $('settings-back').addEventListener('click', () => {
      AUDIO.uiClick();
      this.show(this.settingsFrom === 'pause' ? 'screen-pause' : 'screen-menu');
    });

    // 触屏灵敏度
    const tsens = $('tsens-slider');
    if (tsens) {
      tsens.value = SAVE.data.settings.touchSens || 1;
      $('tsens-val').textContent = Number(SAVE.data.settings.touchSens || 1).toFixed(2);
      tsens.addEventListener('input', () => {
        SAVE.data.settings.touchSens = parseFloat(tsens.value);
        $('tsens-val').textContent = parseFloat(tsens.value).toFixed(2);
        SAVE.commit();
      });
    }
    // 狙击开镜灵敏度
    const ssens = $('scopesens-slider');
    if (ssens) {
      ssens.value = SAVE.data.settings.scopeSens !== undefined ? SAVE.data.settings.scopeSens : 0.7;
      $('scopesens-val').textContent = parseFloat(ssens.value).toFixed(2);
      ssens.addEventListener('input', () => {
        SAVE.data.settings.scopeSens = +ssens.value;
        $('scopesens-val').textContent = parseFloat(ssens.value).toFixed(2);
        SAVE.commit();
      });
    }
    // 帧率上限
/* 左上角性能监控开关（v21.0） */
    const refreshPerf = () => {
      const on = SAVE.data.settings.showPerf !== false;
      document.querySelectorAll('.perf-btn').forEach(b => b.classList.toggle('active', (b.dataset.pf === '1') === on));
      const el = document.getElementById('fps-counter');
      if (el) el.style.display = on ? '' : 'none';
    };
    document.querySelectorAll('.perf-btn').forEach(b => b.addEventListener('click', () => {
      SAVE.data.settings.showPerf = b.dataset.pf === '1';
      SAVE.commit(); AUDIO.uiClick(); refreshPerf();
    }));
    refreshPerf();
        const fBtns = document.querySelectorAll('.fcap-btn');
    const setFcapActive = () => fBtns.forEach(b => b.classList.toggle('active', +b.dataset.fc === (SAVE.data.settings.fpsCap || 0)));
    setFcapActive();
    fBtns.forEach(b => b.addEventListener('click', () => {
      SAVE.data.settings.fpsCap = +b.dataset.fc;
      SAVE.commit();
      setFcapActive();
      AUDIO.uiClick();
    }));
    // 自动装填开关
    const arBtns = document.querySelectorAll('.ar-btn');
    const setArActive = () => arBtns.forEach(b => b.classList.toggle('active', (b.dataset.ar === '1') !== (SAVE.data.settings.autoReload === false)));
    setArActive();
    arBtns.forEach(b => b.addEventListener('click', () => {
      SAVE.data.settings.autoReload = b.dataset.ar === '1';
      SAVE.commit();
      setArActive();
      AUDIO.uiClick();
    }));
    // 外观系统
    const cBtns = document.querySelectorAll('.cmo-btn');
    const setCam = () => cBtns.forEach(b => b.classList.toggle('active', b.dataset.c === (SAVE.data.camo || 'default')));
    setCam();
    cBtns.forEach(b => b.addEventListener('click', () => {
      SAVE.data.camo = b.dataset.c; SAVE.commit(); setCam(); AUDIO.uiClick();
      if (GAME.weapons) GAME.weapons._buildViewmodel();
    }));
    const sBtns = document.querySelectorAll('.sk-btn');
    const setSk = () => sBtns.forEach(b => b.classList.toggle('active', b.dataset.s === (SAVE.data.skin || 'default')));
    setSk();
    sBtns.forEach(b => b.addEventListener('click', () => {
      SAVE.data.skin = b.dataset.s; SAVE.commit(); setSk(); AUDIO.uiClick();
    }));

    // 存档导出 / 导入
    const io = $('save-io');
    $('btn-save-export').addEventListener('click', () => {
      io.value = SAVE.export();
      io.select();
      HUD.toast('存档码已生成，复制文本框内容保存');
      AUDIO.uiClick();
    });
    $('btn-save-import').addEventListener('click', () => {
      try {
        SAVE.import(io.value);
        HUD.toast('✔ 存档导入成功');
        AUDIO.purchase();
        this.refreshStats();
        this.show('screen-menu');
      } catch (e) {
        HUD.toast('✖ 存档码无效');
        AUDIO.denied();
      }
    });

    // 暂停
    $('btn-resume').addEventListener('click', () => { AUDIO.uiClick(); GAME.resume(); });
    $('btn-restart').addEventListener('click', () => { AUDIO.uiClick(); this.hideAll(); GAME.restart(); });
    $('btn-pause-settings').addEventListener('click', () => { AUDIO.uiClick(); this.settingsFrom = 'pause'; this.show('screen-settings'); });
    $('btn-savequit').addEventListener('click', () => { AUDIO.uiClick(); this.hideAll(); GAME.saveQuitHunt(); });
    $('btn-quit').addEventListener('click', () => { AUDIO.uiClick(); GAME.clearHuntSave(); GAME.quitToMenu(); });

    // 结算
    $('btn-retry').addEventListener('click', () => { AUDIO.uiClick(); this.hideAll(); GAME.restart(); });
    $('btn-over-quit').addEventListener('click', () => { AUDIO.uiClick(); GAME.quitToMenu(); });
    $('btn-vic-quit').addEventListener('click', () => { AUDIO.uiClick(); GAME.quitToMenu(); });
    $('btn-vic-next').addEventListener('click', () => {
      AUDIO.uiClick();
      const next = (GAME.mode && GAME.mode.idx !== undefined) ? GAME.mode.idx + 1 : 0;
      const nextM = MISSIONS[next];
      this.hideAll();
      if (next < MISSIONS.length && nextM && !nextM.spinoff) GAME.startMission(next);
      else GAME.quitToMenu();
    });

    this.refreshStats();
  },

  show(id) {
    if (id === 'screen-menu' && typeof MENUSCENE !== 'undefined') {
      requestAnimationFrame(() => { MENUSCENE.init(document.getElementById('menu-bg')); MENUSCENE.syncHero(); });
    }
    this.hideAll();
    if (this.screens[id]) this.screens[id].classList.remove('hidden');
  },
  hideAll() { for (const k in this.screens) this.screens[k].classList.add('hidden'); },
  showPause() { this.show('screen-pause'); },

  /* ---------- 联机界面 ---------- */
  initNetUI() {
    const $ = id => document.getElementById(id);
    const url = $('net-url');
    if (!url.value) {
      url.value = location.protocol === 'http:' || location.protocol === 'https:'
        ? `ws://${location.host}` : `ws://localhost:8080`;
    }
    $('net-name').value = SAVE.data.playerName || '';
    $('net-setup').classList.remove('hidden');
    $('net-room').classList.add('hidden');

    // 地图下拉
    const sel = $('net-map');
    if (!sel.options.length) {
      for (const id in MAPS) {
        const o = document.createElement('option');
        o.value = id; o.textContent = MAPS[id].name;
        sel.appendChild(o);
      }
    }

    const doConnect = wantHost => {
      const name = ($('net-name').value || '战士').slice(0, 10);
      SAVE.data.playerName = name; SAVE.commit();
      NET.connect(url.value.trim(), name, wantHost, err => {
        if (err) { HUD.toast('✖ ' + err); AUDIO.denied(); return; }
      });
    };
    $('btn-net-host').onclick = () => doConnect(true);
    $('btn-net-join').onclick = () => doConnect(false);

    if (!$('btn-net-start').dataset.bound) {
      $('btn-net-start').dataset.bound = '1';
      $('btn-net-start').addEventListener('click', () => {
        NET.send({ t: 'start', mode: 'hunt', map: $('net-map').value, diff: $('net-diff').value });
        AUDIO.uiClick();
      });
    }
    this.refreshNetUI();
  },

  refreshNetUI() {
    const room = document.getElementById('net-room');
    if (!room || typeof NET === 'undefined' || NET.role === 'off') return;
    room.classList.remove('hidden');
    document.getElementById('net-setup').classList.add('hidden');
    document.getElementById('net-room-list').innerHTML =
      NET.room.map(c => `<div class="net-member">${c.host ? '🏠' : '🤝'} ${c.name}${c.id === NET.myId ? '（你）' : ''}</div>`).join('');
    const isHost = NET.role === 'host';
    document.getElementById('net-host-ctrl').classList.toggle('hidden', !isHost);
    document.getElementById('net-wait').classList.toggle('hidden', isHost);
  },

  /* ---------- 角色选择卡片 ---------- */
  buildCharCards() {
    const list = document.getElementById('char-list');
    list.innerHTML = '';
    const cur = SAVE.data.character || 'raven';
    const unlockedChars = SAVE.data.unlockedChars || ['raven', 'nightingale', 'bastion', 'apricot'];
    for (const c of CHARACTERS) {
      const locked = !unlockedChars.includes(c.id);
      const card = document.createElement('div');
      card.className = 'card char-card' + (c.id === cur ? ' char-active' : '') + (locked ? ' char-locked' : '');
      const achv = c.unlockBy ? ACHIEVEMENTS.find(a => a.id === c.unlockBy) : null;
      const sl = c.slots || { primary: 2, secondary: 1, melee: 1 };
      card.innerHTML = `
        <h3>${locked ? '🔒 ' : ''}${c.gender === '女' ? '♀' : '♂'} ${c.name} · ${c.prof}</h3>
        <div class="char-stats">
          <span>❤ 生命 <b>${c.hp}</b></span>
          <span>🏃 速度 <b>×${c.speed.toFixed(2)}</b></span>
          <span>↻ 换弹 <b>×${c.reload.toFixed(2)}</b></span>
          ${c.armorStart ? `<span>🛡 初始护甲 <b>${c.armorStart}</b></span>` : ''}
          ${c.medkits !== 2 ? `<span>🧪 医疗包 <b>${c.medkits}</b></span>` : ''}
          <span>💢 伤害 <b>×${c.dmg.toFixed(2)}</b></span>
          ${c.staminaMax !== undefined ? `<span>💨 体力 <b>${c.staminaMax}</b></span><span>⚡ 回复 <b>×${(c.staminaRegen || 1).toFixed(2)}</b></span>` : ''}
          <span>🎯 栏位 <b>主${sl.primary}/副${sl.secondary}/近${sl.melee}</b></span>
        </div>
        ${locked
          ? `<p style="color:#ff8f9f">🔒 成就解锁：${achv ? achv.name + ' — ' + achv.desc : '???'}</p>`
          : (c.passiveText ? `<p style="color:#8ad8ff">★ ${c.passiveText}</p>` : '')}
        <p>${c.desc}</p>`;
      card.addEventListener('click', () => {
        if (locked) { AUDIO.denied(); HUD.toast(`🔒 完成「${achv ? achv.name : '?'}」成就解锁 ${c.name}`); return; }
        SAVE.data.character = c.id; SAVE.commit();
        AUDIO.purchase();
        CHARPREVIEW.show(c.id);
        this.buildCharCards();
      });
      list.appendChild(card);
    }
  },

  /* ---------- 任务卡片（v5.1 三幕+番外分组） ---------- */
  buildMissionCards() {
    const list = document.getElementById('mission-list');
    list.innerHTML = '';
    // 分组容错（v14.4）：按数据动态建组，未知幕次自动归入番外后追加，避免 groups[key] 未定义崩溃
    const ACTS = { 1: '🎬 第一幕 · 滨港（初代）', 2: '🎬 第二幕 · 极夜回声（二代）', 3: '🎬 第三幕 · 泄源追迹（终局）', 0: '📞 番外篇 · 他们也曾是普通人' };
    const groups = {};
    MISSIONS.forEach((m, i) => {
      const key = m.act === undefined ? 1 : m.act;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ m, i });
    });
    const actOrder = [1, 2, 3].filter(k => groups[k]).concat(Object.keys(groups).filter(k => !(k in ACTS) && k !== '1' && k !== '2' && k !== '3'));
    for (const actKey of actOrder.concat([0])) {
      const items = groups[actKey];
      if (!items.length) continue;
      const head = document.createElement('div');
      head.className = 'act-header';
      head.style.gridColumn = '1 / -1';
      head.innerHTML = `<h3 style="color:var(--red);letter-spacing:4px;text-align:left;margin:8px 0 2px">${ACTS[actKey]}</h3>`;
      list.appendChild(head);
      for (const { m, i } of items) {
        const isSpin = !!m.spinoff;
        const locked = isSpin ? SAVE.data.missionsDone < m.reqDone : i > SAVE.data.missionsDone;
        const done = isSpin ? SAVE.data.spinoffsDone?.[m.id] : i < SAVE.data.missionsDone;
        const rating = (SAVE.data.bestRating || {})[i];
        const card = document.createElement('div');
        card.className = 'card' + (locked ? ' locked' : '');
        card.innerHTML = `
          ${rating ? `<span class="card-rating rating-${rating}">${rating}</span>` : ''}
          ${done ? '<span class="card-done">✔ 已完成</span>' : locked ? '<span class="card-lock">🔒</span>' : ''}
          <h3>${m.name}${this.missionDiff !== 'normal' ? ` <span style="font-size:12px;color:${this.missionDiff === 'nightmare' ? '#ff5a5a' : '#ffb044'}">[${this.missionDiff === 'nightmare' ? '噩梦' : '困难'}]</span>` : ''}</h3>
          <div class="card-map">📍 ${(MAPS[m.map] || { name: m.map }).name} · ⏱ ${fmtTime(m.duration)}${isSpin ? ' · 番外剧情' : ''}</div>
          <p>${locked && isSpin ? `🔒 完成主战役第 ${m.reqDone} 章后解锁` : m.brief}</p>
        `;
        if (!locked) card.addEventListener('click', () => { AUDIO.uiClick(); GAME.startMission(i, false, this.missionDiff); });
        list.appendChild(card);
      }
    }
    // 世界观背景
    const bg = document.createElement('div');
    bg.className = 'card';
    bg.style.gridColumn = '1 / -1';
    bg.innerHTML = `<h3>战役背景 · 赤潮事件</h3>
      <p>2026年10月，军方代号“游乐园”的生物实验设施发生泄漏，“赤潮病毒”一夜之间席卷滨港市。雇佣兵“渡鸦”受幸存者组织“黎明会”委托，深入疫区执行任务——而泄漏的真相，远比表面更深。完整设定见 WORLD.md。</p>`;
    list.appendChild(bg);
  },

  /* ---------- 狩猎难度介绍（v17.1） ---------- */
  refreshDiffInfo() {
    const box = document.getElementById('diff-info');
    if (!box) return;
    const d = DIFFICULTIES[this.diff];
    if (!d) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const name = document.getElementById('diff-info-name');
    name.textContent = d.name;
    name.style.color = d.color || '#fff';
    document.getElementById('diff-info-tag').textContent = `— ${d.tag || ''}`;
    document.getElementById('diff-info-stats').innerHTML =
      `<span>敌人生命 <b>×${d.hp.toFixed(2)}</b></span>` +
      `<span>敌人伤害 <b>×${d.dmg.toFixed(2)}</b></span>` +
      `<span>移动速度 <b>×${d.speed.toFixed(2)}</b></span>` +
      `<span>赏金收益 <b>×${d.reward.toFixed(2)}</b></span>`;
    document.getElementById('diff-info-desc').textContent = d.desc || '';
  },

  /* ---------- 地图卡片 ---------- */
  async buildMapCards() {
    const list = document.getElementById('map-list');
    list.innerHTML = '';
    document.getElementById('difficulty-row').classList.remove('hidden');
    this.refreshDiffInfo();
    document.getElementById('maps-title').textContent = '狩猎模式 · 选择猎场';
    for (const id in MAPS) {
      const m = MAPS[id];
      const best = SAVE.data.bestWave[id] || 0;
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.mapId = id;
      card.innerHTML = `
        <canvas width="252" height="120"></canvas>
        <h3>${m.name}</h3>
        <div class="card-map">${m.subtitle}</div>
        <p>${m.desc}</p>
        ${best ? `<div class="best-tag">🏆 最高纪录：第 ${best} 波</div>` : ''}
      `;
      card.addEventListener('click', () => { AUDIO.uiClick(); GAME.startHunt(id, this.diff); });
      list.appendChild(card);
    }
    // 懒加载（v12.1）：进入本页才拉取各猎场完整数据（画缩略图需要 props），逐张绘制
    const ids = Object.keys(MAPS);
    await RES.preloadMaps(ids, id => {
      const card = list.querySelector(`[data-map-id="${id}"]`);
      if (card) drawMapPreview(card.querySelector('canvas'), MAPS[id]);
    });
  },

  /* ---------- 强化实验室（v10.8 元进度） ---------- */
  buildMeta() {
    if (!SAVE.data.meta) SAVE.data.meta = { sp: 0, levels: {} };
    document.querySelector('#meta-sp b').textContent = SAVE.data.meta.sp;
    const grid = document.getElementById('meta-grid');
    grid.innerHTML = '';
    for (const k of META_PERKS) {
      const lv = META.lv(k.id);
      const maxed = lv >= k.max;
      const cost = maxed ? 0 : k.cost(lv);
      const afford = !maxed && SAVE.data.meta.sp >= cost;
      const c = document.createElement('div');
      c.className = 'codex-card meta-card' + (afford ? ' afford' : '');
      c.innerHTML = `
        <h4>${k.icon} ${k.name} <span class="lu-lv">${lv}/${k.max}</span></h4>
        <p>${k.desc(lv + (maxed ? 0 : 1))}</p>
        <div class="meta-cost">${maxed ? '✔ 已满级' : `消耗 <b>${cost}</b> SP`}</div>`;
      c.addEventListener('click', () => {
        if (META.buy(k.id)) { AUDIO.uiClick(); this.buildMeta(); }
        else AUDIO.denied();
      });
      grid.appendChild(c);
    }
  },

  /* ---------- 图鉴（v17.1：左侧模型+详细数据栏，右侧卡片列表） ---------- */
  _pvSet(o) {
    document.getElementById('codex-pv-name').textContent = o.name || '—';
    document.getElementById('codex-pv-role').textContent = o.role || '';
    document.getElementById('codex-pv-stats').innerHTML =
      (o.stats || []).map(([k, v]) => `<div class="pv-stat"><span>${k}</span><b>${v}</b></div>`).join('');
    document.getElementById('codex-pv-desc').textContent = o.desc || '';
  },
  _pvReset() {
    this._pvSet({ name: '点击右侧卡片查看 3D 模型', desc: '模型自动旋转展示' });
    CODEXPREVIEW._clear();
    CODEXPREVIEW.renderSync();
  },

  buildCodex() {
    const box = document.getElementById('codex-content');
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'codex-grid';

    CODEXPREVIEW.init(document.getElementById('codex-canvas'));
    this._pvReset();
    if (this.codexTab === 'zombies') {
      for (const id in ZOMBIE_TYPES) {
        const z = ZOMBIE_TYPES[id];
        const c = document.createElement('div');
        c.className = 'codex-card';
        const hex = '#' + z.skin.toString(16).padStart(6, '0');
        c.innerHTML = `
          <h4><span class="codex-dot" style="background:${hex};color:${hex}"></span>${z.name}</h4>
          <div class="cx-role">${z.role}${z.parkOnly ? ' · 仅游乐园出没' : ''}</div>
          <p>${z.desc}</p>
          <div class="cx-stats">
            <span>生命 <b>${z.hp}</b></span><span>速度 <b>${z.speed} m/s</b></span>
            <span>伤害 <b>${z.damage || '自爆'}</b></span><span>赏金 <b>$${z.reward}</b></span>
            <span>出场 <b>第${z.minWave}波+</b></span><span>威胁 <b>${z.cost >= 3 ? '极高' : z.cost >= 2 ? '高' : '中'}</b></span>
          </div>`;
        c.addEventListener('click', () => {
          AUDIO.uiClick();
          this._pvSet({
            name: z.name,
            role: z.role + (z.parkOnly ? ' · 仅游乐园出没' : '') + (z.human ? ' · 人类敌人' : '') + (z.mutate ? ' · 可变异' : ''),
            stats: [
              ['生命', z.hp], ['速度', z.speed + ' m/s'],
              ['伤害', z.damage || '自爆'], ['赏金', '$' + z.reward],
              ['出场', '第' + z.minWave + '波+'], ['威胁', z.cost >= 3 ? '极高' : z.cost >= 2 ? '高' : '中'],
            ],
            desc: z.desc,
          });
          CODEXPREVIEW.showZombie(id);
          CODEXPREVIEW.renderSync();
        });
        grid.appendChild(c);
      }
    } else if (this.codexTab === 'weapons') {
      const groups = [['primary', '主武器'], ['secondary', '副武器'], ['melee', '近战武器']];
      for (const [slot, label] of groups) {
        for (const id in WEAPONS) {
          const w = WEAPONS[id];
          if (w.slot !== slot) continue;
          const c = document.createElement('div');
          c.className = 'codex-card';
          const hex = '#' + w.color.toString(16).padStart(6, '0');
          const stats = w.melee
            ? `<span>伤害 <b>${w.damage}</b></span><span>攻速 <b>${w.rpm / 10}</b></span><span>范围 <b>${w.range}m</b></span><span>价格 <b>${w.price ? '$' + w.price : '初始'}</b></span>`
            : `<span>伤害 <b>${w.damage}${w.pellets > 1 ? '×' + w.pellets : ''}</b></span><span>射速 <b>${w.rpm}/分</b></span><span>弹匣 <b>${w.mag}</b></span><span>价格 <b>${w.price ? '$' + w.price : '初始'}</b></span>`;
          c.innerHTML = `
            <h4><span class="codex-dot" style="background:${hex};color:${hex}"></span>${w.name}</h4>
            <div class="cx-role">${label}${w.unlockBy ? ' · 成就专属' : ''}</div>
            <p>${w.desc}</p>
            <div class="cx-stats">${stats}</div>`;
          c.addEventListener('click', () => {
            AUDIO.uiClick();
            const price = w.price ? '$' + w.price : '初始';
            this._pvSet({
              name: w.name,
              role: label + (w.unlockBy ? ' · 成就专属' : ''),
              stats: w.melee
                ? [['伤害', w.damage], ['攻速', w.rpm / 10], ['范围', w.range + ' m'], ['价格', price]]
                : [['伤害', w.damage + (w.pellets > 1 ? '×' + w.pellets : '')], ['爆头', '×' + (w.headMult || 2)],
                  ['射速', w.rpm + ' /分'], ['弹匣', w.mag],
                  ['射程', w.range + ' m'], ['换弹', (w.reloadTime || 0) + ' s'],
                  ['备弹上限', w.reserveMax || w.reserve || '—'], ['价格', price]],
              desc: w.desc,
            });
            CODEXPREVIEW.showWeapon(w);
            CODEXPREVIEW.renderSync();
          });
          grid.appendChild(c);
        }
      }
      for (const id in THROWABLES) {
        const t = THROWABLES[id];
        const c = document.createElement('div');
        c.className = 'codex-card';
        c.innerHTML = `
          <h4><span class="codex-dot" style="background:#ff7733;color:#ff7733"></span>${t.name}</h4>
          <div class="cx-role">投掷武器 · 按 [4] 掏出，左键蓄力投掷</div>
          <p>${t.desc}</p>
          <div class="cx-stats">
            <span>价格 <b>$${t.price} / ${t.pack}枚</b></span><span>携带上限 <b>${t.max}</b></span>
          </div>`;
        c.addEventListener('click', () => {
          AUDIO.uiClick();
          const tstats = [['价格', '$' + t.price + ' / ' + t.pack + '枚'], ['携带上限', t.max]];
          if (t.damage) tstats.push(['爆炸伤害', t.damage]);
          if (t.radius) tstats.push(['作用半径', t.radius + ' m']);
          if (t.dps) tstats.push(['灼烧 DPS', t.dps]);
          if (t.duration) tstats.push(['持续', t.duration + ' s']);
          this._pvSet({
            name: t.name,
            role: '投掷武器 · 按 [4] 掏出，左键蓄力投掷',
            stats: tstats,
            desc: t.desc,
          });
          CODEXPREVIEW.showThrowable(t.id);   // v20.9 修复：投掷物图鉴显示3D模型
          CODEXPREVIEW.renderSync();
        });
        grid.appendChild(c);
      }
    } else if (this.codexTab === 'achv') {
      const unlocked = SAVE.data.achievements || [];
      const TIER = { bronze: ['🥉', '#cd8f5a'], silver: ['🥈', '#c8d0da'], gold: ['🥇', '#ffd76a'], platinum: ['💎', '#8ad8ff'] };
      // 未成就筛选与统计头
      const got = unlocked.length, all = ACHIEVEMENTS.length;
      const stats = document.createElement('div');
      stats.className = 'codex-grid';
      stats.style.marginBottom = '14px';
      const d = SAVE.data;
      const cells = [
        ['累计击杀', d.totalKills], ['总场次', d.totalRuns],
        ['剧情进度', `${d.missionsDone}/${MISSIONS.length}`],
        ['狩猎最深', `${d.huntBest.wave || 0} 波`],
        ['成就', `${got}/${all}`],
        ['完成度', `${Math.round(got / all * 100)}%`],
      ];
      for (const [k, v] of cells) {
        const c = document.createElement('div');
        c.className = 'codex-card';
        c.innerHTML = `<h4 style="justify-content:center">${v}</h4><div class="cx-role" style="text-align:center;margin:4px 0 0">${k}</div>`;
        grid.appendChild(c);
      }
      box.appendChild(stats);
      // 分类小节渲染
      const CATS = [['combat', '⚔ 战斗'], ['survival', '🏕 生存'], ['explore', '🧭 探索'], ['story', '📖 剧情'], ['collect', '💰 收集']];
      for (const [catId, catName] of CATS) {
        const list = ACHIEVEMENTS.filter(a => a.cat === catId);
        const gotC = list.filter(a => unlocked.includes(a.id)).length;
        const h = document.createElement('h3');
        h.style.cssText = 'margin:14px 0 8px;color:#ffd76a';
        h.textContent = `${catName}（${gotC}/${list.length}）`;
        box.appendChild(h);
        const grid2 = document.createElement('div');
        grid2.className = 'codex-grid';
        for (const a of list) {
          const ok = unlocked.includes(a.id);
          const [ic, col] = TIER[a.tier];
          const c = document.createElement('div');
          c.className = 'codex-card' + (ok ? '' : ' achv-locked');
          let progHtml = '';
          if (!ok && a.goal) {
            const [cur, max] = ACHV.progress(a);
            const pct = Math.min(100, Math.round(cur / max * 100));
            progHtml = `<div style="margin-top:6px;height:6px;background:rgba(255,255,255,.12)"><div style="width:${pct}%;height:100%;background:${col}"></div></div><div style="font-size:11px;color:var(--dim);margin-top:3px">${cur} / ${max}</div>`;
          }
          c.innerHTML = `
            <h4>${ok ? ic : '🔒'} ${a.name}</h4>
            <div class="cx-role" style="color:${col}">${{ bronze: '铜', silver: '银', gold: '金', platinum: '白金' }[a.tier]}${ok ? ' · 已解锁' : ''}</div>
            <p style="margin:0">${a.desc}</p>${progHtml}`;
          c.addEventListener('click', () => {
            AUDIO.uiClick();
            this._pvSet({
              name: (ok ? ic : '🔒') + ' ' + a.name,
              role: { bronze: '铜质成就', silver: '银质成就', gold: '金质成就', platinum: '白金成就' }[a.tier] + (ok ? ' · 已解锁' : ' · 未解锁'),
              stats: [['分类', { combat: '战斗', survival: '生存', explore: '探索', story: '剧情', collect: '收集' }[a.cat] || a.cat]],
              desc: a.desc,
            });
            CODEXPREVIEW._clear();
            CODEXPREVIEW.renderSync();
          });
          grid2.appendChild(c);
        }
        box.appendChild(grid2);
      }
    } else if (false) {
      // （旧渲染已由上方分类渲染取代）
    } else {
      for (const id in PERKS) {
        const k = PERKS[id];
        const c = document.createElement('div');
        c.className = 'codex-card';
        c.innerHTML = `
          <h4><span class="codex-dot" style="background:#c05299;color:#c05299"></span>${k.icon} ${k.name}</h4>
          <div class="cx-role">强化针剂 · ${k.tiers.length}级</div>
          <p>${k.desc}</p>
          <div class="cx-stats">
            ${k.tiers.map((t, i) => `<span>Lv.${i + 1} <b>${k.valName(t.val)} · $${t.price}</b></span>`).join('')}
          </div>`;
        c.addEventListener('click', () => {
          AUDIO.uiClick();
          this._pvSet({
            name: k.icon + ' ' + k.name,
            role: '强化针剂 · ' + k.tiers.length + '级',
            stats: k.tiers.map((t, i) => ['Lv.' + (i + 1), k.valName(t.val) + ' · $' + t.price]),
            desc: k.desc,
          });
          CODEXPREVIEW._clear();
          CODEXPREVIEW.renderSync();
        });
        grid.appendChild(c);
      }
    }
    box.appendChild(grid);
  },

  /* ---------- 主菜单统计 ---------- */
  refreshStats() {
    const el = document.getElementById('menu-stats');
    const d = SAVE.data;
    el.innerHTML = `累计击杀 <b>${d.totalKills}</b> 只感染者 · 剧情进度 <b>${d.missionsDone}/${MISSIONS.length}</b> 章 · 狩猎最深 <b>${d.huntBest.wave || '—'}</b> 波（${d.huntBest.kills || 0} 杀）`;
  },
};
