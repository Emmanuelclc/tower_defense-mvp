import { CFG, COLORS } from './config.js';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
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

    this.selectedTowerType = 'ranger'; // default
    this.selectedTower = null;
  }

  preload() {}

  create() {
    const W = CFG.gridW * CFG.tileSize;
    const H = CFG.gridH * CFG.tileSize + CFG.topBarH;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    // UI bar
    this.uiBar = this.add.rectangle(W / 2, CFG.topBarH / 2, W, CFG.topBarH, 0x0f1530, 1);

    this.uiText = this.add.text(14, 14, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#dce3ff'
    });

    this.hintText = this.add.text(W - 14, 14, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#dce3ff'
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
    this.input.on('pointerdown', (p) => this.onPointerDown(p));

    // Hotkeys
    this.input.keyboard.on('keydown-ONE', () => this.selectedTowerType = 'ranger');
    this.input.keyboard.on('keydown-TWO', () => this.selectedTowerType = 'slow');
    this.input.keyboard.on('keydown-N', () => this.startNextWave());
    this.input.keyboard.on('keydown-U', () => this.tryUpgradeSelected());

    // events
    this.events.on('enemyKilled', (enemy) => {
      this.money += enemy.reward;
      // remove from array lazily in update
    });

    this.events.on('enemyEscaped', (enemy) => {
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
      this.hintText.setText('核心被突破！刷新頁面重新開始');
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
    const rangerCost = this.getTowerDef('ranger').cost;
    const slowCost = this.getTowerDef('slow').cost;

    const sel = this.selectedTowerType === 'ranger'
      ? `1=迅猛塔(¥${rangerCost})`
      : `2=毒霧塔(¥${slowCost})`;

    let upgradeLine = '';
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

        r.setData('tileX', x);
        r.setData('tileY', y);

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
    if (type === 'ranger') {
      // “迅猛塔”：射速快
      return { type, cost: 45, range: 140, fireRate: 1.3, damage: 10, color: COLORS.tower };
    }
    // “毒霧塔”：慢但痛（MVP先做傷害差異；下一步可加減速)
    return { type: 'slow', cost: 65, range: 125, fireRate: 0.75, damage: 18, color: COLORS.tower2 };
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
