/* Myth x Bio Tower Defense MVP (Phaser 3)
 * - Grid tiles, fixed path
 * - Click to place towers (not on path)
 * - Enemies follow path, towers shoot bullets
 * - Money, Lives, Waves, Basic upgrade
 */

const CFG = {
  tileSize: 56,
  gridW: 14,
  gridH: 9,
  topBarH: 56,
  startMoney: 120,
  startLives: 15,
};

const COLORS = {
  bg: 0x0b1020,
  tile: 0x141a2f,
  tile2: 0x11162a,
  path: 0x2a3458,
  pathEdge: 0x3a4775,
  tower: 0x58d7ff,
  tower2: 0xffb86b,
  enemy: 0xff4d6d,
  enemy2: 0xb8ff6b,
  bullet: 0xffffff,
  ui: 0xdce3ff,
  danger: 0xff6b6b,
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

class Enemy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, opts) {
    super(scene, x, y);
    this.scene = scene;
    this.maxHp = opts.maxHp;
    this.hp = opts.maxHp;
    this.speed = opts.speed; // pixels per second
    this.reward = opts.reward;
    this.damageToCore = opts.damageToCore ?? 1;

    this.bodyCircle = scene.add.circle(0, 0, 16, opts.color ?? COLORS.enemy);
    this.hpBg = scene.add.rectangle(0, -24, 34, 6, 0x000000, 0.5);
    this.hpBar = scene.add.rectangle(-17, -24, 34, 6, 0x59ff9a, 0.9).setOrigin(0, 0.5);

    this.add([this.bodyCircle, this.hpBg, this.hpBar]);
    scene.add.existing(this);

    this.pathIndex = 0;
    this.isDead = false;
    this.reachedEnd = false;
  }

  setHp(v) {
    this.hp = clamp(v, 0, this.maxHp);
    const w = 34 * (this.hp / this.maxHp);
    this.hpBar.width = w;
  }

  takeDamage(dmg) {
    if (this.isDead || this.reachedEnd) return false;
    this.setHp(this.hp - dmg);
    if (this.hp <= 0) {
      this.isDead = true;
      this.scene.events.emit("enemyKilled", this);
      this.destroy();
      return true;
    }
    return false;
  }

  updateFollowPath(dt, pathPoints) {
    if (this.isDead || this.reachedEnd) return;

    const target = pathPoints[this.pathIndex + 1];
    if (!target) {
      // reached end
      this.reachedEnd = true;
      this.scene.events.emit("enemyEscaped", this);
      this.destroy();
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    const step = (this.speed * dt) / 1000;
    if (dist <= step) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex += 1;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }
}

class Bullet extends Phaser.GameObjects.Arc {
  constructor(scene, x, y, target, dmg, speed = 520) {
    super(scene, x, y, 4, 0, 360, false, COLORS.bullet, 1);
    this.scene = scene;
    this.target = target;
    this.dmg = dmg;
    this.speed = speed;
    this.lifeMs = 1500;
    this.ageMs = 0;
    scene.add.existing(this);
  }

