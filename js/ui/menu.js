/* ============================================================
 * 菜单系统 —— 主菜单 / 任务与地图选择 / 图鉴 / 设置 / 暂停
 * ============================================================ */
const MENU = {
  game: null, diff: 'normal', settingsFrom: 'menu', codexTab: 'zombies',
  screens: {},

  init(game) {
    this.game = game;
    document.querySelectorAll('.screen').forEach(s => { this.screens[s.id] = s; });

    const $ = id => document.getElementById(id);
    $('btn-encounter').addEventListener('click', () => { AUDIO.uiClick(); this.buildMissionCards(); this.show('screen-missions'); });
    $('btn-hunt').addEventListener('click', () => { AUDIO.uiClick(); this.buildMapCards(); this.show('screen-maps'); });
    $('btn-tutorial').addEventListener('click', () => { AUDIO.uiClick(); GAME.startTutorial(); });
    $('btn-net').addEventListener('click', () => { AUDIO.uiClick(); this.show('screen-net'); this.initNetUI(); });
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

    // 难度
    document.querySelectorAll('.diff-btn').forEach(b =>
      b.addEventListener('click', () => {
        this.diff = b.dataset.diff;
        document.querySelectorAll('.diff-btn').forEach(x => x.classList.toggle('active', x === b));
        AUDIO.uiClick();
      }));
    document.querySelector('.diff-btn[data-diff="normal"]').classList.add('active');

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
    // 帧率上限
    const fBtns = document.querySelectorAll('.fcap-btn');
    const setFcapActive = () => fBtns.forEach(b => b.classList.toggle('active', +b.dataset.fc === (SAVE.data.settings.fpsCap || 0)));
    setFcapActive();
    fBtns.forEach(b => b.addEventListener('click', () => {
      SAVE.data.settings.fpsCap = +b.dataset.fc;
      SAVE.commit();
      setFcapActive();
      AUDIO.uiClick();
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
    $('btn-quit').addEventListener('click', () => { AUDIO.uiClick(); GAME.quitToMenu(); });

    // 结算
    $('btn-retry').addEventListener('click', () => { AUDIO.uiClick(); this.hideAll(); GAME.restart(); });
    $('btn-over-quit').addEventListener('click', () => { AUDIO.uiClick(); GAME.quitToMenu(); });
    $('btn-vic-quit').addEventListener('click', () => { AUDIO.uiClick(); GAME.quitToMenu(); });
    $('btn-vic-next').addEventListener('click', () => {
      AUDIO.uiClick();
      const next = (GAME.mode && GAME.mode.idx !== undefined) ? GAME.mode.idx + 1 : 0;
      this.hideAll();
      if (next < MISSIONS.length) GAME.startMission(next);
      else GAME.quitToMenu();
    });

    this.refreshStats();
  },

  show(id) {
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

  /* ---------- 任务卡片 ---------- */
  buildMissionCards() {
    const list = document.getElementById('mission-list');
    list.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const locked = i > SAVE.data.missionsDone;
      const done = i < SAVE.data.missionsDone;
      const rating = (SAVE.data.bestRating || {})[i];
      const card = document.createElement('div');
      card.className = 'card' + (locked ? ' locked' : '');
      card.innerHTML = `
        ${rating ? `<span class="card-rating rating-${rating}">${rating}</span>` : ''}
        ${done ? '<span class="card-done">✔ 已完成</span>' : locked ? '<span class="card-lock">🔒</span>' : ''}
        <h3>${m.name}</h3>
        <div class="card-map">📍 ${MAPS[m.map].name} · ⏱ ${fmtTime(m.duration)}</div>
        <p>${m.brief}</p>
      `;
      if (!locked) card.addEventListener('click', () => { AUDIO.uiClick(); GAME.startMission(i); });
      list.appendChild(card);
    });
    // 战役背景
    const bg = document.createElement('div');
    bg.className = 'card';
    bg.style.gridColumn = '1 / -1';
    bg.innerHTML = `<h3>战役背景 · 赤潮事件</h3>
      <p>2026年10月，军方代号“游乐园”的生物实验设施发生泄漏，“赤潮病毒”一夜之间席卷滨港市。雇佣兵“渡鸦”受幸存者组织“黎明会”委托，深入疫区执行五段任务：修复通讯、营救科学家、夺取病毒样本、建立撤离点，最终摧毁病毒源头、带回解药。</p>`;
    list.appendChild(bg);
  },

  /* ---------- 地图卡片 ---------- */
  buildMapCards() {
    const list = document.getElementById('map-list');
    list.innerHTML = '';
    document.getElementById('difficulty-row').classList.remove('hidden');
    document.getElementById('maps-title').textContent = '狩猎模式 · 选择猎场';
    for (const id in MAPS) {
      const m = MAPS[id];
      const best = SAVE.data.bestWave[id] || 0;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <canvas width="252" height="120"></canvas>
        <h3>${m.name}</h3>
        <div class="card-map">${m.subtitle}</div>
        <p>${m.desc}</p>
        ${best ? `<div class="best-tag">🏆 最高纪录：第 ${best} 波</div>` : ''}
      `;
      card.addEventListener('click', () => { AUDIO.uiClick(); GAME.startHunt(id, this.diff); });
      list.appendChild(card);
      drawMapPreview(card.querySelector('canvas'), m);
    }
  },

  /* ---------- 图鉴 ---------- */
  buildCodex() {
    const box = document.getElementById('codex-content');
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'codex-grid';

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
            <div class="cx-role">${label}</div>
            <p>${w.desc}</p>
            <div class="cx-stats">${stats}</div>`;
          grid.appendChild(c);
        }
      }
      for (const id in THROWABLES) {
        const t = THROWABLES[id];
        const c = document.createElement('div');
        c.className = 'codex-card';
        c.innerHTML = `
          <h4><span class="codex-dot" style="background:#ff7733;color:#ff7733"></span>${t.name}</h4>
          <div class="cx-role">投掷武器 · 按 ${t.id === 'frag' ? 'G' : 'T'} 投掷</div>
          <p>${t.desc}</p>
          <div class="cx-stats">
            <span>价格 <b>$${t.price} / ${t.pack}枚</b></span><span>携带上限 <b>${t.max}</b></span>
          </div>`;
        grid.appendChild(c);
      }
    } else if (this.codexTab === 'achv') {
      const unlocked = SAVE.data.achievements || [];
      // 总统计面板
      const stats = document.createElement('div');
      stats.className = 'codex-grid';
      stats.style.marginBottom = '14px';
      const d = SAVE.data;
      const cells = [
        ['累计击杀', d.totalKills], ['总场次', d.totalRuns],
        ['剧情进度', `${d.missionsDone}/${MISSIONS.length}`],
        ['狩猎最深', `${d.huntBest.wave || 0} 波`],
        ['成就', `${unlocked.length}/${ACHIEVEMENTS.length}`],
        ['教学', d.tutorialDone ? '✔ 已毕业' : '未完成'],
      ];
      for (const [k, v] of cells) {
        const c = document.createElement('div');
        c.className = 'codex-card';
        c.innerHTML = `<h4 style="justify-content:center">${v}</h4><div class="cx-role" style="text-align:center;margin:4px 0 0">${k}</div>`;
        grid.appendChild(c);
      }
      box.appendChild(stats);
      const grid2 = document.createElement('div');
      grid2.className = 'codex-grid';
      for (const a of ACHIEVEMENTS) {
        const ok = unlocked.includes(a.id);
        const c = document.createElement('div');
        c.className = 'codex-card' + (ok ? '' : ' achv-locked');
        c.innerHTML = `
          <h4>${ok ? '🏆' : '🔒'} ${a.name}</h4>
          <div class="cx-role">${ok ? '已解锁' : '未解锁'}</div>
          <p style="margin:0">${a.desc}</p>`;
        grid2.appendChild(c);
      }
      box.appendChild(grid2);
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
