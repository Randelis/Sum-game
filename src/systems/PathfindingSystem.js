import EasyStar from 'easystarjs';
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE, GRID_COLS, GRID_ROWS } from '../constants.js';

export default class PathfindingSystem {
  constructor() {
    this.easystar = new EasyStar.js();
    this.tileSize = TILE_SIZE;
    this.cols     = GRID_COLS;
    this.rows     = GRID_ROWS;

    // All tiles walkable (0 = open). Walls use tile value 1.
    const grid = Array.from({ length: this.rows }, () => new Int8Array(this.cols));
    this.grid = grid;

    // Convert Int8Array rows to plain arrays for EasyStar
    this.easystar.setGrid(Array.from(grid, row => Array.from(row)));
    this.easystar.setAcceptableTiles([0]);
    this.easystar.enableDiagonals();
    this.easystar.disableCornerCutting();
    this.easystar.setIterationsPerCalculation(500);
  }

  // Mark a world-space rectangle as blocked (e.g. a wall obstacle)
  blockRect(wx, wy, ww, wh) {
    const c0 = Math.max(0, Math.floor(wx / this.tileSize));
    const r0 = Math.max(0, Math.floor(wy / this.tileSize));
    const c1 = Math.min(this.cols - 1, Math.floor((wx + ww) / this.tileSize));
    const r1 = Math.min(this.rows - 1, Math.floor((wy + wh) / this.tileSize));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.easystar.setAdditionalPointCost(c, r, 1e9);
      }
    }
  }

  // Request an async path. callback(path | null).
  // path is an array of {x, y} world-space tile centres.
  findPath(fromWorldX, fromWorldY, toWorldX, toWorldY, callback) {
    const sc = this._clampCol(Math.floor(fromWorldX / this.tileSize));
    const sr = this._clampRow(Math.floor(fromWorldY / this.tileSize));
    const ec = this._clampCol(Math.floor(toWorldX   / this.tileSize));
    const er = this._clampRow(Math.floor(toWorldY   / this.tileSize));

    if (sc === ec && sr === er) {
      callback([]);
      return;
    }

    this.easystar.findPath(sc, sr, ec, er, (path) => {
      if (!path) { callback(null); return; }
      callback(path.map(node => this.tileCenter(node.x, node.y)));
    });
    this.easystar.calculate();
  }

  // Step EasyStar's async queue – call once per frame
  step() {
    this.easystar.calculate();
  }

  tileCenter(col, row) {
    return {
      x: col * this.tileSize + this.tileSize * 0.5,
      y: row * this.tileSize + this.tileSize * 0.5,
    };
  }

  worldToTile(wx, wy) {
    return { col: this._clampCol(Math.floor(wx / this.tileSize)),
             row: this._clampRow(Math.floor(wy / this.tileSize)) };
  }

  _clampCol(c) { return Math.max(0, Math.min(this.cols - 1, c)); }
  _clampRow(r) { return Math.max(0, Math.min(this.rows - 1, r)); }
}
