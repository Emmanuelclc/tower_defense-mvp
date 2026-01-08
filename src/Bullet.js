import { COLORS } from './config.js';

export class Bullet extends Phaser.GameObjects.Arc {
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

    if (dist > 0) {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }
}
