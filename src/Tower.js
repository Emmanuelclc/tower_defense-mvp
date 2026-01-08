import { COLORS } from './config.js';
import { Bullet } from './Bullet.js';

export class Tower extends Phaser.GameObjects.Container {
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

    this.on('pointerover', () => this.ring.setVisible(true));
    this.on('pointerout', () => this.ring.setVisible(false));

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
