import Phaser from 'phaser';
import { UpgradeDef } from '../data/upgrades';
import { GAME_W, GAME_H, DEPTH } from '../utils/constants';

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
    this._overlay = this.scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    this._title = this.scene.add.text(GAME_W / 2, GAME_H / 2 - 140, '⭐ LEVEL UP — choose an upgrade', {
      fontSize: '28px', color: '#ffcc00', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 1);

    this._container = this.scene.add.container(0, 0, [this._overlay, this._title])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _makeCard(def: UpgradeDef, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const bg     = this.scene.add.rectangle(x, y, w, h, 0x1a2c3e, 0.98)
      .setStrokeStyle(3, 0x4488cc).setInteractive({ useHandCursor: true });
    const name   = this.scene.add.text(x, y - h / 2 + 36, def.name, {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const desc   = this.scene.add.text(x, y + 10, def.description, {
      fontSize: '15px', color: '#cce4ff',
      wordWrap: { width: w - 32 }, align: 'center',
    }).setOrigin(0.5);
    const cta    = this.scene.add.text(x, y + h / 2 - 28, 'TAP TO PICK', {
      fontSize: '13px', color: '#88ccff', fontStyle: 'bold',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setStrokeStyle(3, 0x88ccff));
    bg.on('pointerout',  () => bg.setStrokeStyle(3, 0x4488cc));
    bg.on('pointerdown', () => { this._onPick(def); this.hide(); });

    return this.scene.add.container(0, 0, [bg, name, desc, cta]).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 2);
  }

  private _clearCards(): void {
    for (const c of this._cards) c.destroy();
    this._cards = [];
  }
}
