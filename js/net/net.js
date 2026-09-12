/* ============================================================
 * 局域网联机（v3.2）—— 房主权威协作模型
 * 房主: 运行完整模拟, 12Hz 广播世界快照, 校验队友命中上报
 * 客户端: 本地移动/射击, 僵尸为网络傀儡(插值), 命中上报给房主
 * ============================================================ */
const NET = {
  role: 'off',          // off | host | client
  ws: null, myId: null, myName: '战士',
  room: [], inGame: false,
  remote: {},           // id -> {name, group, legs[], target{x,z,yaw}, hp}
  _snapT: 0, _posT: 0,

  get active() { return this.role !== 'off' && this.inGame; },

  /* ---------- 连接 ---------- */
  connect(url, name, wantHost, cb) {
    this.myName = name || '战士';
    try { this.ws = new WebSocket(url); } catch (e) { cb(e.message); return; }
    this.ws.onopen = () => {
      this.send({ t: wantHost ? 'host' : 'join', name: this.myName });
      cb(null);
    };
    this.ws.onerror = () => { if (cb) { cb('无法连接服务器'); } };
    this.ws.onclose = () => {
      if (this.role !== 'off') HUD.toast('⚠ 与服务器断开连接');
      this.reset();
    };
    this.ws.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      this.onMessage(msg);
    };
  },

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); },

  reset() {
    this.role = 'off'; this.myId = null; this.inGame = false;
    this.remote = {}; this.room = [];
    MENU && MENU.refreshNetUI && MENU.refreshNetUI();
  },

  onMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        this.role = msg.host ? 'host' : 'client';
        this.myId = msg.id;
        this.room = msg.room || [];
        HUD.toast(`✔ 已连接（${msg.host ? '房主' : '队友'}）`);
        MENU.refreshNetUI();
        break;
      case 'room':
        this.room = msg.room; MENU.refreshNetUI();
        break;
      case 'err':
        HUD.toast('✖ ' + msg.msg); AUDIO.denied();
        break;
      case 'start':
        if (msg.mode === 'mission') GAME.startNetMission(msg.missionIdx);
        else GAME.startHunt(msg.map, msg.diff);
        break;
      case 'leave': {
        const r = this.remote[msg.id];
        if (r) { ENGINE.scene.remove(r.group); delete this.remote[msg.id]; }
        HUD.toast(`👋 ${msg.name || '队友'} 离开了`);
        this.room = this.room.filter(c => c.id !== msg.id);
        MENU.refreshNetUI();
        break;
      }
      /* ---- 房主收到 ---- */
      case 'in':   // 客户端位置
        this.updateRemote(msg.from, msg);
        break;
      case 'hit': {  // 客户端命中上报
        const z = GAME.zombies.find(x => x.uid === msg.uid);
        if (z && !z.dead && z.state !== 'rise') {
          z._lastHitBy = msg.from;
          z.takeDamage(msg.dmg, msg.head, msg.pt || null, GAME);
        }
        break;
      }
      case 'dead':
        HUD.killfeed(`💀 队友 ${msg.name || '战士'} 倒下了`, 'big');
        break;
      /* ---- 客户端收到 ---- */
      case 'snap':
        this.applySnap(msg);
        break;
      case 'ev':
        this.onEv(msg);
        break;
      case 'dmg': {  // 房主判定的僵尸攻击伤害
        if (GAME.player && GAME.player.alive) {
          GAME.player.takeDamage(msg.a, GAME, { x: msg.x, z: msg.z });
        }
        break;
      }
    }
  },

  /* ================= 房主：快照广播 ================= */
  hostTick(dt) {
    const g = GAME;
    this._snapT -= dt;
    if (this._snapT > 0) return;
    this._snapT = 1 / 12;
    const snap = {
      t: 'snap',
      players: [{
        id: this.myId, name: this.myName,
        x: +g.player.pos.x.toFixed(2), z: +g.player.pos.z.toFixed(2),
        yaw: +g.player.yaw.toFixed(2), hp: Math.round(g.player.hp),
      }],
      zombies: g.zombies.filter(z => !z.dead && !z.dummy && !z.net).map(z => ({
        u: z.uid, ty: z.typeId,
        x: +z.pos.x.toFixed(2), z: +z.pos.z.toFixed(2),
        yz: +z.group.rotation.y.toFixed(2),
        hp: Math.max(0, Math.round(z.hp)),
      })),
    };
    this.send(snap);
  },

  /* ================= 客户端：快照应用 ================= */
  applySnap(snap) {
    const g = GAME;
    if (!g.player || g.state !== 'playing') return;
    const seen = new Set();
    for (const s of snap.zombies) {
      seen.add(s.u);
      let z = g.zombies.find(x => x.uid === s.u);
      if (!z) {
        z = new Zombie(s.ty, s.x, s.z, { hp: 1, speed: 0, dmg: 0, reward: 0 }, { net: true });
        z.uid = s.u; z.riseT = 0; z.state = 'chase';
        g.zombies.push(z);
      }
      z.netTarget = { x: s.x, z: s.z, yaw: s.yz };
      z.hp = Math.min(z.hp || s.hp, s.hp) || s.hp;   // 同步血量（只降不升）
      if (z.hp <= 0 && !z.dead) { z.dead = true; z.deadT = 0; }
    }
    // 清理主机上已消失的傀儡
    for (const z of g.zombies) {
      if (z.net && !z.dead && !seen.has(z.uid)) { z.remove = true; z.shadow.visible = false; }
    }
    // 队友渲染
    for (const p of snap.players) {
      if (p.id !== this.myId) this.updateRemote(p.id, p);
    }
  },

  /* ================= 远程队友渲染 ================= */
  updateRemote(id, msg) {
    let r = this.remote[id];
    if (!r) {
      r = this._buildSoldier(msg.name || '队友');
      this.remote[id] = r;
      ENGINE.scene.add(r.group);
      HUD.killfeed(`🤝 ${r.name} 加入了战斗`);
    }
    r.name = msg.name || r.name;
    r.target = { x: msg.x, z: msg.z, yaw: msg.yaw || 0 };
    r.hp = msg.hp !== undefined ? msg.hp : r.hp;
    r.lastSeen = ENGINE.time;
  },

  _buildSoldier(name) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.3), ART.mat(0x3a4a3e));
    torso.position.y = 1.18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), ART.mat(0xc8a88a));
    head.position.y = 1.66;
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), ART.mat(0x2e3630));
    helm.position.y = 1.86;
    const legs = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.15, 0.8, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), ART.mat(0x2c3230));
      leg.position.y = -0.4;
      pivot.add(leg); g.add(pivot); legs.push(pivot);
    }
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), ART.mat(0x1c1e22));
    gun.position.set(0.2, 1.25, 0.35);
    g.add(torso, head, helm, gun);
    if (ENGINE.quality.outlines) { ART.outline(torso, 1.12); ART.outline(head, 1.12); }
    // 名牌
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#7CFC9A';
    ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 10), 128, 44);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    tag.scale.set(1.6, 0.4, 1);
    tag.position.y = 2.35;
    g.add(tag);
    const group = new THREE.Group();
    group.add(g, tag);
    return { group, body: g, legs, target: null, name, hp: 100, lastSeen: 0, walkPhase: 0, _last: { x: 0, z: 0 } };
  },

  /* ================= 每帧：双方通用 ================= */
  netTick(dt) {
    if (!this.active) return;
    const g = GAME;
    if (this.role === 'host') {
      this.hostTick(dt);
      // 房主对队友进行僵尸攻击判定（伤害在客户端结算）
      for (const id in this.remote) {
        const r = this.remote[id];
        if (r.hp <= 0) continue;
        for (const z of g.zombies) {
          if (z.dead || z.state === 'rise' || z.dummy || !z.type.damage) continue;
          const d = dist2d(z.pos.x, z.pos.z, r.target.x, r.target.z);
          z.attackCd -= dt;
          if (d < z.type.attackRange + 0.3 && z.attackCd <= 0) {
            z.attackCd = z.type.attackRate;
            this.send({ t: 'dmg', a: Math.round(z.damage), x: +z.pos.x.toFixed(1), z: +z.pos.z.toFixed(1) });
          }
        }
      }
    } else {
      // 客户端：上报位置
      this._posT -= dt;
      if (this._posT <= 0) {
        this._posT = 1 / 15;
        this.send({
          t: 'in', from: this.myId, name: this.myName,
          x: +g.player.pos.x.toFixed(2), z: +g.player.pos.z.toFixed(2),
          yaw: +g.player.yaw.toFixed(2), hp: Math.round(g.player.hp),
        });
      }
    }
    // 远程队友插值 + 行走动画
    for (const id in this.remote) {
      const r = this.remote[id];
      if (!r.target) continue;
      const dx = r.target.x - r._last.x, dz = r.target.z - r._last.z;
      const moved = Math.hypot(dx, dz);
      r.group.position.set(r.target.x, 0, r.target.z);
      r.body.rotation.y = angleLerp(r.body.rotation.y, r.target.yaw + Math.PI, Math.min(1, 8 * dt));
      if (moved > 0.005) {
        r.walkPhase += moved * 6;
        r.legs[0].rotation.x = Math.sin(r.walkPhase) * 0.5;
        r.legs[1].rotation.x = -Math.sin(r.walkPhase) * 0.5;
      } else {
        r.legs[0].rotation.x *= 0.8; r.legs[1].rotation.x *= 0.8;
      }
      r._last = { x: r.target.x, z: r.target.z };
      // 掉线清理
      if (ENGINE.time - r.lastSeen > 8) {
        ENGINE.scene.remove(r.group);
        delete this.remote[id];
      }
    }
  },

  /* 客户端：上报命中（本机只做表现） */
  reportHit(z, dmg, head, pt) {
    if (this.role !== 'client') return;
    this.send({ t: 'hit', from: this.myId, uid: z.uid, dmg: Math.round(dmg), head, pt });
  },

  /* 客户端：主机转发的击杀事件（发钱/播报） */
  onEv(msg) {
    if (msg.k === 'kill' && msg.by === this.myId) {
      const g = GAME, p = g.player;
      p.kills++;
      if (msg.head) p.headshots++;
      p.addMoney(msg.reward + (msg.head ? GAMECONFIG.economy.headshotBonus : 0));
      g.killStreak++; g.streakT = GAMECONFIG.streak.window;
      if (g.killStreak >= 3) HUD.streak(g.killStreak);
      HUD.killfeed(`${msg.head ? '☠ 爆头击杀' : '击杀'} ${msg.name} +$${msg.reward}`, msg.head ? 'head' : '');
      this.send({ t: 'in', from: this.myId, name: this.myName, x: p.pos.x, z: p.pos.z, yaw: p.yaw, hp: Math.round(p.hp) });
    }
  },

  reportDead() {
    if (this.role === 'client') this.send({ t: 'dead', from: this.myId, name: this.myName });
  },
};
