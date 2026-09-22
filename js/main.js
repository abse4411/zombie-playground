/* ============================================================
 * 入口 —— 初始化所有子系统（v12.1：资源文件化 + 异步启动）
 * ============================================================ */
let GAME = null;
window.__ASSET_VER = '21.3';   // JSON 资源缓存版本（与页面 ?v= 同步）

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const bootFill = $('boot-bar-fill'), bootTip = $('boot-tip');
  const progress = (k, label) => {
    if (bootFill) bootFill.style.width = Math.round(k * 100) + '%';
    if (bootTip) bootTip.textContent = label ? `正在加载 · ${label}` : '正在加载…';
  };

  SAVE.load();

  // 1) 异步加载核心数据资源（武器/感染体/特长/成就/角色/索引）
  try {
    await RES.boot(progress);
  } catch (e) {
    if (bootTip) bootTip.textContent = '资源加载失败 —— 请确认通过本地服务器访问（不要直接双击 index.html）';
    console.error(e);
    return;
  }

  const canvas = document.getElementById('game-canvas');
  GAME = new Game(canvas);
  window.GAME = GAME;   // 挂到window：延时回调（XT-300弹幕/地刺/兽群/宝箱奖励/小Boss登场）经 window.GAME 守卫（v15.4修复潜伏bug）

  progress(0.9, '初始化引擎');
  HUD.init();
  DMGNUM.init();
  SHOPUI.init();
  STORY.init();
  BACKPACK.init();
  if (typeof LEVELUP !== 'undefined') LEVELUP.init();
  MENU.init(GAME);
  TOUCH.init();
  if (typeof TRACERS !== 'undefined') TRACERS.init(ENGINE.scene);

  // 恢复画质设置
  const q = SAVE.data.settings.quality || 'auto';
  if (q === 'auto') { ENGINE.autoMode = true; }
  else { ENGINE.setQuality(q); }

  GAME.start();

  // 主菜单 3D 场景（v9.0）
  if (typeof MENUSCENE !== 'undefined') {
    MENUSCENE.init(document.getElementById('menu-bg'));
  }

  // 首次交互时激活 WebAudio（浏览器策略要求）
  const kick = () => {
    AUDIO.init();
    AUDIO.resume();
    AUDIO.setVolume(SAVE.data.settings.volume);
  };
  document.addEventListener('pointerdown', kick, { once: true });
  document.addEventListener('keydown', kick, { once: true });

  // 2) 数据就绪：淡出启动屏
  progress(1, '完成');
  const bs = $('boot-screen');
  if (bs) {
    bs.classList.add('done');
    setTimeout(() => bs.remove(), 600);
  }
});
