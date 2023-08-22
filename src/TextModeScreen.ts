
const IS_LITTLE_ENDIAN = (new Uint8Array(new Uint16Array([1]).buffer)[0] === 1);

export enum ModifyFlags {
  Tile = 0x00ff,
  ForegroundColor = 0x0f00,
  BackgroundColor = 0xf000,
  All = ModifyFlags.Tile | ModifyFlags.ForegroundColor | ModifyFlags.BackgroundColor,
}

export const SCREEN_WIDTH = 80;
export const SCREEN_HEIGHT = 25;

export interface Brush {
  width: number;
  height: number;
  data: Uint16Array;
}

export enum Color {
  Black,
  DarkBlue,
  DarkGreen,
  DarkCyan,
  DarkRed,
  DarkMagenta,
  Brown,
  LightGrey,
  DarkGrey,
  Blue,
  Green,
  Cyan,
  Red,
  Magenta,
  Yellow,
  White,
}

export const CSSColors = [
  '#000',
  '#008',
  '#080',
  '#088',
  '#800',
  '#808',
  '#880',
  '#ccc',
  '#888',
  '#00f',
  '#0f0',
  '#0ff',
  '#f00',
  '#f0f',
  '#ff0',
  '#fff',
];

type DrawChar = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, i: number, fgColor: Color, bgColor: Color) => void;

