/* ========================================
   CHRONO MATCH — Memory Card Game
   ======================================== */

class ChronoMatchScene extends Phaser.Scene {
  constructor() {
    super('ChronoMatchScene');
  }

  init(data) {
    this.difficulty = data.difficulty || 'easy'; // easy, medium, hard
    const grids = { easy: { cols: 4, rows: 3 }, medium: { cols: 4, rows: 4 }, hard: { cols: 5, rows: 4 } };
    this.gridCols = grids[this.difficulty].cols;
    this.gridRows = grids[this.difficulty].rows;
    this.totalPairs = (this.gridCols * this.gridRows) / 2;
    this.matchedPairs = 0;
    this.moves = 0;
    this.elapsedTime = 0;
    this.canFlip = true;
    this.firstCard = null;
    this.secondCard = null;
    this.cards = [];
    this.shardsCollected = 0;
  }

  create() {
    const { width, height } = this.cameras.main;

    // ── Background ──
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a2e).setDepth(0);
    // Subtle grid pattern
    for (let x = 0; x < width; x += 40) {
      this.add.line(0, 0, x, 0, x, height, 0x1e1e4a, 0.15).setDepth(0);
    }
    for (let y = 0; y < height; y += 40) {
      this.add.line(0, 0, 0, y, width, y, 0x1e1e4a, 0.15).setDepth(0);
    }

    // ── Character Pool ──
    this.characterPool = [
      { key: 'iron_kid', name: 'Ironboy', color: 0xfbbf24 },
      { key: 'super_girl', name: 'Supergirl', color: 0x10b981 },
      { key: 'superboy', name: 'Superboy', color: 0x2563eb },
      { key: 'cyborg_girl', name: 'Cyborg Girl', color: 0x06b6d4 },
      { key: 'spider_hero', name: 'Spider Hero', color: 0xe63946 },
      { key: 'telekinetic_girl', name: 'Telekinetic', color: 0xa855f7 },
      { key: 'jedi_kid', name: 'Jedi Kid', color: 0x22c55e },
      { key: 'hero_black', name: 'Shadow', color: 0x475569 },
      { key: 'enemy_thug', name: 'Thug', color: 0xdc2626 },
      { key: 'enemy_trooper', name: 'Trooper', color: 0xffffff },
      { key: 'alien_brute', name: 'Brute', color: 0x94a3b8 },
      { key: 'bounty_hunter', name: 'Bounty Hunter', color: 0x78716c }
    ];

    // Pick pairs
    const selected = Phaser.Utils.Array.Shuffle([...this.characterPool]).slice(0, this.totalPairs);
    const cardData = Phaser.Utils.Array.Shuffle([...selected, ...selected]); // duplicate for pairs

    // ── Card Layout ──
    const cardW = Math.min(90, (width - 60) / this.gridCols - 10);
    const cardH = cardW * 1.3;
    const gridW = this.gridCols * (cardW + 10) - 10;
    const gridH = this.gridRows * (cardH + 10) - 10;
    const startX = (width - gridW) / 2 + cardW / 2;
    const startY = (height - gridH) / 2 + cardH / 2 + 30;

    for (let i = 0; i < cardData.length; i++) {
      const col = i % this.gridCols;
      const row = Math.floor(i / this.gridCols);
      const x = startX + col * (cardW + 10);
      const y = startY + row * (cardH + 10);

      const card = this.createCard(x, y, cardW, cardH, cardData[i], i);
      this.cards.push(card);
    }

    // ── HUD ──
    this.timerText = this.add.text(width / 2, 20, '⏱ 0:00', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#22d3ee',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(100);

    this.movesText = this.add.text(10, 10, 'MOVES: 0', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#fbbf24',
      stroke: '#000', strokeThickness: 3
    }).setDepth(100);

