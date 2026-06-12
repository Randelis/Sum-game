import Phaser from 'phaser';
import { UpgradeDef } from '../data/upgrades';
import { GAME_W, GAME_H, DEPTH, FONT } from '../utils/constants';

export class UpgradeMenu {
  scene:  Phaser.Scene;
  isOpen: boolean = false;

  private _overlay!:   Phaser.GameObjects.Rectangle;
  private _title!:     Phaser.GameObjects.Text;
  private _cards:      Phaser.GameObjects.Container[] = [];
  private _container!: Phaser.GameObjects.Container;
  private _onPick:     (def: UpgradeDef) => void;

  constructor(scene: Phaser.Scene, onPick: (def: UpgradeDef) => void) {
    this.scene   = scene;
    this._onPick = onPick;
    this._build();
  }

  show(choices: UpgradeDef[]): void {
    this.isOpen = true;
    this._clearCards();
    this._container.setVisible(true);

    const n      = choices.length;
    const cardW  = 260;
    const cardH  = 200;
    const gap    = 28;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = (GAME_W - totalW) / 2 + cardW / 2;
    const cy     = GAME_H / 2 + 20;

    for (let i = 0; i < n; i++) {
      const card = this._makeCard(choices[i], startX + i * (cardW + gap), cy, cardW, cardH);
      this._cards.push(card);
      this._container.add(card);
    }
  }

  hide(): void {
    this.isOpen = false;
    this._container.setVisible(false);
    this._clearCards();
  }

  private _build(): void {
    // Oversized: camera zoom shrinks scrollFactor(0) objects toward center,
    // so a screen-sized overlay would leave a visible border band.
    this._overlay = this.scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W * 1.6, GAME_H * 1.6, 0x04060a, 0.85)
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    this._title = this.scene.add.text(GAME_W / 2, GAME_H / 2 - 150, '⭐ LEVEL UP — CHOOSE AN UPGRADE', {
      fontFamily: FONT, fontSize: '30px', color: '#ffd24a', fontStyle: 'bold',
      stroke: '#241400', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 1);
    this._title.setShadow(0, 4, '#000000', 10);

    this._container = this.scene.add.container(0, 0, [this._overlay, this._title])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _makeCard(def: UpgradeDef, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    // Rounded gradient card body
    const gfx = this.scene.add.graphics({ x, y });
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, 14);
    gfx.fillGradientStyle(0x1c2c40, 0x1c2c40, 0x0f1828, 0x0f1828, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    gfx.lineStyle(2, 0x3f6e9e, 0.9);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    // accent strip behind the title
    gfx.fillStyle(0x3f6e9e, 0.25);
    gfx.fillRoundedRect(-w / 2 + 8, -h / 2 + 14, w - 16, 42, 8);

    const name   = this.scene.add.text(x, y - h / 2 + 36, def.name, {
      fontFamily: FONT, fontSize: '22px', color: '#f2f6fa', fontStyle: 'bold',
    }).setOrigin(0.5);
    const desc   = this.scene.add.text(x, y + 10, def.description, {
      fontFamily: FONT, fontSize: '15px', color: '#bcd2e8',
      wordWrap: { width: w - 32 }, align: 'center',
    }).setOrigin(0.5);
    const cta    = this.scene.add.text(x, y + h / 2 - 26, 'TAP TO PICK', {
      fontFamily: FONT, fontSize: '13px', color: '#74b6ff', fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);

    // Interactive children must carry their own scrollFactor(0): the input
    // hit-test uses the child's scroll factor, not the parent container's.
    const bg = this.scene.add.rectangle(x, y, w, h, 0xffffff, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { this._onPick(def); this.hide(); });

    return this.scene.add.container(0, 0, [gfx, name, desc, cta, bg]).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 2);
  }

  private _clearCards(): void {
    for (const c of this._cards) c.destroy();
    this._cards = [];
  }
}
