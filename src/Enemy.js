import { clamp, COLORS } from './config.js';

export class Enemy extends Phaser.GameObjects.Container {
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
      this.scene.events.emit('enemyKilled', this);
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
      this.scene.events.emit('enemyEscaped', this);
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
      if (dist > 0) {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    }
  }
}
