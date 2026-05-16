import Phaser from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Image {
  damage      = 0;
  pierce      = 0;
  aoe         = 0;
  maxTravel   = 0;
  fromPlayer  = true;

  private travelSq = 0;
  private startX   = 0;
  private startY   = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
  }

  fire(
    x: number, y: number,
    angle: number,
    speed: number,
    damage: number,
    pierce: number,
    aoe: number,
    range: number,
    fromPlayer: boolean,
  ): void {
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true);
    this.setTint(fromPlayer ? 0xffee44 : 0xff6644);
    this.damage     = damage;
    this.pierce     = pierce;
    this.aoe        = aoe;
    this.maxTravel  = range;
    this.fromPlayer = fromPlayer;
    this.startX     = x;
    this.startY     = y;
    this.travelSq   = 0;
    this.setRotation(angle);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  update(_time: number, _delta: number): void {
    const dx = this.x - this.startX;
    const dy = this.y - this.startY;
    this.travelSq = dx * dx + dy * dy;
    if (this.travelSq >= this.maxTravel * this.maxTravel) {
      this.kill();
    }
  }

  kill(): void {
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }
}