  update(dt) {
    this.ageMs += dt;
    if (this.ageMs >= this.lifeMs) {
      this.destroy();
      return;
    }

    if (!this.target || !this.target.scene || this.target.isDead) {
      this.destroy();
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = (this.speed * dt) / 1000;

    if (dist <= step + 8) {
      // hit
      this.target.takeDamage(this.dmg);
      this.destroy();
      return;
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
  }
}

class Tower extends Phaser.GameObjects.Container {
  constructor(scene, tileX, tileY, opts) {
    const { x, y } = scene.tileToWorldCenter(tileX, tileY);
    super(scene, x, y);
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;

    this.type = opts.type;          // "ranger" | "slow"
    this.level = 1;
    this.range = opts.range;        // pixels
    this.fireRate = opts.fireRate;  // shots per second
    this.damage = opts.damage;
    this.color = opts.color;
    this.cost = opts.cost;

    this.cooldown = 0;

    this.base = scene.add.circle(0, 0, 18, this.color, 0.95);
    this.ring = scene.add.circle(0, 0, this.range, this.color, 0.08).setVisible(false);
    this.top = scene.add.rectangle(0, 0, 10, 26, 0x0b1020, 0.7).setOrigin(0.5, 0.8);

    this.add([this.ring, this.base, this.top]);

    this.setSize(36, 36);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);

    this.on("pointerover", () => this.ring.setVisible(true));
    this.on("pointerout", () => this.ring.setVisible(false));

    scene.add.existing(this);
  }

  tryShoot(dt, enemies, bullets) {
    this.cooldown -= dt / 1000;
    if (this.cooldown > 0) return;

    // find nearest enemy in range
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (!e || !e.scene || e.isDead) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d <= this.range && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return;

    // shoot
    const b = new Bullet(this.scene, this.x, this.y, best, this.damage);
    bullets.push(b);
    this.cooldown = 1 / this.fireRate;
  }

  upgrade() {
    this.level += 1;
    // simple scaling
    this.damage = Math.round(this.damage * 1.25);
    this.fireRate = this.fireRate * 1.08;
    this.range = this.range + 8;
    this.ring.setRadius(this.range);
    // visual hint
    this.base.setScale(1 + (this.level - 1) * 0.06);
  }

  getUpgradeCost() {
    return Math.floor(this.cost * (0.7 + this.level * 0.55));
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.tiles = [];    // tile rects for highlighting
    this.pathSet = new Set(); // "x,y"
    this.blockedSet = new Set();
    this.towers = [];
    this.enemies = [];
    this.bullets = [];

    this.money = CFG.startMoney;
    this.lives = CFG.startLives;
    this.wave = 0;
    this.isSpawning = false;

    this.selectedTowerType = "ranger"; // default
    this.selectedTower = null;
  }

  preload() {}

  create() {
    const W = CFG.gridW * CFG.tileSize;
    const H = CFG.gridH * CFG.tileSize + CFG.topBarH;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    // UI bar
    this.uiBar = this.add.rectangle(W / 2, CFG.topBarH / 2, W, CFG.topBarH, 0x0f1530, 1);

    this.uiText = this.add.text(14, 14, "", {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      fontSize: "16px",
      color: "#dce3ff"
    });

    this.hintText = this.add.text(W - 14, 14, "", {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      fontSize: "14px",
      color: "#dce3ff"
    }).setOrigin(1, 0);

    // Build grid
    this.drawGrid();

    // Define a fixed path by tile coords (simple snake-ish)
    // You can edit these tiles to shape your first map.
    const pathTiles = [
      [0, 4],[1, 4],[2, 4],[3, 4],[4, 4],
      [4, 3],[4, 2],
      [5, 2],[6, 2],[7, 2],[8, 2],
      [8, 3],[8, 4],[8, 5],
      [9, 5],[10, 5],[11, 5],[12, 5],[13, 5]
    ];
    this.buildPath(pathTiles);

    // Input
    this.input.on("pointerdown", (p) => this.onPointerDown(p));

    // Hotkeys
    this.input.keyboard.on("keydown-ONE", () => this.selectedTowerType = "ranger");
    this.input.keyboard.on("keydown-TWO", () => this.selectedTowerType = "slow");
    this.input.keyboard.on("keydown-N", () => this.startNextWave());
    this.input.keyboard.on("keydown-U", () => this.tryUpgradeSelected());

    // events
    this.events.on("enemyKilled", (enemy) => {
      this.money += enemy.reward;
      // remove from array lazily in update
    });

    this.events.on("enemyEscaped", (enemy) => {
      this.lives -= enemy.damageToCore;
      this.lives = Math.max(0, this.lives);
    });

    // Start wave 1 automatically after a beat
    this.time.delayedCall(500, () => this.startNextWave());

    // selection indicator
    this.selRing = this.add.circle(0, 0, 22, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.7);
    this.selRing.setVisible(false);

    this.refreshUI();
  }

  update(_, dt) {
    // Update enemies along path
    for (const e of this.enemies) {
      if (!e || !e.scene) continue;
      e.updateFollowPath(dt, this.pathPoints);
    }

    // Update towers shooting
    for (const t of this.towers) {
      if (!t || !t.scene) continue;
      t.tryShoot(dt, this.enemies, this.bullets);
    }

    // Update bullets
    for (const b of this.bullets) {
      if (!b || !b.scene) continue;
      b.update(dt);
    }

    // Cleanup arrays
    this.enemies = this.enemies.filter(e => e && e.scene);
    this.bullets = this.bullets.filter(b => b && b.scene);
    this.towers = this.towers.filter(t => t && t.scene);

    // Lose condition
    if (this.lives <= 0) {
      this.isSpawning = false;
      this.hintText.setText("核心被突破！刷新頁面重新開始");
      this.scene.pause();
      return;
    }

    // If wave finished (no enemies & not spawning), allow next
    if (!this.isSpawning && this.enemies.length === 0) {
      this.hintText.setText(`波次 ${this.wave} 結束！按 N 開始下一波`);
    }

    this.refreshUI();
  }

  refreshUI() {
    const rangerCost = this.getTowerDef("ranger").cost;
    const slowCost = this.getTowerDef("slow").cost;

    const sel = this.selectedTowerType === "ranger"
      ? `1=迅猛塔(¥${rangerCost})`
      : `2=毒霧塔(¥${slowCost})`;

    let upgradeLine = "";
    if (this.selectedTower && this.selectedTower.scene) {
      const upCost = this.selectedTower.getUpgradeCost();
      upgradeLine = `｜選中塔：${this.selectedTower.type} Lv.${this.selectedTower.level} 升級(U) ¥${upCost}`;
    }

    this.uiText.setText(
      `金錢：${this.money}    生命：${this.lives}    波次：${this.wave}    選擇：${sel}${upgradeLine}`
    );

    const tips =
      `點格子放塔｜1/2切換塔｜N下一波｜點塔選取｜U升級（不能放在路上）`;
    this.hintText.setText(tips);
  }

  drawGrid() {
    const { tileSize, gridW, gridH, topBarH } = CFG;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const color = (x + y) % 2 === 0 ? COLORS.tile : COLORS.tile2;
        const rx = x * tileSize + tileSize / 2;
        const ry = topBarH + y * tileSize + tileSize / 2;

        const r = this.add.rectangle(rx, ry, tileSize - 2, tileSize - 2, color, 1)
          .setStrokeStyle(1, 0x0b0f22, 0.8);

        r.setData("tileX", x);
        r.setData("tileY", y);

        this.tiles.push(r);
      }
    }
  }

  buildPath(pathTiles) {
    // pathTiles: array of [x,y]
    // Make world points (center of tiles) for smooth movement
    this.pathPoints = pathTiles.map(([tx, ty]) => this.tileToWorldCenter(tx, ty));
    for (const [tx, ty] of pathTiles) {
      this.pathSet.add(`${tx},${ty}`);
      // recolor tile to path
      const idx = ty * CFG.gridW + tx;
      const tile = this.tiles[idx];
      if (tile) {
        tile.setFillStyle(COLORS.path, 1);
        tile.setStrokeStyle(2, COLORS.pathEdge, 0.9);
      }
    }

    // start and end markers
    const start = this.pathPoints[0];
    const end = this.pathPoints[this.pathPoints.length - 1];
    this.add.circle(start.x, start.y, 10, 0x59ff9a, 0.9);
    this.add.circle(end.x, end.y, 10, 0xffd166, 0.9);
  }

  tileToWorldCenter(tx, ty) {
    return {
      x: tx * CFG.tileSize + CFG.tileSize / 2,
      y: CFG.topBarH + ty * CFG.tileSize + CFG.tileSize / 2
    };
  }

  worldToTile(wx, wy) {
    const ty = Math.floor((wy - CFG.topBarH) / CFG.tileSize);
    const tx = Math.floor(wx / CFG.tileSize);
    if (tx < 0 || ty < 0 || tx >= CFG.gridW || ty >= CFG.gridH) return null;
    return { tx, ty };
  }

  getTowerDef(type) {
    if (type === "ranger") {
      // “迅猛塔”：射速快
      return { type, cost: 45, range: 140, fireRate: 1.3, damage: 10, color: COLORS.tower };
    }
    // “毒霧塔”：慢但痛（MVP先做傷害差異；下一步可加減速）
    return { type: "slow", cost: 65, range: 125, fireRate: 0.75, damage: 18, color: COLORS.tower2 };
  }

  onPointerDown(pointer) {
    const t = this.worldToTile(pointer.worldX, pointer.worldY);
    if (!t) return;

    const key = `${t.tx},${t.ty}`;

    // if clicked on an existing tower, select it
    const clickedTower = this.towers.find(tt => tt.tileX === t.tx && tt.tileY === t.ty);
    if (clickedTower) {
      this.selectTower(clickedTower);
      return;
    }

    // try place tower
    if (this.pathSet.has(key)) return;          // can't place on path
    if (this.blockedSet.has(key)) return;       // already occupied

    const def = this.getTowerDef(this.selectedTowerType);
    if (this.money < def.cost) return;

    const tower = new Tower(this, t.tx, t.ty, def);
    this.towers.push(tower);
    this.blockedSet.add(key);
    this.money -= def.cost;

    // select newly placed tower
    this.selectTower(tower);
  }

  selectTower(tower) {
    this.selectedTower = tower;
    this.selRing.setVisible(true);
    this.selRing.setPosition(tower.x, tower.y);
  }

  tryUpgradeSelected() {
    if (!this.selectedTower || !this.selectedTower.scene) return;
    const cost = this.selectedTower.getUpgradeCost();
    if (this.money < cost) return;
    this.money -= cost;
    this.selectedTower.upgrade();
    // update selection ring position (in case)
    this.selRing.setPosition(this.selectedTower.x, this.selectedTower.y);
  }

  startNextWave() {
    if (this.isSpawning) return;
    if (this.lives <= 0) return;

    this.wave += 1;
    this.isSpawning = true;

    const baseCount = 8;
    const count = baseCount + Math.floor(this.wave * 1.6);
    const hp = 40 + this.wave * 12;
    const speed = 78 + this.wave * 4;
    const reward = 10 + Math.floor(this.wave * 0.8);

    const start = this.pathPoints[0];

    let spawned = 0;
    const spawnInterval = Math.max(220, 520 - this.wave * 25);

    this.hintText.setText(`波次 ${this.wave} 來襲！`);

    const timer = this.time.addEvent({
      delay: spawnInterval,
      repeat: count - 1,
      callback: () => {
        const isAlt = (spawned % 6 === 5);
        const e = new Enemy(this, start.x, start.y, {
          maxHp: isAlt ? hp * 1.6 : hp,
          speed: isAlt ? speed * 0.9 : speed,
          reward: isAlt ? reward * 2 : reward,
          color: isAlt ? COLORS.enemy2 : COLORS.enemy,
          damageToCore: isAlt ? 2 : 1
        });
        this.enemies.push(e);
        spawned += 1;

        if (spawned >= count) {
          // finish spawning after last
          this.time.delayedCall(400, () => {
            this.isSpawning = false;
          });
        }
      }
    });

    return timer;
  }
}

const width = CFG.gridW * CFG.tileSize;
const height = CFG.gridH * CFG.tileSize + CFG.topBarH;

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width,
  height,
  fps: { target: 60, forceSetTimeOut: true },
  scene: [MainScene],
};

new Phaser.Game(config);
