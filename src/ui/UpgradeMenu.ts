import Phaser from 'phaser';
import { UpgradeDef } from '../data/upgrades';
import { GAME_W, GAME_H, DEPTH } from '../utils/constants';

export class UpgradeMenu {
  scene:    Phaser.Scene;
  isOpen:   boolean = false;

  private _overlay!:    Phaser.GameObjects.Rectangle;
  private _titleText!:  Phaser.GameObjects.Text;
  private _cards:       Phaser.GameObjects.Container[] = [];
  private _container!:  Phaser.GameObjects.Container;

  private _onPick: (def: UpgradeDef) => void;

  constructor(scene: Phaser.Scene, onPick: (def: UpgradeDef) => void) {
    this.scene   = scene;
    this._onPick = onPick;
    this._build();
  }

  show(choices: UpgradeDef[]): void {
    this.isOpen = true;
    this._clearCards();
    this._container.setVisible(true);

    const startX = GAME_W / 2 - (choices.length - 1) * 160;
    for (let i = 0; i < choices.length; i++) {
      const card = this._makeCard(choices[i], startX + i * 320, GAME_H / 2);
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
    this._overlay = this.scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.65)
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY);

    this._titleText = this.scene.add.text(GAME_W / 2, GAME_H / 2 - 160, 'LEVEL UP! Choose an upgrade', {
      fontSize: '28px', color: '#ffcc00', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 1);

    this._container = this.scene.add.container(0, 0, [this._overlay, this._titleText])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _makeCard(def: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
    const bg    = this.scene.add.rectangle(x, y, 280, 180, 0x223344, 0.95).setInteractive();
    const border= this.scene.add.rectangle(x, y, 280, 180).setStrokeStyle(2, 0x4488cc);
    const name  = this.scene.add.text(x, y - 50, def.name, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const desc  = this.scene.add.text(x, y + 10, def.description, {
      fontSize: '16px', color: '#aaccff', wordWrap: { width: 240 },
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x334455));
    bg.on('pointerout',  () => bg.setFillStyle(0x223344));
    bg.on('pointerdown', () => {
      this._onPick(def);
      this.hide();
    });

    return this.scene.add.container(0, 0, [bg, border, name, desc]).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 2);
  }

  private _clearCards(): void {
    for (const c of this._cards) c.destroy();
    this._cards = [];
  }
}
