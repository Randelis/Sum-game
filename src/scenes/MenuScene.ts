import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT } from '../utils/constants';
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

    // Textured backdrop: wasteland ground, heavy dark wash, vignette
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'ground').setOrigin(0);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x05070c, 0.66);
    this.add.image(GAME_W / 2, GAME_H / 2, 'vignette').setDisplaySize(GAME_W + 80, GAME_H + 80);

    // Title block
    const title = this.add.text(GAME_W / 2, 150, 'ZOMBIE SHOOTER', {
      fontFamily: FONT, fontSize: '76px', color: '#ff4b3e', fontStyle: 'bold',
      stroke: '#1c0000', strokeThickness: 12,
    }).setOrigin(0.5);
    title.setShadow(0, 10, '#000000', 18);
    this.tweens.add({
      targets: title, scale: 1.025, yoyo: true, repeat: -1,
      duration: 1600, ease: 'Sine.InOut',
    });

    // Accent rule under the title
    const rule = this.add.graphics();
    rule.fillGradientStyle(0x661111, 0xff4b3e, 0xff4b3e, 0x661111, 1);
    rule.fillRect(GAME_W / 2 - 250, 206, 500, 3);

    this.add.text(GAME_W / 2, 238, 'SURVIVE THE ENDLESS HORDE', {
      fontFamily: FONT, fontSize: '20px', color: '#8d9aa8',
    }).setOrigin(0.5).setLetterSpacing(3);

    if (hiScore > 0) {
      this.add.text(GAME_W / 2, 286, `🏆 BEST  ${hiScore.toLocaleString()}`, {
        fontFamily: FONT, fontSize: '22px', color: '#ffd24a', fontStyle: 'bold',
        stroke: '#241a00', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // PLAY button — large, easy touch target
    this._addButton(GAME_W / 2, 400, 300, 86, '▶  PLAY', '#ffffff', 0x2e8b3a, 0x174a1e, 0x6fe07f, 30, () => this._startGame());

    // INSTALL APP button — appears only when PWA install prompt is available
    if (w._installPrompt) this._addInstallButton();
    const onPrompt = () => this._addInstallButton();
    window.addEventListener('beforeinstallprompt', onPrompt, { once: true });
    this.events.once('shutdown', () => window.removeEventListener('beforeinstallprompt', onPrompt));

    // Hint
    this.add.text(GAME_W / 2, GAME_H - 46, 'Touch joystick to move  ·  💨 dash  ·  🧪 heal  ·  🔄 swap weapon', {
      fontFamily: FONT, fontSize: '15px', color: '#5d6a76',
    }).setOrigin(0.5);
  }

  private _addInstallButton(): void {
    if (this._installBtn.length > 0) return;
    const els = this._addButton(GAME_W / 2, 516, 240, 58, '📲 Install App', '#d4e6ff', 0x2a4d7d, 0x14253e, 0x6fa6e0, 20, () => {
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

  /** Rounded, gradient-filled button. Visuals are a Graphics; an invisible
   *  rectangle on top provides the hit area. */
  private _addButton(
    cx: number, cy: number, w: number, h: number,
    label: string, textColor: string,
    fillTop: number, fillBottom: number, edge: number,
    fontSize: number,
    onTap: () => void,
  ): Phaser.GameObjects.GameObject[] {
    const r = Math.min(18, h / 3);

    // Drawn in local coords around (0,0) and positioned at the center so the
    // press tween scales around the button, not the scene origin.
    const gfx = this.add.graphics({ x: cx, y: cy });
    // drop shadow
    gfx.fillStyle(0x000000, 0.45);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, r);
    // body — two-tone instead of fillGradientStyle, whose triangulated
    // gradient shows diagonal seams on rounded rects
    gfx.fillStyle(fillTop, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    gfx.fillStyle(fillBottom, 0.55);
    gfx.fillRoundedRect(-w / 2, 0, w, h / 2, { tl: 0, tr: 0, bl: r, br: r });
    // top sheen
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.34, Math.min(r - 2, h * 0.17));
    // edge
    gfx.lineStyle(2, edge, 0.8);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const txt = this.add.text(cx, cy, label, {
      fontFamily: FONT, fontSize: `${fontSize}px`, color: textColor, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    txt.setShadow(0, 3, '#000000', 5);

    const hit = this.add.rectangle(cx, cy, w, h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      gfx.setScale(0.97); txt.setScale(0.97);
      this.tweens.add({ targets: [gfx, txt], scale: 1, duration: 130, ease: 'Back.Out' });
      onTap();
    });

    return [gfx, txt, hit];
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