    const diffLabel = { easy: '4×3 EASY', medium: '4×4 MEDIUM', hard: '5×4 HARD' };
    this.add.text(width - 10, 10, diffLabel[this.difficulty], {
      fontFamily: 'Arial Black', fontSize: '14px', color: '#a855f7',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(1, 0).setDepth(100);

    // ── Exit Button ──
    const exitBtn = this.add.text(10, height - 35, '← EXIT', {
      fontFamily: 'Arial Black', fontSize: '14px', color: '#94a3b8',
      stroke: '#000', strokeThickness: 2, backgroundColor: '#0f172a',
      padding: { x: 10, y: 5 }
    }).setDepth(100).setInteractive({ useHandCursor: true });
    exitBtn.on('pointerdown', () => {
      if (typeof window.goBackToPortal === 'function') {
        window.goBackToPortal();
      } else {
        if (window.chronoMatchGame) {
          window.chronoMatchGame.destroy(true);
          window.chronoMatchGame = null;
        }
        document.getElementById('game-container-match').style.display = 'none';
        document.getElementById('aiden-portal').style.display = 'block';
      }
    });

    // ── Timer ──
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.elapsedTime++;
        const m = Math.floor(this.elapsedTime / 60);
        const s = String(this.elapsedTime % 60).padStart(2, '0');
        this.timerText.setText(`⏱ ${m}:${s}`);
      },
      loop: true
    });

    // ── Resize ──
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    });
  }

  createCard(x, y, w, h, charData, index) {
    const card = {
      x, y, w, h, charData, index,
      isFlipped: false, isMatched: false,
      container: this.add.container(x, y).setDepth(10)
    };

    // Card back (face-down)
    const back = this.add.rectangle(0, 0, w, h, 0x1a1a4a)
      .setStrokeStyle(2, 0x3b3b8a);
    const backIcon = this.add.text(0, 0, '✦', {
      fontFamily: 'Arial Black', fontSize: Math.floor(w * 0.4) + 'px', color: '#4a4a9a'
    }).setOrigin(0.5);

    // Holographic shimmer on back
    const shimmer = this.add.rectangle(0, 0, w, h, 0x22d3ee, 0.05);

    card.backGroup = [back, backIcon, shimmer];

    // Card front (face-up) — character image
    const frontBg = this.add.rectangle(0, 0, w, h, 0x0f0f3a)
      .setStrokeStyle(3, charData.color).setVisible(false);
    
    // Character sprite on card
    const charSprite = this.add.sprite(0, -h * 0.1, charData.key)
      .setDisplaySize(w * 0.7, h * 0.55).setVisible(false);
    
    const nameText = this.add.text(0, h * 0.35, charData.name, {
      fontFamily: 'Arial Black',
      fontSize: Math.floor(w * 0.14) + 'px',
      color: '#' + charData.color.toString(16).padStart(6, '0'),
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setVisible(false);

    card.frontGroup = [frontBg, charSprite, nameText];

    // Add all to container
    card.container.add([...card.backGroup, ...card.frontGroup]);

    // ── Click handler ──
    back.setInteractive({ useHandCursor: true });
    shimmer.setInteractive({ useHandCursor: true });

    const flipCard = () => {
      if (!this.canFlip || card.isFlipped || card.isMatched) return;
      this.flipCardUp(card);
    };

    back.on('pointerdown', flipCard);
    shimmer.on('pointerdown', flipCard);

    // Entrance animation
    card.container.setScale(0);
    this.tweens.add({
      targets: card.container,
      scale: 1,
      duration: 300,
      delay: index * 50,
      ease: 'Back.easeOut'
    });

    return card;
  }

  flipCardUp(card) {
    card.isFlipped = true;
    this.moves++;
    this.movesText.setText('MOVES: ' + this.moves);

    // Flip animation
    this.tweens.add({
      targets: card.container,
      scaleX: 0,
      duration: 150,
      ease: 'Sine.easeIn',
      onComplete: () => {
        card.backGroup.forEach(g => g.setVisible(false));
        card.frontGroup.forEach(g => g.setVisible(true));
        this.tweens.add({
          targets: card.container,
          scaleX: 1,
          duration: 150,
          ease: 'Sine.easeOut'
        });
      }
    });

    if (!this.firstCard) {
      this.firstCard = card;
    } else {
      this.secondCard = card;
      this.canFlip = false;

      this.time.delayedCall(600, () => this.checkMatch());
    }
  }

  flipCardDown(card) {
    this.tweens.add({
      targets: card.container,
      scaleX: 0,
      duration: 150,
      ease: 'Sine.easeIn',
      onComplete: () => {
        card.frontGroup.forEach(g => g.setVisible(false));
        card.backGroup.forEach(g => g.setVisible(true));
        card.isFlipped = false;
        this.tweens.add({
          targets: card.container,
          scaleX: 1,
          duration: 150,
          ease: 'Sine.easeOut'
        });
      }
    });
  }

  checkMatch() {
    if (this.firstCard.charData.key === this.secondCard.charData.key) {
      // MATCH!
      this.firstCard.isMatched = true;
      this.secondCard.isMatched = true;
      this.matchedPairs++;
      this.shardsCollected += 2;

      // Match celebration
      const color = this.firstCard.charData.color;
      [this.firstCard, this.secondCard].forEach(card => {
        // Glow pulse
        this.tweens.add({
          targets: card.container,
          scale: 1.1,
          duration: 200,
          yoyo: true,
          ease: 'Sine.easeInOut'
        });

        // Particle burst
        for (let i = 0; i < 6; i++) {
          const p = this.add.circle(card.x, card.y, Phaser.Math.Between(2, 4), color).setDepth(20);
          this.tweens.add({
            targets: p,
            x: p.x + Phaser.Math.Between(-50, 50),
            y: p.y + Phaser.Math.Between(-50, 50),
            alpha: 0, scale: 0, duration: 500,
            onComplete: () => p.destroy()
          });
        }
      });

      // Camera flash
      this.cameras.main.flash(100, 34, 211, 238, false, null, this);

      if (this.matchedPairs >= this.totalPairs) {
        this.time.delayedCall(600, () => this.showVictory());
      }
    } else {
      // No match — flip both back
      this.flipCardDown(this.firstCard);
      this.flipCardDown(this.secondCard);
    }

    this.firstCard = null;
    this.secondCard = null;
    this.time.delayedCall(400, () => { this.canFlip = true; });
  }

  showVictory() {
    const { width, height } = this.cameras.main;

    // Star rating
    const parMoves = { easy: 10, medium: 16, hard: 24 };
    const par = parMoves[this.difficulty];
    let stars = 1;
    if (this.moves <= par) stars = 3;
    else if (this.moves <= par * 1.5) stars = 2;

    // Lume rewards
    const lumeReward = { easy: 1, medium: 2, hard: 3 };
    const lumesEarned = lumeReward[this.difficulty];

    // Save
    const save = SaveSystem.load();
    save.shards = (save.shards || 0) + this.shardsCollected;
    save.lumes = (save.lumes || 0) + lumesEarned;
    if (!save.matchBest) save.matchBest = {};
    const prevBest = save.matchBest[this.difficulty] || 9999;
    if (this.elapsedTime < prevBest) save.matchBest[this.difficulty] = this.elapsedTime;
    SaveSystem.save(save);

    // Overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(200);

    this.add.text(width / 2, height / 2 - 100, '🎉 ALL MATCHED!', {
      fontFamily: 'Arial Black', fontSize: '32px', color: '#fbbf24',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(201);

    // Stars
    const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(width / 2, height / 2 - 55, starStr, {
      fontFamily: 'Arial', fontSize: '36px'
    }).setOrigin(0.5).setDepth(201);

    // Stats
    const m = Math.floor(this.elapsedTime / 60);
    const s = String(this.elapsedTime % 60).padStart(2, '0');
    this.add.text(width / 2, height / 2 - 10,
      `Time: ${m}:${s}   Moves: ${this.moves}   💎 ${this.shardsCollected}   ✦ +${lumesEarned}`, {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#22d3ee',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(201);

    // Play Again
    const replay = this.add.text(width / 2, height / 2 + 45, '🔄 PLAY AGAIN', {
      fontFamily: 'Arial Black', fontSize: '22px', color: '#10b981',
      stroke: '#000', strokeThickness: 4, backgroundColor: '#0f172a',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
    replay.on('pointerdown', () => this.scene.restart({ difficulty: this.difficulty }));

    // Difficulty buttons
    const diffs = [
      { label: 'EASY', val: 'easy', color: '#10b981' },
      { label: 'MEDIUM', val: 'medium', color: '#fbbf24' },
      { label: 'HARD', val: 'hard', color: '#ef4444' }
    ];
    diffs.forEach((d, i) => {
      const btn = this.add.text(width / 2 - 100 + i * 100, height / 2 + 95, d.label, {
        fontFamily: 'Arial Black', fontSize: '14px', color: d.color,
        stroke: '#000', strokeThickness: 2, backgroundColor: '#0f172a',
        padding: { x: 10, y: 6 }
      }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.scene.restart({ difficulty: d.val }));
    });

    // Exit
    const exit = this.add.text(width / 2, height / 2 + 140, '← EXIT', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#94a3b8',
      stroke: '#000', strokeThickness: 2, backgroundColor: '#0f172a',
      padding: { x: 15, y: 6 }
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
    exit.on('pointerdown', () => {
      if (typeof window.goBackToPortal === 'function') {
        window.goBackToPortal();
      } else {
        if (window.chronoMatchGame) {
          window.chronoMatchGame.destroy(true);
          window.chronoMatchGame = null;
        }
        document.getElementById('game-container-match').style.display = 'none';
        document.getElementById('aiden-portal').style.display = 'block';
      }
    });
  }

  update() {
    // No per-frame logic needed for card game
  }
}