export default class TextModeScreen {
  constructor(public drawChar: DrawChar) {
    this.buffer.fill(7 << 8);
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_WIDTH * 8;
    this.canvas.height = SCREEN_HEIGHT * 16;
    this.ctx = this.canvas.getContext('2d')!;
    if (!this.ctx) {
      throw new Error('unable to get canvas context');
    }
  }
  buffer = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  getBrush(x: number, y: number, width: number, height: number): Brush {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new TypeError('x and y must be integers');
    }
    if (!Number.isInteger(width) || !Number.isInteger(y)) {
      throw new TypeError('width and height must be integers');
    }
    if (x < 0 || y < 0 || width < 0 || height < 0 || (x+width) > SCREEN_WIDTH || (y+height) > SCREEN_HEIGHT) {
      throw new RangeError('edges exceed screen');
    }
    const buf = new Uint16Array(width * height);
    for (let yo = 0; yo < height; yo++) {
      buf.set(this.buffer.subarray((y + yo) * SCREEN_WIDTH + x, (y + yo) * SCREEN_WIDTH + x + width), yo * width);
    }
    return {
      data: buf,
      width,
      height,
    };
  }
  putBrush(brush: Brush, x: number, y: number) {
    let offset: number, offset2: number, data = brush.data;
    if (x < 0) {
      offset = -x;
      if (offset >= brush.width) return;
      x = 0;
    }
    else {
      offset = 0;
    }
    offset2 = Math.min(SCREEN_WIDTH - x, x + brush.width);
    if (y < 0) {
      data = data.subarray(y * brush.width);
      if (data.length === 0) return;
      y = 0;
    }
    for (let yo = 0; yo < brush.height; yo++) {
      if ((y+yo) < 0) continue;
      if ((y+yo) >= SCREEN_HEIGHT) break;
      this.buffer.set(data.subarray( (y+yo)*brush.width+offset, (y+yo)*brush.width+offset2 ), y * SCREEN_WIDTH + x);
      for (let xo = offset; xo < offset2; xo++) {
        this.updateCanvas(y+yo, x+xo);
      }
    }
  }
  updateCanvas(x: number, y: number) {
    const v = this.buffer[y * SCREEN_WIDTH + x];
    this.drawChar(this.ctx, x, y, v & 0xff, (v >> 8) & 0xf, (v >> 12) & 0xf);
  }
  getCharInfo(x: number, y: number): { charCode: number, fgColor: Color, bgColor: Color } {
    const v = this.buffer[y * SCREEN_WIDTH + x];
    return { charCode: v & 0xff, fgColor: (v >> 8) & 0xf, bgColor: (v >> 12) & 0xf };
  }
  putChar(x: number, y: number, charCode: number, fgColor: Color, bgColor: Color) {
    this.buffer[y * SCREEN_WIDTH + x] = charCode | (fgColor << 8) | (bgColor << 12);
    this.updateCanvas(x, y);
  }
  setChar(x: number, y: number, charCode: number, fgColor: Color, bgColor: Color, flags = ModifyFlags.All) {
    this.buffer[y * SCREEN_WIDTH + x] = (this.buffer[y * SCREEN_WIDTH + x] & ~flags) | ((charCode | (fgColor << 8) | (bgColor << 12)) & flags);
    this.updateCanvas(x, y);
  }
  fill(charCode: number, fgColor: Color, bgColor: Color, flags = ModifyFlags.All) {
    const cc = (charCode | (fgColor << 8) | (bgColor << 12)) & flags;
    for (let i = 0; i < this.buffer.length; i++) {
      this.buffer[i] = (this.buffer[i] & ~flags) | cc;
      this.updateCanvas(i % SCREEN_WIDTH, Math.floor(i / SCREEN_WIDTH));
    }
  }
  putVHalf(x: number, yh: number, color: Color) {
    const existing = this.buffer[(yh >> 1) * SCREEN_WIDTH + x];
    const existingTile = existing & 0xff;
    const existingFG = (existing >>> 8) & 0xf;
    const existingBG = (existing >>> 12) & 0xf;
    const side = yh & 1;
    let otherColor;
    switch (existingTile) {
      case 0xDB: case 0x08: case 0x0A: {
        otherColor = existingFG;
        break;
      }
      case 0x00: case 0x20: case 0xFF: default: {
        otherColor = existingBG;
        break;
      }
      case 0xDC: {
        otherColor = side === 1 ? existingBG : existingFG;
        break;
      }
      case 0xDF: {
        otherColor = side === 1 ? existingFG : existingBG;
        break;
      }
    }
    if (otherColor === color) {
      this.putChar(x, yh >> 1, 0xDB, color, existingBG);
    }
    else if (side === 0) {
      this.putChar(x, yh >> 1, 0xDF, color, otherColor);
    }
    else {
      this.putChar(x, yh >> 1, 0xDC, color, otherColor);
    }
  }
  putHHalf(xh: number, y: number, color: Color) {
    const existing = this.buffer[y * SCREEN_WIDTH + (xh >> 1)];
    const existingTile = existing & 0xff;
    const existingFG = (existing >>> 8) & 0xf;
    const existingBG = (existing >>> 12) & 0xf;
    const side = xh & 1;
    let otherColor;
    switch (existingTile) {
      case 0xDB: case 0x08: case 0x0A: {
        otherColor = existingFG;
        break;
      }
      case 0x00: case 0x20: case 0xFF: default: {
        otherColor = existingBG;
        break;
      }
      case 0xDE: {
        otherColor = side === 1 ? existingBG : existingFG;
        break;
      }
      case 0xDD: {
        otherColor = side === 1 ? existingFG : existingBG;
        break;
      }
    }
    if (otherColor === color) {
      this.putChar(xh >> 1, y, 0xDB, color, existingBG);
    }
    else if (side === 0) {
      this.putChar(xh >> 1, y, 0xDD, color, otherColor);
    }
    else {
      this.putChar(xh >> 1, y, 0xDE, color, otherColor);
    }
  }
  saveBlob() {
    if (IS_LITTLE_ENDIAN) return new Blob([this.buffer]);
    const buf = new Uint16Array(this.buffer);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = (buf[i] >> 8) | (buf[i] << 8);
    }
    return new Blob([buf], {type: 'application/octet-stream'});
  }
  async loadBlob(blob: Blob) {
    const ab = await blob.arrayBuffer();
    if (ab.byteLength !== this.buffer.byteLength) {
      throw new Error('invalid file');
    }
    const buf = new Uint16Array(ab);
    if (!IS_LITTLE_ENDIAN) {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = (buf[i] >> 8) | (buf[i] << 8);
      }  
    }
    this.buffer.set(buf);
    for (let y = 0; y < SCREEN_HEIGHT; y++)
    for (let x = 0; x < SCREEN_WIDTH; x++)
      this.updateCanvas(x, y);
  }
}
