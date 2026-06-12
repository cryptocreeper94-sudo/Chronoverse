/* ========================================
   RIFT INVADERS — Galaga-style Space Shooter
   Premium Arcade Visuals Edition
   ======================================== */

class RiftInvadersScene extends Phaser.Scene {
  constructor() {
    super('RiftInvadersScene');
  }

  init() {
    this.score = 0;
    this.wave = 1;
    this.shardsCollected = 0;
    this.playerAlive = true;
    this.shieldActive = false;
    this.rapidFire = false;
    this.spreadShot = false;
    this.lastFired = 0;
    this.fireRate = 350; // ms between shots
    this.activeHero = localStorage.getItem('ChronoverseActiveHero') || 'iron_kid';
  }

  create() {
    const { width, height } = this.cameras.main;

    // ── Rich Space Background ──
    // Nebula gradient base
    const gfx = this.add.graphics().setDepth(0);
    gfx.fillGradientStyle(0x050520, 0x050520, 0x0a1628, 0x120824, 1);
    gfx.fillRect(0, 0, width, height);

    // Nebula clouds
    for (let i = 0; i < 4; i++) {
      const nx = Phaser.Math.Between(0, width);
      const ny = Phaser.Math.Between(0, height);
      const nr = Phaser.Math.Between(100, 250);
      const colors = [0x1a0a3e, 0x0a2040, 0x2a0a28, 0x0a1a30];
      const nebula = this.add.circle(nx, ny, nr, colors[i], 0.15).setDepth(0);
      this.tweens.add({ targets: nebula, alpha: { from: 0.08, to: 0.2 }, duration: Phaser.Math.Between(3000, 6000), yoyo: true, repeat: -1 });
    }

    // Multi-layer parallax starfield
    this.bgTiles = [];
    const starLayers = [
      { count: 40, sizeMin: 1, sizeMax: 1, speedMin: 0.2, speedMax: 0.5, alphaMin: 0.2, alphaMax: 0.4 },
      { count: 30, sizeMin: 1, sizeMax: 2, speedMin: 0.5, speedMax: 1.0, alphaMin: 0.4, alphaMax: 0.7 },
      { count: 15, sizeMin: 2, sizeMax: 3, speedMin: 1.0, speedMax: 2.0, alphaMin: 0.6, alphaMax: 1.0 },
    ];
    starLayers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const starColor = Phaser.Math.Between(0, 10) < 2 ? 0x88ccff : (Phaser.Math.Between(0, 10) < 1 ? 0xffcc88 : 0xffffff);
        const star = this.add.circle(
          Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
          Phaser.Math.Between(layer.sizeMin, layer.sizeMax),
          starColor, Phaser.Math.FloatBetween(layer.alphaMin, layer.alphaMax)
        ).setDepth(1);
        star.speed = Phaser.Math.FloatBetween(layer.speedMin, layer.speedMax);
        this.bgTiles.push(star);
      }
    });

    // ── Generate All Procedural Textures ──
    this.generateAllTextures();

    // ── Player Ship ──
    this.player = this.physics.add.sprite(width / 2, height - 80, 'player_ship_tex');
    this.player.setDisplaySize(60, 60);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Engine glow under player (animated)
    this.engineGlow = this.add.circle(this.player.x, this.player.y + 26, 8, this.getProjectileColor(), 0.5).setDepth(9);
    this.tweens.add({
      targets: this.engineGlow, scaleX: { from: 0.8, to: 1.4 }, scaleY: { from: 1.0, to: 1.8 },
      alpha: { from: 0.3, to: 0.6 }, duration: 120, yoyo: true, repeat: -1
    });

    // Shield visual — hexagonal energy field
    this.shieldGraphic = this.add.graphics().setDepth(9).setVisible(false);
    this.drawHexShield(this.shieldGraphic, 0, 0, 38);
    this.shieldAngle = 0;

    // ── Groups ──
    this.projectiles = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.shards = this.physics.add.group();
    this.particles = [];
    this.engineTrails = [];

    // ── HUD ──
    this.scoreText = this.add.text(10, 10, 'SCORE: 0', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#22d3ee',
      stroke: '#000', strokeThickness: 3
    }).setDepth(100).setScrollFactor(0);
    // Score glow via shadow
    this.scoreText.setShadow(0, 0, '#22d3ee', 8, false, true);

    this.waveText = this.add.text(width - 10, 10, 'WAVE 1', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#fbbf24',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(1, 0).setDepth(100).setScrollFactor(0);
    this.waveText.setShadow(0, 0, '#fbbf24', 6, false, true);

    // Shard counter with crystal icon
    this.shardIcon = this.add.sprite(22, 44, 'shard_tex').setDepth(100).setDisplaySize(16, 16).setScrollFactor(0);
    this.tweens.add({ targets: this.shardIcon, angle: 360, duration: 3000, repeat: -1 });
    this.shardText = this.add.text(34, 35, '0', {
      fontFamily: 'Arial Black', fontSize: '14px', color: '#06b6d4',
      stroke: '#000', strokeThickness: 2
    }).setDepth(100).setScrollFactor(0);
    this.shardText.setShadow(0, 0, '#06b6d4', 4, false, true);

    // ── Touch/Mouse Input ──
    this.input.on('pointermove', (pointer) => {
      if (this.playerAlive) {
        this.player.x = Phaser.Math.Clamp(pointer.x, 30, width - 30);
      }
    });

    // ── Collisions ──
    this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.playerHit, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.playerHit, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.collectPowerup, null, this);
    this.physics.add.overlap(this.player, this.shards, this.collectShard, null, this);

    // ── Start First Wave ──
    this.spawnWave();

    // ── Auto-fire Timer ──
    this.time.addEvent({
      delay: this.fireRate,
      callback: this.autoFire,
      callbackScope: this,
      loop: true
    });

    // ── Resize Handler ──
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    });
  }

  // ═══════════════════════════════════════
  //  PROCEDURAL TEXTURE GENERATION
  // ═══════════════════════════════════════

  generateAllTextures() {
    this.generatePlayerShipTexture();
    this.generateEnemyTextures();
    this.generateProjectileTextures();
    this.generatePowerupTextures();
    this.generateShardTexture();
    this.generateBossTexture();
  }

  generatePlayerShipTexture() {
    const size = 64;
    const g = this.make.graphics({ add: false });
    const c = this.getProjectileColor();
    const r = (c >> 16) & 0xff, gr = (c >> 8) & 0xff, b = c & 0xff;

    // Ship body — layered hull
    g.fillStyle(Phaser.Display.Color.GetColor(
      Math.min(255, r + 40), Math.min(255, gr + 40), Math.min(255, b + 40)), 1);
    // Main fuselage triangle
    g.fillTriangle(size / 2, 4, 8, size - 8, size - 8, size - 8);

    // Darker inner hull plating
    g.fillStyle(c, 1);
    g.fillTriangle(size / 2, 12, 16, size - 14, size - 16, size - 14);

    // Cockpit highlight
    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(size / 2, 14, size / 2 - 5, 28, size / 2 + 5, 28);

    // Wing tips — left and right
    g.fillStyle(c, 0.8);
    g.fillTriangle(4, size - 12, 18, size - 20, 14, size - 4);
    g.fillTriangle(size - 4, size - 12, size - 18, size - 20, size - 14, size - 4);

    // Wing accents
    g.lineStyle(1, 0xffffff, 0.5);
    g.lineBetween(size / 2, 12, 14, size - 12);
    g.lineBetween(size / 2, 12, size - 14, size - 12);

    // Engine nozzles (bright glowing circles at rear)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2 - 10, size - 6, 4);
    g.fillCircle(size / 2 + 10, size - 6, 4);
    g.fillStyle(c, 0.8);
    g.fillCircle(size / 2 - 10, size - 6, 2.5);
    g.fillCircle(size / 2 + 10, size - 6, 2.5);

    // Engine glow streaks
    g.fillStyle(c, 0.3);
    g.fillRect(size / 2 - 12, size - 4, 4, 6);
    g.fillRect(size / 2 + 8, size - 4, 4, 6);

    g.generateTexture('player_ship_tex', size, size);
    g.destroy();
  }

  generateEnemyTextures() {
    // ── ENEMY THUG — Chunky angular fighter, red/orange ──
    const s1 = 48;
    const g1 = this.make.graphics({ add: false });
    // Main body
    g1.fillStyle(0xdc2626, 1);
    g1.fillTriangle(s1 / 2, s1 - 4, 4, 8, s1 - 4, 8); // Inverted triangle (nose down)
    // Forward-swept wings
    g1.fillStyle(0xef4444, 0.9);
    g1.fillTriangle(2, 6, 16, 14, 6, s1 - 10);
    g1.fillTriangle(s1 - 2, 6, s1 - 16, 14, s1 - 6, s1 - 10);
    // Center hull plate
    g1.fillStyle(0xf97316, 1);
    g1.fillTriangle(s1 / 2, s1 - 10, 14, 14, s1 - 14, 14);
    // Cockpit
    g1.fillStyle(0x1e1e1e, 1);
    g1.fillCircle(s1 / 2, 16, 4);
    g1.fillStyle(0xff6b6b, 0.8);
    g1.fillCircle(s1 / 2, 16, 2);
    // Engine glow top
    g1.fillStyle(0xff4444, 0.5);
    g1.fillCircle(s1 / 2 - 8, 6, 3);
    g1.fillCircle(s1 / 2 + 8, 6, 3);
    g1.generateTexture('enemy_thug_tex', s1, s1);
    g1.destroy();

    // ── ENEMY TROOPER — Sleek dart interceptor, white/blue ──
    const s2 = 48;
    const g2 = this.make.graphics({ add: false });
    // Main dart body
    g2.fillStyle(0xe2e8f0, 1);
    g2.fillTriangle(s2 / 2, s2 - 2, 10, 4, s2 - 10, 4);
    // Blue trim lines
    g2.fillStyle(0x3b82f6, 1);
    g2.fillTriangle(s2 / 2, s2 - 8, 14, 10, s2 - 14, 10);
    // Wing strakes
    g2.fillStyle(0x93c5fd, 0.9);
    g2.fillTriangle(6, 6, 14, 12, 4, s2 / 2 + 4);
    g2.fillTriangle(s2 - 6, 6, s2 - 14, 12, s2 - 4, s2 / 2 + 4);
    // Cockpit
    g2.fillStyle(0x1e3a5f, 1);
    g2.fillCircle(s2 / 2, 14, 4);
    g2.fillStyle(0x60a5fa, 0.9);
    g2.fillCircle(s2 / 2, 14, 2);
    // Engine
    g2.fillStyle(0x60a5fa, 0.6);
    g2.fillCircle(s2 / 2, 4, 4);
    g2.generateTexture('enemy_trooper_tex', s2, s2);
    g2.destroy();

    // ── ALIEN BRUTE — Organic/biomechanical, green/purple ──
    const s3 = 48;
    const g3 = this.make.graphics({ add: false });
    // Asymmetric organic body
    g3.fillStyle(0x10b981, 0.9);
    // Main bulbous body
    g3.fillCircle(s3 / 2, s3 / 2, 14);
    g3.fillStyle(0x059669, 1);
    g3.fillCircle(s3 / 2 - 2, s3 / 2 + 2, 10);
    // Tendrils/appendages
    g3.fillStyle(0xa855f7, 0.8);
    g3.fillTriangle(4, s3 / 2, 14, s3 / 2 - 6, 10, s3 - 4);
    g3.fillTriangle(s3 - 4, s3 / 2 - 4, s3 - 14, s3 / 2 - 8, s3 - 8, s3 - 6);
    // Extra asymmetric appendage
    g3.fillStyle(0x7c3aed, 0.7);
    g3.fillTriangle(s3 / 2, 2, s3 / 2 - 8, s3 / 2 - 8, s3 / 2 + 6, s3 / 2 - 6);
    // Menacing eyes
    g3.fillStyle(0xfbbf24, 1);
    g3.fillCircle(s3 / 2 - 6, s3 / 2 - 2, 3);
    g3.fillCircle(s3 / 2 + 5, s3 / 2 - 4, 2.5);
    g3.fillStyle(0x000000, 1);
    g3.fillCircle(s3 / 2 - 6, s3 / 2 - 2, 1.5);
    g3.fillCircle(s3 / 2 + 5, s3 / 2 - 4, 1.2);
    // Pulsing core
    g3.fillStyle(0xa855f7, 0.5);
    g3.fillCircle(s3 / 2, s3 / 2 + 4, 5);
    g3.generateTexture('alien_brute_tex', s3, s3);
    g3.destroy();
  }

  generateProjectileTextures() {
    // Player bullet — elongated energy bolt
    const bw = 10, bh = 24;
    const gb = this.make.graphics({ add: false });
    const pc = this.getProjectileColor();
    // Outer glow
    gb.fillStyle(pc, 0.3);
    gb.fillEllipse(bw / 2, bh / 2, bw, bh);
    // Mid layer
    gb.fillStyle(pc, 0.7);
    gb.fillEllipse(bw / 2, bh / 2, bw * 0.6, bh * 0.8);
    // Bright core
    gb.fillStyle(0xffffff, 1);
    gb.fillEllipse(bw / 2, bh / 2, bw * 0.3, bh * 0.6);
    gb.generateTexture('player_bullet_tex', bw, bh);
    gb.destroy();

    // Enemy bullet — pulsing red/orange orb
    const es = 12;
    const ge = this.make.graphics({ add: false });
    ge.fillStyle(0xef4444, 0.3);
    ge.fillCircle(es / 2, es / 2, es / 2);
    ge.fillStyle(0xf97316, 0.7);
    ge.fillCircle(es / 2, es / 2, es / 2 - 2);
    ge.fillStyle(0xffffff, 0.9);
    ge.fillCircle(es / 2, es / 2, 2);
    ge.generateTexture('enemy_bullet_tex', es, es);
    ge.destroy();
  }

  generatePowerupTextures() {
    const ps = 32;

    // ── Shield powerup — cyan hexagon ──
    const gs = this.make.graphics({ add: false });
    // Glow ring
    gs.fillStyle(0x22d3ee, 0.15);
    gs.fillCircle(ps / 2, ps / 2, ps / 2);
    // Hexagon
    gs.fillStyle(0x22d3ee, 0.9);
    const hexPts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      hexPts.push(ps / 2 + Math.cos(angle) * 10);
      hexPts.push(ps / 2 + Math.sin(angle) * 10);
    }
    gs.fillPoints(hexPts.reduce((acc, v, i) => {
      if (i % 2 === 0) acc.push({ x: v, y: hexPts[i + 1] });
      return acc;
    }, []), true);
    gs.lineStyle(2, 0xffffff, 0.8);
    gs.strokePoints(hexPts.reduce((acc, v, i) => {
      if (i % 2 === 0) acc.push({ x: v, y: hexPts[i + 1] });
      return acc;
    }, []), true);
    gs.fillStyle(0xffffff, 0.5);
    gs.fillCircle(ps / 2, ps / 2, 3);
    gs.generateTexture('powerup_shield_tex', ps, ps);
    gs.destroy();

    // ── Rapid powerup — lightning bolt shape ──
    const gr = this.make.graphics({ add: false });
    gr.fillStyle(0xfbbf24, 0.15);
    gr.fillCircle(ps / 2, ps / 2, ps / 2);
    gr.fillStyle(0xfbbf24, 1);
    // Lightning bolt polygon
    const boltPts = [
      { x: ps / 2 + 2, y: 4 },
      { x: ps / 2 - 6, y: ps / 2 + 2 },
      { x: ps / 2 - 1, y: ps / 2 + 1 },
      { x: ps / 2 - 3, y: ps - 4 },
      { x: ps / 2 + 6, y: ps / 2 - 2 },
      { x: ps / 2 + 1, y: ps / 2 - 1 },
    ];
    gr.fillPoints(boltPts, true);
    gr.lineStyle(1, 0xffffff, 0.7);
    gr.strokePoints(boltPts, true);
    gr.generateTexture('powerup_rapid_tex', ps, ps);
    gr.destroy();

    // ── Spread powerup — triple arrows ──
    const gp = this.make.graphics({ add: false });
    gp.fillStyle(0xa855f7, 0.15);
    gp.fillCircle(ps / 2, ps / 2, ps / 2);
    // Three small arrows pointing up
    gp.fillStyle(0xa855f7, 1);
    const drawArrow = (cx, cy) => {
      gp.fillTriangle(cx, cy - 5, cx - 3, cy + 3, cx + 3, cy + 3);
    };
    drawArrow(ps / 2, ps / 2 - 1);
    drawArrow(ps / 2 - 7, ps / 2 + 3);
    drawArrow(ps / 2 + 7, ps / 2 + 3);
    gp.lineStyle(1, 0xffffff, 0.6);
    gp.strokeCircle(ps / 2, ps / 2, 12);
    gp.generateTexture('powerup_spread_tex', ps, ps);
    gp.destroy();
  }

  generateShardTexture() {
    const ss = 20;
    const g = this.make.graphics({ add: false });
    // Outer glow
    g.fillStyle(0x06b6d4, 0.2);
    g.fillCircle(ss / 2, ss / 2, ss / 2);
    // Multi-faceted crystal
    g.fillStyle(0x22d3ee, 1);
    const crystalPts = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 2;
      const r = (i % 2 === 0) ? 7 : 4;
      crystalPts.push({ x: ss / 2 + Math.cos(angle) * r, y: ss / 2 + Math.sin(angle) * r });
    }
    g.fillPoints(crystalPts, true);
    // Inner highlight
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(ss / 2, ss / 2, 2);
    g.lineStyle(1, 0x67e8f9, 0.8);
    g.strokePoints(crystalPts, true);
    g.generateTexture('shard_tex', ss, ss);
    g.destroy();
  }

  generateBossTexture() {
    const bs = 128;
    const g = this.make.graphics({ add: false });

    // Main hull — large angular shape
    g.fillStyle(0x991b1b, 1);
    g.fillTriangle(bs / 2, bs - 4, 8, 20, bs - 8, 20);

    // Armored center plate
    g.fillStyle(0xdc2626, 1);
    g.fillTriangle(bs / 2, bs - 16, 20, 28, bs - 20, 28);

    // Wing sections — left
    g.fillStyle(0xb91c1c, 0.9);
    g.fillTriangle(4, 16, 24, 24, 10, bs / 2 + 20);
    // Wing sections — right
    g.fillTriangle(bs - 4, 16, bs - 24, 24, bs - 10, bs / 2 + 20);

    // Secondary wing tips
    g.fillStyle(0xef4444, 0.7);
    g.fillTriangle(2, 12, 14, 20, 4, 40);
    g.fillTriangle(bs - 2, 12, bs - 14, 20, bs - 4, 40);

    // Command bridge / cockpit
    g.fillStyle(0x1e1e1e, 1);
    g.fillCircle(bs / 2, 36, 10);
    g.fillStyle(0xff4444, 0.8);
    g.fillCircle(bs / 2, 36, 6);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(bs / 2 - 2, 34, 2);

    // Weapon hardpoints
    g.fillStyle(0xfbbf24, 1);
    g.fillCircle(bs / 2 - 30, bs - 20, 4);
    g.fillCircle(bs / 2, bs - 8, 4);
    g.fillCircle(bs / 2 + 30, bs - 20, 4);
    g.fillStyle(0xff6b35, 0.6);
    g.fillCircle(bs / 2 - 30, bs - 20, 6);
    g.fillCircle(bs / 2, bs - 8, 6);
    g.fillCircle(bs / 2 + 30, bs - 20, 6);

    // Engine array across top
    g.fillStyle(0xff4444, 0.6);
    for (let i = -2; i <= 2; i++) {
      g.fillCircle(bs / 2 + i * 14, 16, 5);
    }
    g.fillStyle(0xffffff, 0.5);
    for (let i = -2; i <= 2; i++) {
      g.fillCircle(bs / 2 + i * 14, 16, 2);
    }

    // Hull detail lines
    g.lineStyle(1, 0xff6b6b, 0.4);
    g.lineBetween(bs / 2, 28, 18, bs / 2 + 10);
    g.lineBetween(bs / 2, 28, bs - 18, bs / 2 + 10);
    g.lineBetween(bs / 2, bs - 16, 28, 40);
    g.lineBetween(bs / 2, bs - 16, bs - 28, 40);

    g.generateTexture('boss_ship_tex', bs, bs);
    g.destroy();
  }

  // ═══════════════════════════════════════
  //  VISUAL HELPER METHODS
  // ═══════════════════════════════════════

  drawHexShield(graphics, x, y, radius) {
    graphics.clear();
    // Outer glow
    graphics.lineStyle(4, 0x22d3ee, 0.15);
    const outerPts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      outerPts.push({ x: x + Math.cos(a) * (radius + 4), y: y + Math.sin(a) * (radius + 4) });
    }
    graphics.strokePoints(outerPts, true);

    // Main hex border
    graphics.lineStyle(2, 0x22d3ee, 0.6);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      pts.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius });
    }
    graphics.strokePoints(pts, true);

    // Inner hex
    graphics.lineStyle(1, 0x22d3ee, 0.3);
    const innerPts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      innerPts.push({ x: x + Math.cos(a) * (radius - 6), y: y + Math.sin(a) * (radius - 6) });
    }
    graphics.strokePoints(innerPts, true);

    // Fill
    graphics.fillStyle(0x22d3ee, 0.08);
    graphics.fillPoints(pts, true);
  }

  spawnEngineTrail(x, y, color, size) {
    const trail = this.add.circle(x, y, size || 3, color || this.getProjectileColor(), 0.5).setDepth(8);
    this.tweens.add({
      targets: trail,
      alpha: 0, scaleX: 0.1, scaleY: 2, y: y + 20,
      duration: 250,
      onComplete: () => trail.destroy()
    });
  }

  spawnBulletTrail(bullet, color) {
    if (!bullet || !bullet.active) return;
    const trail = this.add.circle(bullet.x, bullet.y + 6, 2, color, 0.3).setDepth(7);
    this.tweens.add({
      targets: trail,
      alpha: 0, scale: 0.2, duration: 180,
      onComplete: () => trail.destroy()
    });
  }

  createExplosion(x, y, color, isBoss) {
    const { width } = this.cameras.main;
    const size = isBoss ? 2.5 : 1;

    // Layer 1: White flash circle
    const flash = this.add.circle(x, y, 8 * size, 0xffffff, 0.9).setDepth(20);
    this.tweens.add({
      targets: flash,
      scale: 4 * size, alpha: 0, duration: 200,
      onComplete: () => flash.destroy()
    });

    // Layer 2: Colored expanding ring
    const ring = this.add.circle(x, y, 12 * size, color || 0xfbbf24, 0).setDepth(19)
      .setStrokeStyle(3, color || 0xfbbf24, 0.8);
    this.tweens.add({
      targets: ring,
      scale: 3 * size, alpha: 0, duration: 350,
      onComplete: () => ring.destroy()
    });

    // Layer 3: Debris particles
    const debrisCount = isBoss ? 24 : 14;
    for (let i = 0; i < debrisCount; i++) {
      const angle = (i / debrisCount) * Math.PI * 2;
      const speed = Phaser.Math.Between(40, 100) * size;
      const debrisColor = Phaser.Math.Between(0, 1) ? 0xfbbf24 : (color || 0xef4444);
      const pSize = Phaser.Math.Between(1, 4) * size;
      const p = this.add.rectangle(x, y, pSize, pSize, debrisColor).setDepth(18).setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, angle: p.angle + Phaser.Math.Between(-180, 180),
        scale: 0, duration: Phaser.Math.Between(300, 600),
        onComplete: () => p.destroy()
      });
    }

    // Camera shake on boss kills
    if (isBoss) {
      this.cameras.main.shake(500, 0.04);
      this.cameras.main.flash(300, 255, 100, 50);
      // Screen-wide energy wave
      const wave = this.add.circle(x, y, 10, 0xffffff, 0).setDepth(21)
        .setStrokeStyle(4, 0xffffff, 0.6);
      this.tweens.add({
        targets: wave,
        scale: Math.max(width / 10, 20), alpha: 0, duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => wave.destroy()
      });
    }
  }

  // ═══════════════════════════════════════
  //  CORE GAME LOGIC (PRESERVED)
  // ═══════════════════════════════════════

  // ── Projectile Color Map ──
  getProjectileColor() {
    const map = {
      iron_kid: 0x06b6d4, super_girl: 0xfbbf24, superboy: 0x2563eb,
      cyborg_girl: 0x06b6d4, hero_red: 0xff0000, hero_black: 0x475569,
      telekinetic_girl: 0xa855f7, jedi_kid: 0x22c55e, alien_brute: 0x000000,
      enemy_thug: 0xdc2626, enemy_trooper: 0xffffff
    };
    return map[this.activeHero] || 0x22d3ee;
  }

  autoFire() {
    if (!this.playerAlive) return;
    const { width } = this.cameras.main;
    const color = this.getProjectileColor();

    if (this.spreadShot) {
      [-20, 0, 20].forEach(offset => {
        const bullet = this.physics.add.sprite(this.player.x + offset, this.player.y - 35, 'player_bullet_tex').setDepth(8);
        bullet.body.setVelocity(offset * 3, -450);
        bullet.setDisplaySize(8, 20);
        bullet.bulletColor = color;
        this.projectiles.add(bullet);
      });
    } else {
      const bullet = this.physics.add.sprite(this.player.x, this.player.y - 35, 'player_bullet_tex').setDepth(8);
      bullet.body.setVelocityY(-500);
      bullet.setDisplaySize(8, 20);
      bullet.bulletColor = color;
      this.projectiles.add(bullet);
    }
  }

  // ── Wave Spawning ──
  spawnWave() {
    const { width } = this.cameras.main;
    const isBoss = this.wave % 5 === 0;

    // ── Wave Transition Effect ──
    if (isBoss) {
      // Boss warning banner
      const warningBg = this.add.rectangle(width / 2, 200, width, 60, 0x000000, 0.7).setDepth(99);
      const warning = this.add.text(width / 2, 200, `⚠ WARNING — BOSS WAVE ${this.wave} ⚠`, {
        fontFamily: 'Arial Black', fontSize: '32px',
        color: '#ef4444', stroke: '#000', strokeThickness: 5
      }).setOrigin(0.5).setDepth(100).setAlpha(0);
      warning.setShadow(0, 0, '#ef4444', 12, false, true);

      // Flashing warning
      this.tweens.add({ targets: warning, alpha: 1, duration: 200 });
      this.tweens.add({
        targets: warning, alpha: { from: 1, to: 0.3 }, duration: 200,
        yoyo: true, repeat: 4, delay: 200
      });
      this.tweens.add({
        targets: [warning, warningBg], alpha: 0, duration: 300, delay: 1400,
        onComplete: () => { warning.destroy(); warningBg.destroy(); }
      });

      // Red screen pulse
      this.cameras.main.flash(400, 80, 0, 0);
    } else {
      // Normal wave announcement — dramatic zoom-in + fade
      const announce = this.add.text(width / 2, 200, `WAVE ${this.wave}`, {
        fontFamily: 'Arial Black', fontSize: '36px',
        color: '#fbbf24', stroke: '#000', strokeThickness: 5
      }).setOrigin(0.5).setDepth(100).setAlpha(0).setScale(0.3);
      announce.setShadow(0, 0, '#fbbf24', 10, false, true);

      this.tweens.add({
        targets: announce, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut'
      });
      this.tweens.add({
        targets: announce, alpha: 0, scale: 1.5, duration: 400, delay: 1000,
        onComplete: () => announce.destroy()
      });
    }

    if (isBoss) {
      this.spawnBoss();
    } else {
      // Formation patterns
      const patterns = ['grid', 'vee', 'circle'];
      const pattern = patterns[this.wave % patterns.length];
      const enemyCount = Math.min(5 + this.wave * 2, 30);
      const enemyTypes = ['enemy_thug', 'enemy_trooper', 'alien_brute'];
      const enemyTexMap = {
        enemy_thug: 'enemy_thug_tex',
        enemy_trooper: 'enemy_trooper_tex',
        alien_brute: 'alien_brute_tex'
      };

      this.time.delayedCall(800, () => {
        for (let i = 0; i < enemyCount; i++) {
          this.time.delayedCall(i * 150, () => {
            const type = enemyTypes[Phaser.Math.Between(0, Math.min(this.wave - 1, 2))];
            const hp = type === 'alien_brute' ? 3 : type === 'enemy_trooper' ? 2 : 1;
            let ex, ey;

            if (pattern === 'grid') {
              const cols = Math.min(enemyCount, 8);
              const spacing = (width - 100) / cols;
              ex = 50 + (i % cols) * spacing + spacing / 2;
              ey = -50 - Math.floor(i / cols) * 60;
            } else if (pattern === 'vee') {
              const half = enemyCount / 2;
              ex = width / 2 + (i - half) * 45;
              ey = -50 - Math.abs(i - half) * 40;
            } else {
              const angle = (i / enemyCount) * Math.PI * 2;
              ex = width / 2 + Math.cos(angle) * 150;
              ey = -200 + Math.sin(angle) * 80;
            }

            const enemy = this.physics.add.sprite(ex, ey, enemyTexMap[type]);
            enemy.setDisplaySize(45, 45).setDepth(8);
            enemy.hp = hp;
            enemy.maxHp = hp;
            enemy.enemyType = type;
            enemy.body.setVelocityY(40 + this.wave * 5);
            this.enemies.add(enemy);

            // Sweep movement
            this.tweens.add({
              targets: enemy,
              x: enemy.x + Phaser.Math.Between(-80, 80),
              duration: Phaser.Math.Between(1500, 3000),
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut'
            });

            // Enemy shooting (occasional)
            if (Phaser.Math.Between(1, 100) <= 30 + this.wave * 2) {
              this.time.addEvent({
                delay: Phaser.Math.Between(2000, 5000),
                callback: () => {
                  if (enemy.active) {
                    const eb = this.physics.add.sprite(enemy.x, enemy.y + 25, 'enemy_bullet_tex').setDepth(7);
                    eb.setDisplaySize(10, 10);
                    eb.body.setVelocityY(200 + this.wave * 10);
                    this.enemyBullets.add(eb);
                    // Pulsing glow on enemy bullet
                    this.tweens.add({
                      targets: eb, scaleX: { from: 1, to: 1.4 }, scaleY: { from: 1, to: 1.4 },
                      duration: 200, yoyo: true, repeat: -1
                    });
                  }
                },
                loop: true
              });
            }
          });
        }
      });
    }
  }

  spawnBoss() {
    const { width } = this.cameras.main;

    // Dramatic entrance energy wave
    const entranceWave = this.add.circle(width / 2, 0, 10, 0xef4444, 0)
      .setStrokeStyle(3, 0xef4444, 0.5).setDepth(15);
    this.tweens.add({
      targets: entranceWave, scaleX: width / 10, scaleY: 4, alpha: 0, duration: 800,
      ease: 'Quad.easeOut', onComplete: () => entranceWave.destroy()
    });

    const boss = this.physics.add.sprite(width / 2, -100, 'boss_ship_tex');
    boss.setDisplaySize(120, 120).setDepth(8);
    boss.hp = 20 + this.wave * 5;
    boss.maxHp = boss.hp;
    boss.isBoss = true;
    boss.enemyType = 'boss';
    this.enemies.add(boss);

    // Boss movement
    this.tweens.add({
      targets: boss, y: 120, duration: 1500, ease: 'Bounce.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: boss, x: width - 80, duration: 2000, yoyo: true,
          repeat: -1, ease: 'Sine.easeInOut'
        });
        // Boss rapid fire
        this.time.addEvent({
          delay: 800,
          callback: () => {
            if (boss.active) {
              for (let a = -1; a <= 1; a++) {
                const eb = this.physics.add.sprite(boss.x + a * 30, boss.y + 65, 'enemy_bullet_tex').setDepth(7);
                eb.setDisplaySize(12, 12);
                eb.body.setVelocity(a * 50, 250);
                this.enemyBullets.add(eb);
                this.tweens.add({
                  targets: eb, scaleX: { from: 1, to: 1.3 }, scaleY: { from: 1, to: 1.3 },
                  duration: 180, yoyo: true, repeat: -1
                });
              }
            }
          },
          loop: true
        });
      }
    });

    // Boss health bar — gradient fill with frame
    boss.hpBar = this.add.rectangle(width / 2, 60, 300, 14, 0x1e293b).setDepth(100)
      .setStrokeStyle(2, 0x475569);
    boss.hpFill = this.add.rectangle(width / 2 - 150, 60, 300, 14, 0xef4444).setDepth(101).setOrigin(0, 0.5);
    // Gradient overlay on health fill
    boss.hpShine = this.add.rectangle(width / 2 - 150, 56, 300, 4, 0xffffff, 0.15).setDepth(102).setOrigin(0, 0.5);
    boss.hpLabel = this.add.text(width / 2, 42, '⚠ BOSS ⚠', {
      fontFamily: 'Arial Black', fontSize: '13px', color: '#ef4444', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(101);
    boss.hpLabel.setShadow(0, 0, '#ef4444', 6, false, true);
  }

  // ── Hit Logic ──
  hitEnemy(projectile, enemy) {
    projectile.destroy();
    enemy.hp--;

    // Flash effect
    enemy.setTint(0xffffff);
    this.time.delayedCall(80, () => { if (enemy.active) enemy.clearTint(); });

    // Hit spark
    const spark = this.add.circle(enemy.x + Phaser.Math.Between(-8, 8), enemy.y + Phaser.Math.Between(-8, 8), 4, 0xffffff, 0.8).setDepth(16);
    this.tweens.add({ targets: spark, scale: 0, alpha: 0, duration: 150, onComplete: () => spark.destroy() });

    if (enemy.hp <= 0) {
      this.score += enemy.isBoss ? 500 : (enemy.maxHp * 50);

      // Animated score counter
      const targetScore = this.score;
      this.tweens.addCounter({
        from: targetScore - (enemy.isBoss ? 500 : enemy.maxHp * 50),
        to: targetScore,
        duration: 300,
        onUpdate: (tween) => {
          this.scoreText.setText('SCORE: ' + Math.floor(tween.getValue()));
        }
      });
      // Score text pulse
      this.tweens.add({
        targets: this.scoreText, scale: { from: 1.2, to: 1 }, duration: 200
      });

      // Multi-layered explosion
      const expColor = enemy.enemyType === 'enemy_thug' ? 0xef4444 :
                        enemy.enemyType === 'enemy_trooper' ? 0x3b82f6 :
                        enemy.enemyType === 'alien_brute' ? 0x10b981 : 0xef4444;
      this.createExplosion(enemy.x, enemy.y, expColor, enemy.isBoss);

      // Drop shard
      if (Phaser.Math.Between(1, 100) <= 60) {
        const shard = this.physics.add.sprite(enemy.x, enemy.y, 'shard_tex').setDepth(8);
        shard.setDisplaySize(16, 16);
        shard.body.setVelocityY(80);
        this.shards.add(shard);
        // Pulsing scale + rotation
        this.tweens.add({
          targets: shard, scaleX: { from: 1, to: 1.3 }, scaleY: { from: 1, to: 1.3 },
          duration: 500, yoyo: true, repeat: -1
        });
        this.tweens.add({ targets: shard, angle: 360, duration: 2000, repeat: -1 });
        // Orbiting sparkle
        shard.sparkle = this.add.circle(shard.x, shard.y, 1.5, 0x67e8f9, 0.8).setDepth(8);
        shard._sparkleAngle = 0;
      }

      // Drop powerup (rare)
      if (Phaser.Math.Between(1, 100) <= 10) {
        const types = ['shield', 'rapid', 'spread'];
        const type = types[Phaser.Math.Between(0, 2)];
        const texMap = { shield: 'powerup_shield_tex', rapid: 'powerup_rapid_tex', spread: 'powerup_spread_tex' };
        const pu = this.physics.add.sprite(enemy.x, enemy.y, texMap[type]).setDepth(8);
        pu.setDisplaySize(28, 28);
        pu.powerType = type;
        pu.body.setVelocityY(60);
        this.powerups.add(pu);

        // Bob + rotate + pulse
        this.tweens.add({
          targets: pu, y: pu.y - 6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        this.tweens.add({ targets: pu, angle: 360, duration: 3000, repeat: -1 });
        this.tweens.add({
          targets: pu, scaleX: { from: 1, to: 1.15 }, scaleY: { from: 1, to: 1.15 },
          duration: 400, yoyo: true, repeat: -1
        });

        // Label
        const labelColors = { shield: '#22d3ee', rapid: '#fbbf24', spread: '#a855f7' };
        const labelText = type.toUpperCase();
        pu.label = this.add.text(pu.x, pu.y + 18, labelText, {
          fontFamily: 'Arial Black', fontSize: '8px', color: labelColors[type],
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(8);
      }

      // Boss specific cleanup
      if (enemy.isBoss) {
        if (enemy.hpBar) enemy.hpBar.destroy();
        if (enemy.hpFill) enemy.hpFill.destroy();
        if (enemy.hpShine) enemy.hpShine.destroy();
        if (enemy.hpLabel) enemy.hpLabel.destroy();

        // Lume reward for boss
        const save = SaveSystem.load();
        save.lumes = (save.lumes || 0) + 3;
        SaveSystem.save(save);
      }

      enemy.destroy();

      // Check wave clear
      if (this.enemies.countActive() === 0) {
        this.wave++;
        this.waveText.setText('WAVE ' + this.wave);
        // Wave text pulse
        this.tweens.add({
          targets: this.waveText, scale: { from: 1.4, to: 1 }, duration: 300
        });

        // Lume per 5 waves
        if (this.wave % 5 === 1 && this.wave > 1) {
          const save = SaveSystem.load();
          save.lumes = (save.lumes || 0) + 1;
          SaveSystem.save(save);
        }

        this.time.delayedCall(1500, () => this.spawnWave());
      }
    } else if (enemy.isBoss && enemy.hpFill) {
      const newWidth = 300 * (enemy.hp / enemy.maxHp);
      enemy.hpFill.setDisplaySize(newWidth, 14);
      if (enemy.hpShine) enemy.hpShine.setDisplaySize(newWidth, 4);
      // Damage flash on health bar
      this.tweens.add({
        targets: enemy.hpFill,
        fillColor: { from: 0xffffff, to: 0xef4444 }, duration: 150
      });
      // Boss damage flash tint
      enemy.setTint(0xff6666);
      this.time.delayedCall(120, () => { if (enemy.active) enemy.clearTint(); });
    }
  }

  playerHit(player, damager) {
    if (this.shieldActive) {
      damager.destroy();
      // Shield absorb effect
      const absorb = this.add.circle(player.x, player.y, 40, 0x22d3ee, 0.4).setDepth(15);
      this.tweens.add({ targets: absorb, scale: 1.5, alpha: 0, duration: 300, onComplete: () => absorb.destroy() });
      return;
    }
    if (!this.playerAlive) return;
    this.playerAlive = false;
    damager.destroy();

    // Death explosion
    this.createExplosion(player.x, player.y, this.getProjectileColor(), false);

    // Death flash
    this.cameras.main.shake(300, 0.03);
    this.cameras.main.flash(200, 255, 0, 0);
    player.setTint(0xff0000);

    // Fade player out
    this.tweens.add({ targets: player, alpha: 0, duration: 400 });

    this.time.delayedCall(500, () => this.showGameOver());
  }

  collectPowerup(player, powerup) {
    const type = powerup.powerType;
    // Destroy label if it exists
    if (powerup.label) powerup.label.destroy();
    powerup.destroy();

    // Collection flash
    const collectFlash = this.add.circle(player.x, player.y, 20, 0xffffff, 0.5).setDepth(15);
    this.tweens.add({ targets: collectFlash, scale: 2, alpha: 0, duration: 300, onComplete: () => collectFlash.destroy() });

    if (type === 'shield') {
      this.shieldActive = true;
      this.shieldGraphic.setVisible(true);
      this.time.delayedCall(5000, () => { this.shieldActive = false; this.shieldGraphic.setVisible(false); });
    } else if (type === 'rapid') {
      this.rapidFire = true;
      this.time.removeAllEvents();
      this.time.addEvent({ delay: 150, callback: this.autoFire, callbackScope: this, loop: true });
      this.time.delayedCall(4000, () => {
        this.rapidFire = false;
        this.time.removeAllEvents();
        this.time.addEvent({ delay: this.fireRate, callback: this.autoFire, callbackScope: this, loop: true });
      });
    } else if (type === 'spread') {
      this.spreadShot = true;
      this.time.delayedCall(5000, () => { this.spreadShot = false; });
    }

    // Popup text
    const popupColors = { shield: '#22d3ee', rapid: '#fbbf24', spread: '#a855f7' };
    const popupLabels = { shield: '⬡ SHIELD!', rapid: '⚡ RAPID!', spread: '◆◆◆ SPREAD!' };
    const txt = this.add.text(player.x, player.y - 40, popupLabels[type], {
      fontFamily: 'Arial Black', fontSize: '16px', color: popupColors[type],
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(100);
    txt.setShadow(0, 0, popupColors[type], 8, false, true);
    this.tweens.add({
      targets: txt, y: txt.y - 50, alpha: 0, scale: 1.3, duration: 900,
      onComplete: () => txt.destroy()
    });
  }

  collectShard(player, shard) {
    // Destroy orbiting sparkle
    if (shard.sparkle) shard.sparkle.destroy();
    shard.destroy();
    this.shardsCollected++;
    this.shardText.setText('' + this.shardsCollected);
    this.score += 10;
    this.scoreText.setText('SCORE: ' + this.score);

    // Collection effect — sparkle burst
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const sp = this.add.circle(player.x, player.y, 2, 0x22d3ee, 0.8).setDepth(15);
      this.tweens.add({
        targets: sp,
        x: player.x + Math.cos(angle) * 25,
        y: player.y + Math.sin(angle) * 25,
        alpha: 0, scale: 0, duration: 300,
        onComplete: () => sp.destroy()
      });
    }

    // Shard counter pulse
    this.tweens.add({ targets: this.shardText, scale: { from: 1.4, to: 1 }, duration: 200 });
    this.tweens.add({ targets: this.shardIcon, scale: { from: 1.6, to: 1 }, duration: 200 });
  }

  showGameOver() {
    const { width, height } = this.cameras.main;

    // Save progress
    const save = SaveSystem.load();
    save.shards = (save.shards || 0) + this.shardsCollected;
    SaveSystem.save(save);

    // Overlay with fade-in
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setDepth(200);
    this.tweens.add({ targets: overlay, alpha: 0.75, duration: 500 });

    // Game Over text — dramatic entrance
    const goText = this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
      fontFamily: 'Arial Black', fontSize: '40px', color: '#ef4444',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(201).setScale(0.1).setAlpha(0);
    goText.setShadow(0, 0, '#ef4444', 12, false, true);
    this.tweens.add({ targets: goText, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });

    // Stats with delayed fade-in
    const stats = this.add.text(width / 2, height / 2 - 20, `Score: ${this.score}   Waves: ${this.wave}   Shards: ${this.shardsCollected}`, {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#22d3ee',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(201).setAlpha(0);
    stats.setShadow(0, 0, '#22d3ee', 6, false, true);
    this.tweens.add({ targets: stats, alpha: 1, duration: 400, delay: 400 });

    // Retry button
    const retry = this.add.text(width / 2, height / 2 + 50, '▶ PLAY AGAIN', {
      fontFamily: 'Arial Black', fontSize: '24px', color: '#10b981',
      stroke: '#000', strokeThickness: 4, backgroundColor: '#0f172a',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true }).setAlpha(0);
    retry.setShadow(0, 0, '#10b981', 6, false, true);
    this.tweens.add({ targets: retry, alpha: 1, duration: 400, delay: 700 });
    retry.on('pointerover', () => retry.setScale(1.05));
    retry.on('pointerout', () => retry.setScale(1));
    retry.on('pointerdown', () => this.scene.restart());

    // Exit button
    const exit = this.add.text(width / 2, height / 2 + 110, '← EXIT', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#94a3b8',
      stroke: '#000', strokeThickness: 3, backgroundColor: '#0f172a',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true }).setAlpha(0);
    this.tweens.add({ targets: exit, alpha: 1, duration: 400, delay: 900 });
    exit.on('pointerover', () => exit.setScale(1.05));
    exit.on('pointerout', () => exit.setScale(1));
    exit.on('pointerdown', () => {
      if (typeof window.goBackToPortal === 'function') {
        window.goBackToPortal();
      } else {
        if (window.riftInvadersGame) {
          window.riftInvadersGame.destroy(true);
          window.riftInvadersGame = null;
        }
        document.getElementById('game-container-invaders').style.display = 'none';
        document.getElementById('aiden-portal').style.display = 'block';
      }
    });
  }

  update() {
    const { width, height } = this.cameras.main;

    // Starfield scroll
    this.bgTiles.forEach(star => {
      star.y += star.speed;
      if (star.y > height) { star.y = 0; star.x = Phaser.Math.Between(0, width); }
    });

    // Shield follows player (hexagonal)
    if (this.shieldGraphic && this.shieldActive) {
      this.shieldGraphic.setPosition(this.player.x, this.player.y);
      this.shieldAngle = (this.shieldAngle || 0) + 0.01;
      this.shieldGraphic.setRotation(this.shieldAngle);
    }

    // Engine glow follows player
    if (this.engineGlow && this.playerAlive) {
      this.engineGlow.setPosition(this.player.x, this.player.y + 26);
    }

    // ── Engine Trail Particles ──
    if (this.playerAlive && this.player.active) {
      // Dual engine trails
      this.spawnEngineTrail(this.player.x - 10, this.player.y + 28, this.getProjectileColor(), 2.5);
      this.spawnEngineTrail(this.player.x + 10, this.player.y + 28, this.getProjectileColor(), 2.5);
    }

    // ── Boss Engine Trails ──
    this.enemies.getChildren().forEach(e => {
      if (e.active && e.isBoss) {
        // Larger red engine trails for boss
        if (Phaser.Math.Between(1, 3) === 1) {
          this.spawnEngineTrail(e.x - 20, e.y - 50, 0xef4444, 4);
          this.spawnEngineTrail(e.x + 20, e.y - 50, 0xef4444, 4);
          this.spawnEngineTrail(e.x, e.y - 55, 0xff6b35, 3);
        }
      }
    });

    // ── Bullet Trails ──
    this.projectiles.getChildren().forEach(b => {
      if (b.active && Phaser.Math.Between(1, 2) === 1) {
        this.spawnBulletTrail(b, this.getProjectileColor());
      }
    });

    // ── Update Shard Sparkles ──
    this.shards.getChildren().forEach(s => {
      if (s.active && s.sparkle) {
        s._sparkleAngle = (s._sparkleAngle || 0) + 0.08;
        s.sparkle.setPosition(
          s.x + Math.cos(s._sparkleAngle) * 12,
          s.y + Math.sin(s._sparkleAngle) * 12
        );
      }
    });

    // ── Update Powerup Labels ──
    this.powerups.getChildren().forEach(p => {
      if (p.active && p.label) {
        p.label.setPosition(p.x, p.y + 18);
      }
    });

    // Cleanup off-screen objects
    this.projectiles.getChildren().forEach(b => { if (b.y < -20) b.destroy(); });
    this.enemyBullets.getChildren().forEach(b => { if (b.y > height + 20) b.destroy(); });
    this.enemies.getChildren().forEach(e => { if (e.y > height + 60) e.destroy(); });
    this.shards.getChildren().forEach(s => {
      if (s.y > height + 20) {
        if (s.sparkle) s.sparkle.destroy();
        s.destroy();
      }
    });
    this.powerups.getChildren().forEach(p => {
      if (p.y > height + 20) {
        if (p.label) p.label.destroy();
        p.destroy();
      }
    });
  }
}
