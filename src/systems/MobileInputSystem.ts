import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';

/**
 * Touch-friendly mobile controls for a 1280×720 landscape game.
 *
 *  Bottom-left  — virtual joystick (large hit area, follows finger)
 *  Bottom-right — three action buttons stacked horizontally (DASH, HEAL, SWAP)
 *
 * The joystick activates when the user touches anywhere in its zone, then
 * tracks finger movement until release. The action buttons are simple taps.
 *
 * IMPORTANT: this system listens to the GLOBAL Phaser pointer events (not
 * per-object interactive callbacks) so the joystick can capture touches that
 * start anywhere in the left half of the screen — that's how every real
 * twin-stick mobile game does it.
 */
export class MobileInputSystem {
  scene: Phaser.Scene;

  move: { x: number; y: number } = { x: 0, y: 0 };

  private _dashPending         = false;
  private _healPending         = false;
  private _weaponSwitchPending = false;

  private _joyBase!:  Phaser.GameObjects.Arc;
  private _joyThumb!: Phaser.GameObjects.Arc;
  private _joyCenter:  { x: number; y: number } = { x: 0, y: 0 };
  private _joyHome:    { x: number; y: number } = { x: 0, y: 0 };
  private _joyRadius   = 80;
  private _joyActive   = false;
  private _joyPointerId = -1;
  private _joyZone:    { x0: number; y0: number; x1: number; y1: number } = { x0: 0, y0: 0, x1: 0, y1: 0 };

  private _btnDash!:   Phaser.GameObjects.Container;
  private _btnHeal!:   Phaser.GameObjects.Container;
  private _btnSwap!:   Phaser.GameObjects.Container;

  // bound handlers (for cleanup)
  private _onPointerDown!: (ptr: Phaser.Input.Pointer) => void;
  private _onPointerMove!: (ptr: Phaser.Input.Pointer) => void;
  private _onPointerUp!:   (ptr: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._buildJoystick();
    this._buildButtons();
    this._wireGlobalPointers();
  }

  consumeDash():         boolean { const v = this._dashPending;         this._dashPending         = false; return v; }
  consumeHeal():         boolean { const v = this._healPending;         this._healPending         = false; return v; }
  consumeWeaponSwitch(): boolean { const v = this._weaponSwitchPending; this._weaponSwitchPending = false; return v; }

