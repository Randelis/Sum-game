import Phaser from 'phaser';
import { WeaponDef } from '../data/weapons';
import { GAME_W, GAME_H, DEPTH } from '../utils/constants';

export class WeaponPicker {
  scene:  Phaser.Scene;
  isOpen: boolean = false;

  private _container!: Phaser.GameObjects.Container;
  private _cards:      Phaser.GameObjects.Container[] = [];
  private _onPick:     (def: WeaponDef) => void;
  private _onClose:    () => void;
  private _closeBtn!:  Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onPick: (def: WeaponDef) => void, onClose: () => void) {
    this.scene    = scene;
    this._onPick  = onPick;
    this._onClose = onClose;
    this._build();
  }

  show(weapons: WeaponDef[], currentId: string): void {
    this.isOpen = true;
    this._clearCards();
    this._container.setVisible(true);

    // Grid: up to 5 cols, two rows max for 10 weapons
    const cardW = 130;
    const cardH = 110;
    const gapX  = 14;
    const gapY  = 14;
    const cols  = Math.min(weapons.length, 5);
    const rows  = Math.ceil(weapons.length / cols);
    const totalW = cols * cardW + (cols - 1) * gapX;
    const totalH = rows * cardH + (rows - 1) * gapY;
    const startX = (GAME_W - totalW) / 2 + cardW / 2;
    const startY = GAME_H / 2 - totalH / 2 + cardH / 2;

    for (let i = 0; i < weapons.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = startX + col * (cardW + gapX);
      const y   = startY + row * (cardH + gapY);
      const card = this._makeCard(weapons[i], x, y, cardW, cardH, weapons[i].id === currentId);
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
    const overlay = this.scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    const title = this.scene.add.text(GAME_W / 2, 50, '🔫 Select weapon', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 1);

    // Close button (X) — needs its own scrollFactor(0) for input (see _makeCard)
    const closeBg = this.scene.add.rectangle(GAME_W - 40, 40, 50, 50, 0x441111, 0.9)
      .setStrokeStyle(2, 0xcc4444).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const closeX = this.scene.add.text(GAME_W - 40, 40, '✕', {
      fontSize: '24px', color: '#ffaaaa', fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBg.on('pointerdown', () => { this.hide(); this._onClose(); });
    this._closeBtn = this.scene.add.container(0, 0, [closeBg, closeX])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY + 3);

    this._container = this.scene.add.container(0, 0, [overlay, title, this._closeBtn])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _makeCard(def: WeaponDef, x: number, y: number, w: number, h: number, active: boolean): Phaser.GameObjects.Container {
    const fill  = active ? 0x234423 : 0x1a2c3e;
    const stroke = active ? 0x88ff44 : 0x4488cc;

    // Interactive children must carry their own scrollFactor(0): the input
    // hit-test uses the child's scroll factor, not the parent container's.
    const bg     = this.scene.add.rectangle(x, y, w, h, fill, 0.98)
      .setStrokeStyle(2, stroke).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const icon   = this.scene.add.text(x, y - h / 2 + 30, def.icon, { fontSize: '32px' }).setOrigin(0.5);
    const name   = this.scene.add.text(x, y + 8, def.name, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const stats  = this.scene.add.text(x, y + h / 2 - 18, `⚔${def.damage}  ${def.fireRate}/s`, {
      fontSize: '11px', color: '#aaaaaa',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setStrokeStyle(2, 0x88ccff));
    bg.on('pointerout',  () => bg.setStrokeStyle(2, stroke));
    bg.on('pointerdown', () => { this._onPick(def); this.hide(); });

    return this.scene.add.container(0, 0, [bg, icon, name, stats]).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 2);
  }

  private _clearCards(): void {
    for (const c of this._cards) c.destroy();
    this._cards = [];
  }
}
