/* ============================================================
 * 入口 —— 初始化所有子系统
 * ============================================================ */
let GAME = null;

window.addEventListener('DOMContentLoaded', () => {
  SAVE.load();

  const canvas = document.getElementById('game-canvas');
  GAME = new Game(canvas);

  HUD.init();
  DMGNUM.init();
  SHOPUI.init();
  STORY.init();
  BACKPACK.init();
  MENU.init(GAME);
  TOUCH.init();
  if (typeof TRACERS !== 'undefined') TRACERS.init(ENGINE.scene);

  // 恢复画质设置
  const q = SAVE.data.settings.quality || 'auto';
  if (q === 'auto') { ENGINE.autoMode = true; }
  else { ENGINE.setQuality(q); }

  GAME.start();

  // 首次交互时激活 WebAudio（浏览器策略要求）
  const kick = () => {
    AUDIO.init();
    AUDIO.resume();
    AUDIO.setVolume(SAVE.data.settings.volume);
  };
  document.addEventListener('pointerdown', kick, { once: true });
  document.addEventListener('keydown', kick, { once: true });
});