  update(): void {
    if (!this._joyActive) {
      this.move.x = 0;
      this.move.y = 0;
      return;
    }
    const dx  = this._joyThumb.x - this._joyHome.x;
    const dy  = this._joyThumb.y - this._joyHome.y;
    const mag = Math.min(1, Math.hypot(dx, dy) / this._joyRadius);
    const len = Math.hypot(dx, dy) || 1;
    this.move.x = (dx / len) * mag;
    this.move.y = (dy / len) * mag;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this._onPointerDown);
    this.scene.input.off('pointermove', this._onPointerMove);
    this.scene.input.off('pointerup',   this._onPointerUp);
    this.scene.input.off('pointerupoutside', this._onPointerUp);
    this._joyBase.destroy();
    this._joyThumb.destroy();
    this._btnDash.destroy();
    this._btnHeal.destroy();
    this._btnSwap.destroy();
  }

  // ─── builders ─────────────────────────────────────────────────────────────

  private _buildJoystick(): void {
    const cx = 170;
    const cy = GAME_H - 140;
    this._joyHome   = { x: cx, y: cy };
    this._joyCenter = { x: cx, y: cy };

    // Joystick activation zone — entire bottom-left quadrant
    this._joyZone = { x0: 0, y0: GAME_H / 2, x1: GAME_W / 2, y1: GAME_H };

    this._joyBase  = this.scene.add.circle(cx, cy, this._joyRadius, 0xffffff, 0.10)
      .setStrokeStyle(2, 0xffffff, 0.35).setScrollFactor(0).setDepth(200);
    this._joyThumb = this.scene.add.circle(cx, cy, 42, 0xffffff, 0.50)
      .setStrokeStyle(2, 0xffffff, 0.7).setScrollFactor(0).setDepth(201);
  }

  private _buildButtons(): void {
    const baseY = GAME_H - 140;

    // Right-aligned, descending size from edge inward: DASH (rightmost), HEAL, SWAP
    this._btnDash = this._makeButton(GAME_W - 90,  baseY,        '💨', 0x3399ff, 56, () => { this._dashPending = true; });
    this._btnHeal = this._makeButton(GAME_W - 90,  baseY - 130,  '🧪', 0x33cc66, 50, () => { this._healPending = true; });
    this._btnSwap = this._makeButton(GAME_W - 220, baseY,        '🔄', 0xffaa00, 44, () => { this._weaponSwitchPending = true; });
  }

  private _makeButton(
    x: number, y: number,
    label: string, color: number, radius: number,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const ring = this.scene.add.circle(0, 0, radius + 4, color, 0.20).setStrokeStyle(2, color, 0.5);
    const bg   = this.scene.add.circle(0, 0, radius, color, 0.70);
    const text = this.scene.add.text(0, 0, label, { fontSize: `${Math.round(radius * 0.85)}px` }).setOrigin(0.5);

    const c = this.scene.add.container(x, y, [ring, bg, text])
      .setScrollFactor(0).setDepth(200)
      .setSize(radius * 2 + 12, radius * 2 + 12)
      .setInteractive({ useHandCursor: true });

    c.on('pointerdown', () => {
      bg.setScale(0.92);
      this.scene.tweens.add({ targets: bg, scale: 1, duration: 120, ease: 'Back.Out' });
      onTap();
    });
    return c;
  }

  // ─── global pointer handling ──────────────────────────────────────────────

  private _wireGlobalPointers(): void {
    this._onPointerDown = (ptr: Phaser.Input.Pointer) => {
      if (this._joyActive) return;
      if (this._inJoyZone(ptr.x, ptr.y)) {
        this._joyActive    = true;
        this._joyPointerId = ptr.id;
        // Re-home the joystick to where the user pressed (within the zone)
        const cx = Phaser.Math.Clamp(ptr.x, 90,            GAME_W / 2 - 20);
        const cy = Phaser.Math.Clamp(ptr.y, GAME_H / 2 + 20, GAME_H - 30);
        this._joyHome = { x: cx, y: cy };
        this._joyBase.setPosition(cx, cy);
        this._joyThumb.setPosition(cx, cy);
        this._joyBase.setAlpha(0.18);
      }
    };

    this._onPointerMove = (ptr: Phaser.Input.Pointer) => {
      if (!this._joyActive || ptr.id !== this._joyPointerId) return;
      const dx   = ptr.x - this._joyHome.x;
      const dy   = ptr.y - this._joyHome.y;
      const dist = Math.hypot(dx, dy);
      const clmp = Math.min(dist, this._joyRadius);
      const len  = dist || 1;
      this._joyThumb.setPosition(
        this._joyHome.x + (dx / len) * clmp,
        this._joyHome.y + (dy / len) * clmp,
      );
    };

    this._onPointerUp = (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this._joyPointerId) return;
      this._joyActive = false;
      this._joyPointerId = -1;
      // Return joystick home to its default position
      this._joyHome = { x: this._joyCenter.x, y: this._joyCenter.y };
      this._joyBase.setPosition(this._joyCenter.x, this._joyCenter.y).setAlpha(0.10);
      this._joyThumb.setPosition(this._joyCenter.x, this._joyCenter.y);
      this.move.x = 0; this.move.y = 0;
    };

    this.scene.input.on('pointerdown',      this._onPointerDown);
    this.scene.input.on('pointermove',      this._onPointerMove);
    this.scene.input.on('pointerup',        this._onPointerUp);
    this.scene.input.on('pointerupoutside', this._onPointerUp);
  }

  private _inJoyZone(x: number, y: number): boolean {
    return x >= this._joyZone.x0 && x <= this._joyZone.x1
        && y >= this._joyZone.y0 && y <= this._joyZone.y1;
  }
}
