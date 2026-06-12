/* ========================================
   GAME CONFIG — Phaser 3 initialization
   ======================================== */

// Detect mobile vs desktop for optimal game resolution
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const gameWidth = isMobile ? 667 : 800;  // iPhone SE landscape width
const gameHeight = isMobile ? 375 : 500; // iPhone SE landscape height

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  transparent: false,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene, HubScene, StoryScene, LevelScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3, // Support multi-touch
    touch: {
      capture: true,
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  banner: false, // Hide Phaser banner in console
};

let game = null;

window.launchRiftRunner = function() {
  if (game) {
    // If already running, force a resize refresh
    game.scale.resize(window.innerWidth, window.innerHeight);
    return;
  }
  
  // Hide the portal DOM elements
  const portal = document.getElementById('aiden-portal');
  if (portal) portal.style.display = 'none';

  // Show the game container
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.style.display = 'block';

  // Native Phaser scaling to dynamically fill fixed DOM container
  gameConfig.scale.width = '100%';
  gameConfig.scale.height = '100%';
  
  game = new Phaser.Game(gameConfig);
};

// ── RIFT INVADERS LAUNCHER ──
window.launchRiftInvaders = function() {
  if (window.riftInvadersGame) {
    window.riftInvadersGame.destroy(true);
    window.riftInvadersGame = null;
  }
  // Switch to gameplay music
  if (typeof MusicSystem !== 'undefined') MusicSystem.play('gameplay');

  // Hide ALL UI layers
  const portal = document.getElementById('aiden-portal');
  if (portal) portal.style.display = 'none';
  const playHub = document.getElementById('play-mode-hub');
  if (playHub) playHub.style.display = 'none';
  const gameHub = document.getElementById('game-hub');
  if (gameHub) { gameHub.style.display = 'none'; gameHub.style.opacity = '0'; }
  const learningCenter = document.getElementById('learning-center');
  if (learningCenter) learningCenter.style.display = 'none';

  // Enter game mode (fullscreen + landscape)
  document.body.classList.add('playing-game');
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(e => console.log('FS:', e));
  } else if (document.documentElement.webkitRequestFullscreen) {
    document.documentElement.webkitRequestFullscreen();
  }
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(e => console.log('Orientation lock:', e));
    }
  } catch(e) {}

  const container = document.getElementById('game-container-invaders');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = ''; // Clear any previous game
  }

  window.PhaserMiniGame = 'RiftInvadersScene'; // Tell BootScene which scene to start after loading

  window.riftInvadersGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container-invaders',
    transparent: false,
    backgroundColor: '#000011',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, RiftInvadersScene],
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    input: { activePointers: 2, touch: { capture: true } },
    render: { pixelArt: false, antialias: true, roundPixels: true },
    banner: false,
  });
};

// ── CHRONO MATCH LAUNCHER ──
window.launchChronoMatch = function(difficulty) {
  if (window.chronoMatchGame) {
    window.chronoMatchGame.destroy(true);
    window.chronoMatchGame = null;
  }
  // Switch to gameplay music
  if (typeof MusicSystem !== 'undefined') MusicSystem.play('gameplay');

  const portal = document.getElementById('aiden-portal');
  if (portal) portal.style.display = 'none';

  const container = document.getElementById('game-container-match');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = '';
  }

  window.PhaserMiniGame = 'ChronoMatchScene'; // Tell BootScene which scene to start after loading

  window.chronoMatchGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container-match',
    transparent: false,
    backgroundColor: '#0a0a2e',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, ChronoMatchScene],
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    input: { activePointers: 2, touch: { capture: true } },
    render: { pixelArt: false, antialias: true, roundPixels: true },
    banner: false,
  });
};

  // Prevent right-click context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());
