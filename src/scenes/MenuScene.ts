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
  constructor() { super('Menu'); }

  create(): void {
    const w = window as unknown as WindowWithPwa;
    w.hideBootStatus?.();

    const save   = new SaveSystem();
    const hiScore = save.getHighScore();

    // Background
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0f0a);

    // Title
    this.add.text(GAME_W / 2, 150, '☠ ZOMBIE SHOOTER', {
      fontSize: '52px', color: '#ff4444',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 215, 'Survive the endless horde', {
      fontSize: '22px', color: '#aaaaaa',
    }).setOrigin(0.5);

    if (hiScore > 0) {
      this.add.text(GAME_W / 2, 270, `Best score: ${hiScore}`, {
        fontSize: '20px', color: '#ffcc00',
      }).setOrigin(0.5);
    }

    // PLAY button
    const btnBg = this.add.rectangle(GAME_W / 2, 370, 240, 70, 0x226622)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(GAME_W / 2, 370, 'PLAY', {
      fontSize: '34px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x33aa33); btnText.setScale(1.06); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x226622); btnText.setScale(1); });
    btnBg.on('pointerdown', () => { this._startGame(); });

    // INSTALL APP button — shown only when PWA install prompt is available
    if (w._installPrompt) this._addInstallButton();

    // Listen for late-arriving install prompt
    window.addEventListener('beforeinstallprompt', () => this._addInstallButton(), { once: true });

    // Controls hint
    this.add.text(GAME_W / 2, 555, 'Joystick to move  •  Auto-aim & shoot  •  💨 dash  •  🧪 heal', {
      fontSize: '15px', color: '#666666',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 585, 'Survive to wave 5 to face the BOSS!', {
      fontSize: '16px', color: '#aa4444',
    }).setOrigin(0.5);

    // Keyboard shortcuts (desktop)
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ENTER', () => this._startGame());
      this.input.keyboard.once('keydown-SPACE', () => this._startGame());
    }
  }

  private _installBtn: Phaser.GameObjects.GameObject[] = [];

  private _addInstallButton(): void {
    if (this._installBtn.length > 0) return;
    const bg   = this.add.rectangle(GAME_W / 2, 460, 200, 50, 0x224477)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(GAME_W / 2, 460, '📲 Install App', {
      fontSize: '20px', color: '#cce4ff',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x3366aa));
    bg.on('pointerout',  () => bg.setFillStyle(0x224477));
    bg.on('pointerdown', () => this._promptInstall(bg, text));

    this._installBtn = [bg, text];
  }

  private async _promptInstall(bg: Phaser.GameObjects.Rectangle, text: Phaser.GameObjects.Text): Promise<void> {
    const w = window as unknown as WindowWithPwa;
    const evt = w._installPrompt;
    if (!evt) return;
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === 'accepted') {
        bg.destroy();
        text.destroy();
        this._installBtn = [];
      }
      w._installPrompt = undefined;
    } catch { /* user dismissed or browser refused */ }
  }

  private _startGame(): void {
    // Best-effort fullscreen + landscape lock; requires user gesture (we're in pointerdown)
    this._tryFullscreenLandscape();
    this.scene.start('Game');
  }

  private _tryFullscreenLandscape(): void {
    const el = document.documentElement;
    const req = (el.requestFullscreen ?? (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen);
    try { req?.call(el); } catch { /* ignore */ }

    const orient = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
    try { orient?.lock?.('landscape').catch(() => { /* ignore */ }); } catch { /* ignore */ }
  }
}
