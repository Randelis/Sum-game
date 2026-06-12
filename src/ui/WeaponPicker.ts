import Phaser from 'phaser';
import { WeaponDef } from '../data/weapons';
import { GAME_W, GAME_H, DEPTH, FONT } from '../utils/constants';

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
    // Oversized: the camera zoom shrinks scrollFactor(0) objects toward the
    // center, so a screen-sized overlay would leave a visible border band.
    const overlay = this.scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W * 1.6, GAME_H * 1.6, 0x04060a, 0.85)
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    const title = this.scene.add.text(GAME_W / 2, 50, 'SELECT WEAPON', {
      fontFamily: FONT, fontSize: '28px', color: '#f2f6fa', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 1);
    title.setShadow(0, 4, '#000000', 8);

    // Close button (X) — needs its own scrollFactor(0) for input (see _makeCard)
    const closeBg = this.scene.add.rectangle(GAME_W - 40, 40, 52, 52, 0x2a1014, 0.95)
      .setStrokeStyle(2, 0xd05050).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const closeX = this.scene.add.text(GAME_W - 40, 40, '✕', {
      fontFamily: FONT, fontSize: '24px', color: '#ff9d9d', fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBg.on('pointerdown', () => { this.hide(); this._onClose(); });
    this._closeBtn = this.scene.add.container(0, 0, [closeBg, closeX])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY + 3);

    this._container = this.scene.add.container(0, 0, [overlay, title, this._closeBtn])
      .setScrollFactor(0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _makeCard(def: WeaponDef, x: number, y: number, w: number, h: number, active: boolean): Phaser.GameObjects.Container {
    const top    = active ? 0x224a26 : 0x1c2c40;
    const bottom = active ? 0x12260f : 0x0f1828;
    const stroke = active ? 0x7ddf5a : 0x3f6e9e;

    // Rounded gradient card body
    const gfx = this.scene.add.graphics({ x, y });
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 12);
    gfx.fillGradientStyle(top, top, bottom, bottom, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    gfx.lineStyle(2, stroke, active ? 1 : 0.8);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);

    const icon   = this.scene.add.text(x, y - h / 2 + 28, def.icon, { fontSize: '30px' }).setOrigin(0.5);
    const name   = this.scene.add.text(x, y + 8, def.name, {
      fontFamily: FONT, fontSize: '15px', color: '#f2f6fa', fontStyle: 'bold',
    }).setOrigin(0.5);
    const stats  = this.scene.add.text(x, y + h / 2 - 18, `⚔ ${def.damage}   ${def.fireRate}/s`, {
      fontFamily: FONT, fontSize: '11px', color: '#93a3b3',
    }).setOrigin(0.5);

    // Interactive children must carry their own scrollFactor(0): the input
    // hit-test uses the child's scroll factor, not the parent container's.
    const bg = this.scene.add.rectangle(x, y, w, h, 0xffffff, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { this._onPick(def); this.hide(); });

    return this.scene.add.container(0, 0, [gfx, icon, name, stats, bg]).setScrollFactor(0).setDepth(DEPTH.OVERLAY + 2);
  }

  private _clearCards(): void {
    for (const c of this._cards) c.destroy();
    this._cards = [];
  }
}
