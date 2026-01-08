import MainScene from './MainScene.js';
import { CFG } from './config.js';

const width = CFG.gridW * CFG.tileSize;
const height = CFG.gridH * CFG.tileSize + CFG.topBarH;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width,
  height,
  fps: { target: 60, forceSetTimeOut: true },
  scene: [MainScene],
};

// main entry
window.addEventListener('load', () => {
  new Phaser.Game(config);
});
