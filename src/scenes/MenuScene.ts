import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';
import { SaveSystem }      from '../systems/SaveSystem';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface WindowWithPwa extends Window {
  hideBootStatus?: () => void;
  _installPrompt?: InstallPromptEvent;
}

export class MenuScene extends Phaser.Scene {
  private _installBtn: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('Menu'); }

  create(): void {
    const w = window as unknown as WindowWithPwa;
    w.hideBootStatus?.();

    const save    = new SaveSystem();
    const hiScore = save.getHighScore();

    // Dark gradient background
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0f0a);

    // Decorative top stripe
    const stripe = this.add.graphics();
    stripe.fillStyle(0x111414);
    stripe.fillRect(0, 0, GAME_W, 4);
    stripe.fillStyle(0x331111);
    stripe.fillRect(0, GAME_H - 4, GAME_W, 4);

    // Title
    this.add.text(GAME_W / 2, 140, '☠ ZOMBIE SHOOTER', {
      fontSize: '60px', color: '#ff4444', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 200, 'Survive the endless horde', {
      fontSize: '22px', color: '#888888',
    }).setOrigin(0.5);

    if (hiScore > 0) {
      this.add.text(GAME_W / 2, 250, `🏆 Best  ${hiScore.toLocaleString()}`, {
        fontSize: '22px', color: '#ffcc00', fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    // PLAY button — large, easy touch target
    this._addButton(GAME_W / 2, 380, 280, 80, '▶ PLAY', '#ffffff', 0x226622, 0x33aa33, 30, () => this._startGame());

    // INSTALL APP button — appears only when PWA install prompt is available
    if (w._installPrompt) this._addInstallButton();
    const onPrompt = () => this._addInstallButton();
    window.addEventListener('beforeinstallprompt', onPrompt, { once: true });
    this.events.once('shutdown', () => window.removeEventListener('beforeinstallprompt', onPrompt));

    // Hint
    this.add.text(GAME_W / 2, GAME_H - 50, 'Touch joystick to move • Tap 💨 to dash • Tap 🧪 to heal • 🔄 swap weapon', {
      fontSize: '15px', color: '#555555',
    }).setOrigin(0.5);
  }

  private _addInstallButton(): void {
    if (this._installBtn.length > 0) return;
    const els = this._addButton(GAME_W / 2, 490, 220, 56, '📲 Install App', '#cce4ff', 0x224477, 0x3366aa, 20, () => {
      this._promptInstall();
    });
    this._installBtn = els;
  }

  private async _promptInstall(): Promise<void> {
    const w = window as unknown as WindowWithPwa;
    const evt = w._installPrompt;
    if (!evt) return;
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === 'accepted') {
        this._installBtn.forEach(e => e.destroy());
        this._installBtn = [];
      }
      w._installPrompt = undefined;
    } catch { /* dismissed */ }
  }

  private _addButton(
    cx: number, cy: number, w: number, h: number,
    label: string, textColor: string,
    fill: number, fillHover: number, fontSize: number,
    onTap: () => void,
  ): Phaser.GameObjects.GameObject[] {
    const bg   = this.add.rectangle(cx, cy, w, h, fill)
      .setStrokeStyle(3, 0xffffff, 0.15)
      .setInteractive({ useHandCursor: true });
    const txt  = this.add.text(cx, cy, label, {
      fontSize: `${fontSize}px`, color: textColor, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    bg.on('pointerover', () => { bg.setFillStyle(fillHover); txt.setScale(1.05); });
    bg.on('pointerout',  () => { bg.setFillStyle(fill);      txt.setScale(1); });
    bg.on('pointerdown', () => {
      bg.setScale(0.96);
      this.tweens.add({ targets: bg, scale: 1, duration: 120 });
      onTap();
    });
    return [bg, txt];
  }

  private _startGame(): void {
    this._tryFullscreenLandscape();
    this.scene.start('Game');
  }

  private _tryFullscreenLandscape(): void {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    try {
      if (el.requestFullscreen)        el.requestFullscreen().catch(() => { /* ignore */ });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch { /* ignore */ }
    const orient = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
    try { orient?.lock?.('landscape').catch(() => { /* ignore */ }); } catch { /* ignore */ }
  }
}
