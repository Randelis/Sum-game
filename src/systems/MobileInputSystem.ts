import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';

export class MobileInputSystem {
  scene: Phaser.Scene;

  move: { x: number; y: number } = { x: 0, y: 0 };

  private _dashPending:         boolean = false;
  private _healPending:         boolean = false;
  private _weaponSwitchPending: boolean = false;

  private _joystickBase!:  Phaser.GameObjects.Arc;
  private _joystickThumb!: Phaser.GameObjects.Arc;
  private _joyCenter:      { x: number; y: number } = { x: 0, y: 0 };
  private _joyActive:      boolean                  = false;
  private _joyRadius:      number                   = 70;
  private _joyPointerId:   number                   = -1;

  private _btnDash!:   Phaser.GameObjects.Container;
  private _btnHeal!:   Phaser.GameObjects.Container;
  private _btnWeapon!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._createJoystick();
    this._createButtons();
  }

  consumeDash():        boolean { const v = this._dashPending;         this._dashPending         = false; return v; }
  consumeHeal():        boolean { const v = this._healPending;         this._healPending         = false; return v; }
  consumeWeaponSwitch():boolean { const v = this._weaponSwitchPending; this._weaponSwitchPending = false; return v; }

  update(): void {
    this.move.x = 0;
    this.move.y = 0;
    if (!this._joyActive) return;

    const dx  = this._joystickThumb.x - this._joyCenter.x;
    const dy  = this._joystickThumb.y - this._joyCenter.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const mag = Math.min(1, Math.sqrt(dx * dx + dy * dy) / this._joyRadius);
    this.move.x = (dx / len) * mag;
    this.move.y = (dy / len) * mag;
  }

  destroy(): void {
    this._joystickBase.destroy();
    this._joystickThumb.destroy();
    this._btnDash.destroy();
    this._btnHeal.destroy();
    this._btnWeapon.destroy();
  }

  private _createJoystick(): void {
    const cx = 140;
    const cy = GAME_H - 150;
    this._joyCenter = { x: cx, y: cy };

    this._joystickBase = this.scene.add.circle(cx, cy, this._joyRadius, 0xffffff, 0.15)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive();

    this._joystickThumb = this.scene.add.circle(cx, cy, 34, 0xffffff, 0.5)
      .setScrollFactor(0)
      .setDepth(201);

    // Touch handling — track the pointer that started on the base
    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const dx = ptr.x - cx;
      const dy = ptr.y - cy;
      if (dx * dx + dy * dy < (this._joyRadius + 50) ** 2 && !this._joyActive) {
        this._joyActive    = true;
        this._joyPointerId = ptr.id;
        this._updateThumb(ptr.x, ptr.y);
      }
    });

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this._joyActive && ptr.id === this._joyPointerId) {
        this._updateThumb(ptr.x, ptr.y);
      }
    });

    this.scene.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id === this._joyPointerId) {
        this._joyActive = false;
        this._joyPointerId = -1;
        this._joystickThumb.setPosition(cx, cy);
        this.move.x = 0;
        this.move.y = 0;
      }
    });
  }

  private _updateThumb(px: number, py: number): void {
    const dx   = px - this._joyCenter.x;
    const dy   = py - this._joyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clmp = Math.min(dist, this._joyRadius);
    const len  = dist || 1;
    this._joystickThumb.setPosition(
      this._joyCenter.x + (dx / len) * clmp,
      this._joyCenter.y + (dy / len) * clmp,
    );
  }

  private _createButtons(): void {
    const btnY  = GAME_H - 140;
    const right = GAME_W  - 60;

    this._btnDash   = this._makeButton(right - 160, btnY, '💨', 0x3399ff, () => { this._dashPending         = true; });
    this._btnHeal   = this._makeButton(right - 80,  btnY, '🧪', 0x33cc66, () => { this._healPending         = true; });
    this._btnWeapon = this._makeButton(right,        btnY, '🔄', 0xffaa00, () => { this._weaponSwitchPending = true; });
  }

  private _makeButton(
    x: number, y: number,
    label: string, color: number,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const bg   = this.scene.add.circle(0, 0, 44, color, 0.75);
    const text = this.scene.add.text(0, 0, label, { fontSize: '28px' }).setOrigin(0.5);
    const c    = this.scene.add.container(x, y, [bg, text])
      .setScrollFactor(0)
      .setDepth(200)
      .setSize(88, 88)
      .setInteractive();

    c.on('pointerdown', onTap);
    c.on('pointerover', () => bg.setAlpha(1));
    c.on('pointerout',  () => bg.setAlpha(0.75));
    return c;
  }
}
