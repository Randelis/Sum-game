import Phaser from 'phaser';
import { WeaponDef } from '../data/weapons';
import { GAME_W, GAME_H, DEPTH } from '../utils/constants';

export class WeaponPicker {
  scene:   Phaser.Scene;
  isOpen:  boolean = false;

  private _container!: Phaser.GameObjects.Container;
  private _cards:      Phaser.GameObjects.Container[] = [];
  private _onPick:     (def: WeaponDef) => void;

  constructor(scene: Phaser.Scene, onPick: (def: WeaponDef) => void) {
    this.scene   = scene;
    this._onPick = onPick;
    this._build();
  }

  show(weapons: WeaponDef[], currentId: string): void {
    this.isOpen = true;
    this._clearCards();
    this._container.setVisible(true);

    const cols   = Math.min(weapons.length, 5);
    const startX = GAME_W / 2 - ((cols - 1) / 2) * 150;
    for (let i = 0; i < weapons.length; i++) {
      const w      = weapons[i];
      const col    = i % cols;
      const row    = Math.floor(i / cols);
      const x      = startX + col * 150;
      const y      = GAME_H / 2 - 100 + row * 140;
      const card   = this._makeCard(w, x, y, w.id === currentId);
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
    const overlay = this.scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    const title   = this.scene.add.text(GAME_W / 2, 60, 'Select Weapon', {
      fontSize: '28px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 1);

    this._container = this.scene.add.container(0, 0, [overlay, title])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _makeCard(def: WeaponDef, x: number, y: number, active: boolean): Phaser.GameObjects.Container {
    const bg    = this.scene.add.rectangle(x, y, 130, 110, active ? 0x334422 : 0x223344, 0.95).setInteractive();
    const border= this.scene.add.rectangle(x, y, 130, 110).setStrokeStyle(2, active ? 0x88ff44 : 0x445566);
    const icon  = this.scene.add.text(x, y - 22, def.icon,  { fontSize: '32px' }).setOrigin(0.5);
    const name  = this.scene.add.text(x, y + 16, def.name,  { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
    const dmg   = this.scene.add.text(x, y + 34, `⚔${def.damage} 🔥${def.fireRate}/s`, { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x334455));
    bg.on('pointerout',  () => bg.setFillStyle(active ? 0x334422 : 0x223344));
    bg.on('pointerdown', () => {
      this._onPick(def);
      this.hide();
    });

    return this.scene.add.container(0, 0, [bg, border, icon, name, dmg]).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 2);
  }

  private _clearCards(): void {
    for (const c of this._cards) c.destroy();
    this._cards = [];
  }
}
