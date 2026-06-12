/* ========================================
   VAULT DEFENDER - Whack-a-Mole Mini-Game
   Tap the enemies before they break in!
   Ages 6-9 · Touch + Click friendly
   ======================================== */

class VaultDefender extends Phaser.Scene {
  constructor() {
    super('VaultDefender');
    this.score = 0;
    this.misses = 0;
    this.timeLeft = 60;
    this.gameActive = false;
    this.doors = [];
    this.difficulty = 1;
    this.spawnTimer = null;
    this.clockTimer = null;
  }

  preload() {
    // No external assets needed — uses shapes + emoji
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Dark background
    this.bgRect = this.add.rectangle(0, 0, w, h, 0x020617).setOrigin(0);

    // Title
    this.titleText = this.add.text(w / 2, 30, '🛡️ VAULT DEFENDER', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '28px',
      color: '#22d3ee',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Score display
    this.scoreText = this.add.text(20, 12, '⭐ Score: 0', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#fbbf24',
      fontStyle: 'bold',
    });

    // Timer display
    this.timerText = this.add.text(w - 20, 12, '⏱️ 60s', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    // Lives/misses display
    this.livesText = this.add.text(w / 2, 60, '❤️❤️❤️❤️❤️', {
      fontSize: '18px',
    }).setOrigin(0.5);

    // Create 3x3 grid of vault doors
    this.createDoors(w, h);

    // Instructions
    this.instructionText = this.add.text(w / 2, h - 40, 'Tap the enemies to zap them! Don\'t let 5 escape!', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#94a3b8',
      align: 'center',
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(20, h - 40, '← Back', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.cleanup();
      if (typeof window.goBackToPortal === 'function') {
        window.goBackToPortal();
      }
    });

    // Start the game
    this.startGame();

    // Handle resize
    this.scale.on('resize', this.handleResize, this);
  }

  createDoors(w, h) {
    const cols = 3;
    const rows = 3;
    const doorSize = Math.min((w - 80) / cols, (h - 180) / rows, 120);
    const gridW = cols * (doorSize + 12) - 12;
    const gridH = rows * (doorSize + 12) - 12;
    const startX = (w - gridW) / 2 + doorSize / 2;
    const startY = (h - gridH) / 2 + 20;

    this.doors = [];

    const doorColors = [0x1e293b, 0x172554, 0x14532d, 0x431407, 0x3b0764, 0x1c1917, 0x0c4a6e, 0x365314, 0x4c1d95];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (doorSize + 12);
        const y = startY + row * (doorSize + 12);
        const idx = row * cols + col;

        // Door background (vault door look)
        const door = this.add.rectangle(x, y, doorSize, doorSize, doorColors[idx], 1);
        door.setStrokeStyle(3, 0x334155, 1);

        // Door number
        const num = this.add.text(x, y, `${idx + 1}`, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#475569',
          fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0.5);

        // Enemy emoji (hidden initially)
        const enemy = this.add.text(x, y, '👾', {
          fontSize: `${Math.floor(doorSize * 0.5)}px`,
        }).setOrigin(0.5).setAlpha(0).setScale(0.3);

        // Hit effect
        const hitFx = this.add.text(x, y - 10, '💥', {
          fontSize: '32px',
        }).setOrigin(0.5).setAlpha(0);

        // Make door interactive
        door.setInteractive({ useHandCursor: true });
        door.on('pointerdown', () => this.tapDoor(idx));

        this.doors.push({
          door, num, enemy, hitFx,
          x, y, size: doorSize,
          active: false,
          enemyType: null,
        });
      }
    }
  }

  startGame() {
    this.score = 0;
    this.misses = 0;
    this.timeLeft = 60;
    this.difficulty = 1;
    this.gameActive = true;
    this.updateScore();
    this.updateTimer();
    this.updateLives();

    // Spawn enemies at intervals
    this.scheduleNextSpawn();

    // Timer countdown
    this.clockTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.gameActive) return;
        this.timeLeft--;
        this.updateTimer();

        // Increase difficulty every 15 seconds
        if (this.timeLeft === 45) this.difficulty = 2;
        if (this.timeLeft === 30) this.difficulty = 3;
        if (this.timeLeft === 15) this.difficulty = 4;

        if (this.timeLeft <= 0) {
          this.endGame(true);
        }
      },
    });
  }

  scheduleNextSpawn() {
    if (!this.gameActive) return;

    // Spawn delay decreases with difficulty
    const delays = [1200, 900, 700, 500];
    const delay = delays[Math.min(this.difficulty - 1, delays.length - 1)];
    const variance = delay * 0.3;

    this.spawnTimer = this.time.delayedCall(
      delay + Math.random() * variance - variance / 2,
      () => {
        this.spawnEnemy();
        this.scheduleNextSpawn();
      }
    );
  }

  spawnEnemy() {
    if (!this.gameActive) return;

    // Find a random inactive door
    const inactiveDoors = this.doors.filter(d => !d.active);
    if (inactiveDoors.length === 0) return;

    const doorData = inactiveDoors[Math.floor(Math.random() * inactiveDoors.length)];
    doorData.active = true;

    // Pick enemy type with different points
    const enemies = [
      { emoji: '👾', points: 10, color: 0x7c3aed, stayTime: 2000 },
      { emoji: '🤖', points: 15, color: 0x2563eb, stayTime: 1800 },
      { emoji: '👹', points: 20, color: 0xdc2626, stayTime: 1500 },
      { emoji: '💀', points: 25, color: 0xfbbf24, stayTime: 1200 },
      { emoji: '🦹', points: 30, color: 0x059669, stayTime: 1000 },
    ];

    // Higher difficulty = harder enemies more likely
    const maxIdx = Math.min(this.difficulty + 1, enemies.length);
    const enemyType = enemies[Math.floor(Math.random() * maxIdx)];
    doorData.enemyType = enemyType;

    // Show enemy with pop-up animation
    doorData.enemy.setText(enemyType.emoji);
    doorData.door.setStrokeStyle(3, enemyType.color, 1);

    this.tweens.add({
      targets: doorData.enemy,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Auto-hide after stayTime (enemy escapes)
    doorData.hideTimer = this.time.delayedCall(enemyType.stayTime, () => {
      if (doorData.active) {
        this.enemyEscaped(doorData);
      }
    });
  }

  tapDoor(idx) {
    const doorData = this.doors[idx];
    if (!this.gameActive || !doorData.active) return;

    doorData.active = false;
    if (doorData.hideTimer) doorData.hideTimer.remove();

    // Score!
    const points = doorData.enemyType ? doorData.enemyType.points : 10;
    this.score += points;
    this.updateScore();

    // Play hit effect
    doorData.hitFx.setAlpha(1);
    this.tweens.add({
      targets: doorData.hitFx,
      alpha: 0,
      y: doorData.y - 30,
      duration: 500,
      onComplete: () => { doorData.hitFx.setY(doorData.y - 10); },
    });

    // Show points text
    const ptText = this.add.text(doorData.x, doorData.y - 20, `+${points}`, {
      fontFamily: 'Arial Black',
      fontSize: '18px',
      color: '#10b981',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: ptText,
      y: doorData.y - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => ptText.destroy(),
    });

    // Hide enemy
    this.tweens.add({
      targets: doorData.enemy,
      alpha: 0,
      scale: 0.3,
      duration: 150,
    });

    // Flash door green
    doorData.door.setFillStyle(0x10b981, 1);
    this.time.delayedCall(200, () => {
      doorData.door.setFillStyle(0x1e293b, 1);
      doorData.door.setStrokeStyle(3, 0x334155, 1);
    });
  }

  enemyEscaped(doorData) {
    doorData.active = false;
    this.misses++;
    this.updateLives();

    // Flash door red
    doorData.door.setFillStyle(0xdc2626, 1);
    this.time.delayedCall(300, () => {
      doorData.door.setFillStyle(0x1e293b, 1);
      doorData.door.setStrokeStyle(3, 0x334155, 1);
    });

    // Hide enemy with shame animation
    this.tweens.add({
      targets: doorData.enemy,
      alpha: 0,
      y: doorData.y + 20,
      duration: 300,
      onComplete: () => {
        doorData.enemy.setY(doorData.y);
        doorData.enemy.setScale(0.3);
      },
    });

    // Check game over
    if (this.misses >= 5) {
      this.endGame(false);
    }
  }

  endGame(survived) {
    this.gameActive = false;
    if (this.spawnTimer) this.spawnTimer.remove();
    if (this.clockTimer) this.clockTimer.remove();

    // Clear all active enemies
    this.doors.forEach(d => {
      d.active = false;
      d.enemy.setAlpha(0);
    });

    const w = this.scale.width;
    const h = this.scale.height;

    // Calculate stars
    let stars = 0;
    if (this.score >= 50) stars = 1;
    if (this.score >= 150) stars = 2;
    if (this.score >= 300) stars = 3;

    // Game over overlay
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85).setDepth(100);

    const icon = survived ? '🏆' : '💔';
    const title = survived ? 'TIME\'S UP!' : 'VAULT BREACHED!';
    const titleColor = survived ? '#fbbf24' : '#f43f5e';

    this.add.text(w / 2, h / 2 - 80, icon, { fontSize: '64px' }).setOrigin(0.5).setDepth(101);
    this.add.text(w / 2, h / 2 - 20, title, {
      fontFamily: 'Arial Black',
      fontSize: '28px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(101);

    this.add.text(w / 2, h / 2 + 20, `Score: ${this.score}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    this.add.text(w / 2, h / 2 + 48, '⭐'.repeat(stars) + '☆'.repeat(3 - stars), {
      fontSize: '28px',
    }).setOrigin(0.5).setDepth(101);

    // Play Again button
    const playAgainBg = this.add.rectangle(w / 2, h / 2 + 100, 180, 44, 0x10b981, 1).setDepth(101).setInteractive({ useHandCursor: true });
    playAgainBg.setStrokeStyle(2, 0x34d399);
    this.add.text(w / 2, h / 2 + 100, '🔄 Play Again', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(102);

    playAgainBg.on('pointerdown', () => {
      this.scene.restart();
    });

    // Back to Portal button
    const backBg = this.add.rectangle(w / 2, h / 2 + 155, 180, 44, 0x334155, 1).setDepth(101).setInteractive({ useHandCursor: true });
    backBg.setStrokeStyle(2, 0x475569);
    this.add.text(w / 2, h / 2 + 155, '← Portal', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#94a3b8',
    }).setOrigin(0.5).setDepth(102);

    backBg.on('pointerdown', () => {
      this.cleanup();
      if (typeof window.goBackToPortal === 'function') {
        window.goBackToPortal();
      }
    });
  }

  updateScore() {
    if (this.scoreText) this.scoreText.setText(`⭐ Score: ${this.score}`);
  }

  updateTimer() {
    if (this.timerText) {
      this.timerText.setText(`⏱️ ${this.timeLeft}s`);
      if (this.timeLeft <= 10) this.timerText.setColor('#f43f5e');
      else if (this.timeLeft <= 20) this.timerText.setColor('#f59e0b');
      else this.timerText.setColor('#10b981');
    }
  }

  updateLives() {
    const remaining = Math.max(0, 5 - this.misses);
    if (this.livesText) {
      this.livesText.setText('❤️'.repeat(remaining) + '🖤'.repeat(5 - remaining));
    }
  }

  cleanup() {
    if (this.spawnTimer) this.spawnTimer.remove();
    if (this.clockTimer) this.clockTimer.remove();
    this.gameActive = false;
  }

  handleResize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;
    if (this.bgRect) this.bgRect.setSize(w, h);
  }

  update() {
    // Continuous update not needed — event-driven
  }
}

// Expose globally
window.VaultDefender = VaultDefender;
