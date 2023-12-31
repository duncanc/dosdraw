
import "./index.html";
import "./favicon.png";
import "./dosdraw.css";
import "./chardata.png";
import TextModeScreen, { CSSColors, Color, ModifyFlags, SCREEN_HEIGHT, SCREEN_WIDTH, TextModeOverlay } from "./TextModeScreen";
import { BOXCHAR_ALL, drawBox, getBoxChar } from "./boxchars";
import { addSessionUpdate, openSession, redo, setSessionSaved, undo } from "./undo-system";

const ctrlOrCmd = (navigator.platform || '').toUpperCase().indexOf('MAC') === -1 ? (e: KeyboardEvent) => e.ctrlKey : (e: KeyboardEvent) => e.metaKey;

const reqPromise = fetch('./chardata.png');

function* bresenhamLine(x1: number, y1: number, x2: number, y2: number): Generator<[number, number]> {
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = (x1 < x2) ? 1 : -1;
  const sy = (y1 < y2) ? 1 : -1;
  let err = dx - dy;

  while (true) {
      yield [x1, y1];  // This produces a point of the line

      // Breaking condition
      if (x1 === x2 && y1 === y2) {
          break;
      }

      const e2 = 2 * err;

      // Increment x if needed
      if (e2 > -dy) {
          err -= dy;
          x1 += sx;
      }

      // Increment y if needed
      if (e2 < dx) {
          err += dx;
          y1 += sy;
      }
  }
}

function rgbToHSV(r: number, g: number, b: number): [number, number, number] {
  // Normalize red, green, and blue values
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const diff = max - min;

  // Calculate value
  const v = max;

  // Calculate saturation
  const s = max === 0 ? 0 : diff / max;

  // Calculate hue
  let h = 0;
  if (max !== min) {
    if (max === rNorm) {
      h = (gNorm - bNorm) / diff + (gNorm < bNorm ? 6 : 0);
    }
    else if (max === gNorm) {
      h = (bNorm - rNorm) / diff + 2;
    }
    else {
      h = (rNorm - gNorm) / diff + 4;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

const VALUE_DARK_THRESHOLD = 70;

function hsvToVGA(h: number, s: number, v: number) {
  if (s < 70) {
    if (v < 25) return 0;
    if (v < 65) return 8;
    if (v < 90) return 7;
    return 15;
  }
  if (v < 10) return 0;
  if (h < 30 || h >= 330) {
    return (v < VALUE_DARK_THRESHOLD) ? 4 : 4+8;
  }
  if (h < 90) {
    return (v < VALUE_DARK_THRESHOLD) ? 6 : 6+8;
  }
  if (h < 150) {
    return (v < VALUE_DARK_THRESHOLD) ? 2 : 2+8;
  }
  if (h < 210) {
    return (v < VALUE_DARK_THRESHOLD) ? 3 : 3+8;
  }
  if (h < 270) {
    return (v < VALUE_DARK_THRESHOLD) ? 1 : 1+8;
  }
  return (v < VALUE_DARK_THRESHOLD) ? 5 : 5+8;
}

function* filledRect(x1: number, y1: number, x2: number, y2: number): Generator<[number, number]> {
  const xStep = Math.sign(x2 - x1), yStep = Math.sign(y2 - y1);
  if (xStep === 0) {
    if (yStep === 0) {
      yield [x1, y1];
    }
    else for (let y = y1; y !== y2+yStep; y += yStep) {
      yield [x1, y];
    }
    return;
  }
  else if (yStep === 0) {
    for (let x = x1; x !== x2+xStep; x += xStep) {
      yield [x, y1];
    }
  }
  else {
    for (let y = y1; y !== y2+yStep; y += yStep)
    for (let x = x1; x !== x2+xStep; x += xStep) {
      yield [x, y];
    }
  }
}

function* emptyRect(x1: number, y1: number, x2: number, y2: number): Generator<[number, number]> {
  const xStep = Math.sign(x2 - x1), yStep = Math.sign(y2 - y1);
  if (xStep === 0) {
    if (yStep === 0) {
      yield [x1, y1];
    }
    else for (let y = y1; y !== y2+yStep; y += yStep) {
      yield [x1, y];
    }
    return;
  }
  else if (yStep === 0) {
    for (let x = x1; x !== x2+xStep; x += xStep) {
      yield [x, y1];
    }
  }
  else {
    for (let x = x1; x !== x2+xStep; x += xStep) {
      yield [x, y1];
    }
    for (let y = y1 + yStep; y !== y2; y += yStep) {
      yield [x1, y];
      yield [x2, y];
    }
    for (let x = x1; x !== x2+xStep; x += xStep) {
      yield [x, y2];
    }
  }
}

const vgaToLightness = (vga: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15) => {
  switch (vga) {
    case 0: return 0;
    case 1: return 26.7;
    case 2: return 26.7;
    case 3: return 26.7;
    case 4: return 26.7;
    case 5: return 26.7;
    case 6: return 26.7;
    case 7: return 80;
    case 8: return 50;
    case 9: return 50;
    case 10: return 50;
    case 11: return 50;
    case 12: return 50;
    case 13: return 50;
    case 14: return 50;
    case 15: return 100;
    default: return 50;
  }
};

const vgaWithLightness = (vga: number, lightness: number) => {
  if (lightness <= 0) {
    return 0;
  }
  if (lightness >= 100) {
    return 15;
  }
  if ((vga&7)%7 === 0) {
    return (lightness > 65) ? 7 : 8;
  }
  return (lightness < 37.5) ? vga & ~8 : vga | 8;
}

function openDialog(accept?: string[]) {
  return new Promise<File | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept.join(',');
      
      // Handle file selection
      input.onchange = (e) => {
          if (input.files?.length) {
              resolve(input.files![0]);
          } else {
              resolve(null);  // No file selected (though this is hard to detect consistently)
          }
      };

      // Trigger the file dialog
      input.click();
  });
}

const toBits = (img: ImageBitmap) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('unable to create 2D canvas');
  ctx.drawImage(img, 0, 0);
  const stride = img.width / 9;
  const sliced = new Uint8Array(256 * 16);
  for (let i = 0; i < 256; i++) {
    const x = i % stride;
    const y = Math.floor(i / stride);
    const { data } = ctx.getImageData(x * 9, y * 16, 8, 16);
    for (let j = 0; j < 16; j++) {
      sliced[i*16 + j] = data[j * 8 * 4 + 3] ? (1 << 7) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 1) * 4 + 3] ? (1 << 6) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 2) * 4 + 3] ? (1 << 5) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 3) * 4 + 3] ? (1 << 4) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 4) * 4 + 3] ? (1 << 3) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 5) * 4 + 3] ? (1 << 2) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 5) * 4 + 3] ? (1 << 1) : 0;
      sliced[i*16 + j] |= data[((j * 8) + 7) * 4 + 3] ? (1 << 0) : 0;
    }
  }
  const chars = new Array<Uint8Array>(256);
  for (let i = 0; i < 256; i++) {
    chars[i] = sliced.subarray(i * 16, (i + 1) * 16);
  }
  return chars;
};

const rotateBits = (bits: Uint8Array[]) =>{
  const rotated = new Uint16Array(256 * 8);
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 8; j++) {
      for (let k = 0; k < 16; k++) {
        rotated[i*8 + j] |= ((bits[i][k] >>> (7-j)) & 1) << k;
      }
    }
  }
  const chars = new Array<Uint16Array>(256);
  for (let i = 0; i < 256; i++) {
    chars[i] = rotated.subarray(i * 8, (i + 1) * 8);
  }
  return chars;
};

/** The bits common to a and b, propagated outward to include "touching" bits of b */
function propagatedAnd(a: number, b: number): number {
  let result = 0;

  while (a & b) {
    const leadingZeros = Math.clz32(b);
    const islandEnd = 32 - Math.clz32(~b << leadingZeros >>> leadingZeros);
    const island = b >>> islandEnd << islandEnd;
    if (island & a) {
      result |= island;
      a &= ~island;
    }
    b &= ~island;
  }

  return result;
}

const whitespaceHandlers: {[mode: string]: (this: void, str: string) => string} = {
  normal: str => str.trim().replace(/\s+/g, ' '),
  nowrap: str => str.trim().replace(/\s+/g, ' '),
  pre: str => str,
  'pre-wrap': str => str,
  'pre-line': str => str.replace(/[ \t]*(\r?\n|\r)[ \t]*/g, '\n').trim().replace(/[ \t]+/g, ' '),
  'break-spaces': str => str,
};

const MIN_INSET = 1;

function floodFill(
  x: number, y: number,
  getCharInfo: (x: number, y: number) => { charCode: number, bgColor: number, fgColor: number },
  setChar: (x: number, y: number, value: number, fgColor: number, bgColor: number) => void,
  bitPatterns: Uint8Array[],
  bitPatternsRotated: Uint16Array[],
  newColor: number,
) {
  if (x < 0 || y < 0 || x >= SCREEN_WIDTH || y >= SCREEN_HEIGHT) return;
  const xPixel = Math.floor((x % 1) * 8);
  const yPixel = Math.floor((y % 1) * 8);
  x = Math.floor(x);
  y = Math.floor(y);
  let { charCode, bgColor, fgColor } = getCharInfo(x, y);
  if (bgColor === fgColor || charCode === 0x20 || charCode === 0xff) {
    charCode = 0;
  }
  const bitActive = Boolean(bitPatterns[charCode][yPixel] & (0x80 >>> xPixel));
  const fillingColor = bitActive ? fgColor : bgColor;
  const toVisit = new Array<{x: number, y: number, side: 'top' | 'left' | 'bottom' | 'right', mask: number}>();
  const xorMask8 = bitActive ? 0x00 : 0xff;
  const xorMask16 = bitActive ? 0x0000 : 0xffff;
  const vMask = propagatedAnd(0x80 >>> xPixel, bitPatterns[charCode][yPixel] ^ xorMask8);
  const hMask = propagatedAnd(0x8000 >>> yPixel, bitPatternsRotated[charCode][xPixel] ^ xorMask16);
  testUp: {
    if (y === 0) break testUp;
    let tempMask = vMask;
    for (let yb = yPixel - 1; yb >= 0; yb--) {
      tempMask = propagatedAnd(tempMask, bitPatterns[charCode][yb] ^ xorMask8);
      if (tempMask === 0) break testUp;
    }
    toVisit.push({x, y:y-1, side:'bottom', mask:tempMask});
  }
  testDown: {
    if (y === SCREEN_HEIGHT-1) break testDown;
    let tempMask = vMask;
    for (let yb = yPixel + 1; yb < 8; yb++) {
      tempMask = propagatedAnd(tempMask, bitPatterns[charCode][yb] ^ xorMask8);
      if (tempMask === 0) break testDown;
    }
    toVisit.push({x, y:y+1, side:'top', mask:tempMask});
  }
  testLeft: {
    if (x === 0) break testLeft;
    let tempMask = hMask;
    for (let xb = xPixel - 1; xb >= 0; xb--) {
      tempMask = propagatedAnd(tempMask, bitPatternsRotated[charCode][xb] ^ xorMask16);
      if (tempMask === 0) {
        break testLeft;
      }
    }
    toVisit.push({x:x-1, y, side:'right', mask:tempMask});
  }
  testRight: {
    if (x === SCREEN_WIDTH-1) break testRight;
    let tempMask = hMask;
    for (let xb = xPixel + 1; xb < 8; xb++) {
      tempMask = propagatedAnd(tempMask, bitPatternsRotated[charCode][xb] ^ xorMask16);
      if (tempMask === 0) {
        break testRight;
      }
    }
    toVisit.push({x:x+1, y, side:'left', mask:tempMask});
  }
  if (bitActive) {
    setChar(x, y, charCode, newColor, bgColor);
  }
  else {
    setChar(x, y, charCode, fgColor, newColor);
  }
  const visited = new Set<`${number},${number}`>([`${x},${y}`]);
  while (toVisit.length > 0) {
    let { x, y, side, mask } = toVisit.pop()!;
    let { charCode, bgColor, fgColor } = getCharInfo(x, y);
    if ((bgColor !== fillingColor && fgColor !== fillingColor) || charCode === 0xB1 || (charCode === 0xB0 && bgColor !== fillingColor) || (charCode === 0xB2 && fgColor !== fillingColor)) {
      visited.add(`${x},${y}`);
      continue;
    }
    if (fgColor === bgColor || charCode === 0x20 || charCode === 0xff) {
      charCode = 0;
    }
    const xorMask8 = bgColor === fillingColor ? 0xff : 0x00;
    const xorMask16 = bgColor === fillingColor ? 0xffff : 0x0000;
    switch (side) {
      case 'top': {
        let i = 0, leftMask = 0, rightMask = 0;
        for (i = 0; i < 16; i++) {
          mask = propagatedAnd(mask, bitPatterns[charCode][i] ^ xorMask8);
          if (mask === 0) break;
          if (mask & 0x80) {
            leftMask |= propagatedAnd(1 << i, bitPatternsRotated[charCode][0] ^ xorMask16);
          }
          if (mask & 0x01) {
            rightMask |= propagatedAnd(1 << i, bitPatternsRotated[charCode][7] ^ xorMask16);
          }
        }
        if (i > (MIN_INSET-1)) {
          if (mask && y !== (SCREEN_HEIGHT-1) && !visited.has(`${x},${y+1}`)) {
            toVisit.push({x, y:y+1, side:'top', mask });
          }
          if (leftMask && x !== 0 && !visited.has(`${x-1},${y}`)) {
            toVisit.push({x:x-1, y, side:'right', mask:leftMask});
          }
          if (rightMask && x !== (SCREEN_WIDTH-1) && !visited.has(`${x+1},${y}`)) {
            toVisit.push({x:x+1, y, side:'left', mask:rightMask});
          }
          if (bgColor === fillingColor) {
            setChar(x, y, charCode, fgColor, newColor);
          }
          else {
            setChar(x, y, charCode, newColor, bgColor);
          }
          visited.add(`${x},${y}`);
        }
        break;
      }
      case 'bottom': {
        let i = 0, leftMask = 0, rightMask = 0;
        for (i = 15; i >= 0; i--) {
          mask = propagatedAnd(mask, bitPatterns[charCode][i] ^ xorMask8);
          if (mask === 0) break;
          if (mask & 0x80) {
            leftMask |= propagatedAnd(1 << i, bitPatternsRotated[charCode][0] ^ xorMask16);
          }
          if (mask & 0x01) {
            rightMask |= propagatedAnd(1 << i, bitPatternsRotated[charCode][7] ^ xorMask16);
          }
        }
        if (i < (16-MIN_INSET)) {
          if (mask && y !== 0 && !visited.has(`${x},${y-1}`)) {
            toVisit.push({x, y:y-1, side:'bottom', mask });
          }
          if (leftMask && x !== 0 && !visited.has(`${x-1},${y}`)) {
            toVisit.push({x:x-1, y, side:'right', mask:leftMask});
          }
          if (rightMask && x !== (SCREEN_WIDTH-1) && !visited.has(`${x+1},${y}`)) {
            toVisit.push({x:x+1, y, side:'left', mask:rightMask});
          }
          if (bgColor === fillingColor) {
            setChar(x, y, charCode, fgColor, newColor);
          }
          else {
            setChar(x, y, charCode, newColor, bgColor);
          }
          visited.add(`${x},${y}`);
        }
        break;
      }
      case 'left': {
        let i = 0, topMask = 0, bottomMask = 0;
        for (i = 0; i < 8; i++) {
          mask = propagatedAnd(mask, bitPatternsRotated[charCode][i] ^ xorMask16);
          if (mask === 0) break;
          if (mask & 0x8000) {
            bottomMask |= propagatedAnd(0x80 >> i, bitPatterns[charCode][15] ^ xorMask8);
          }
          if (mask & 0x0001) {
            topMask |= propagatedAnd(0x80 >> i, bitPatterns[charCode][0] ^ xorMask8);
          }
        }
        if (i > (MIN_INSET-1)) {
          if (mask && x !== (SCREEN_WIDTH-1) && !visited.has(`${x+1},${y}`)) {
            toVisit.push({x:x+1, y, side:'left', mask });
          }
          if (topMask && y !== 0 && !visited.has(`${x},${y-1}`)) {
            toVisit.push({x, y:y-1, side:'bottom', mask:topMask});
          }
          if (bottomMask && y !== (SCREEN_HEIGHT-1) && !visited.has(`${x},${y+1}`)) {
            toVisit.push({x, y:y+1, side:'top', mask:bottomMask});
          }
          if (bgColor === fillingColor) {
            setChar(x, y, charCode, fgColor, newColor);
          }
          else {
            setChar(x, y, charCode, newColor, bgColor);
          }
          visited.add(`${x},${y}`);
        }
        break;
      }
      case 'right': {
        let i = 0, topMask = 0, bottomMask = 0;
        for (i = 7; i >= 0; i--) {
          mask = propagatedAnd(mask, bitPatternsRotated[charCode][i] ^ xorMask16);
          if (mask === 0) break;
          if (mask & 0x8000) {
            bottomMask |= propagatedAnd(0x80 >> i, bitPatterns[charCode][15] ^ xorMask8);
          }
          if (mask & 0x0001) {
            topMask |= propagatedAnd(0x80 >> i, bitPatterns[charCode][0] ^ xorMask8);
          }
        }
        if (i < (8-MIN_INSET)) {
          if (mask && x !== 0 && !visited.has(`${x-1},${y}`)) {
            toVisit.push({x:x-1, y, side:'right', mask });
          }
          if (topMask && y !== 0 && !visited.has(`${x},${y-1}`)) {
            toVisit.push({x, y:y-1, side:'bottom', mask:topMask});
          }
          if (bottomMask && y !== (SCREEN_HEIGHT-1) && !visited.has(`${x},${y+1}`)) {
            toVisit.push({x, y:y+1, side:'top', mask:bottomMask});
          }
          if (bgColor === fillingColor) {
            setChar(x, y, charCode, fgColor, newColor);
          }
          else {
            setChar(x, y, charCode, newColor, bgColor);
          }
          visited.add(`${x},${y}`);
        }
        break;
      }
    }
  }
}

const codepageChars = [
  0x00,
  0x263A,
  0x263B,
  0x2665,
  0x2666,
  0x2663,
  0x2660,
  0x2022,
  0x25D8,
  0x25CB,
  0x25D9,
  0x2642,
  0x2640,
  0x266A,
  0x266B,
  0x263C,

  0x25BA,
  0x25C4,
  0x2195,
  0x203C,
  0x00B6,
  0x00A7,
  0x25AC,
  0x21A8,
  0x2191,
  0x2193,
  0x2192,
  0x2190,
  0x221F,
  0x2194,
  0x25B2,
  0x25BC,

  ...Array.from({ length: 0x7F - 0x20 }, (_, i) => 0x20 + i),
  0x2302,

  0x00C7,
  0x00FC,
  0x00E9,
  0x00E2,
  0x00E4,
  0x00E0,
  0x00E5,
  0x00E7,
  0x00EA,
  0x00EB,
  0x00E8,
  0x00EF,
  0x00EE,
  0x00EC,
  0x00C4,
  0x00C5,

  0x00C9,
  0x00E6,
  0x00C6,
  0x00F4,
  0x00F6,
  0x00F2,
  0x00FB,
  0x00F9,
  0x00FF,
  0x00D6,
  0x00DC,
  0x00A2,
  0x00A3,
  0x00A5,
  0x20A7,
  0x0192,

  0x00E1,
  0x00ED,
  0x00F3,
  0x00FA,
  0x00F1,
  0x00D1,
  0x00AA,
  0x00BA,
  0x00BF,
  0x2310,
  0x00AC,
  0x00BD,
  0x00BC,
  0x00A1,
  0x00AB,
  0x00BB,

  0x2591,
  0x2592,
  0x2593,
  0x2502,
  0x2524,
  0x2561,
  0x2562,
  0x2556,
  0x2555,
  0x2563,
  0x2551,
  0x2557,
  0x255D,
  0x255C,
  0x255B,
  0x2510,

  0x2514,
  0x2534,
  0x252C,
  0x251C,
  0x2500,
  0x253C,
  0x255E,
  0x255F,
  0x255A,
  0x2554,
  0x2569,
  0x2566,
  0x2560,
  0x2550,
  0x256C,
  0x2567,

  0x2568,
  0x2564,
  0x2565,
  0x2559,
  0x2558,
  0x2552,
  0x2553,
  0x256B,
  0x256A,
  0x2518,
  0x250C,
  0x2588,
  0x2584,
  0x258C,
  0x2590,
  0x2580,

  0x03B1,
  0x00DF,
  0x0393,
  0x03C0,
  0x03A3,
  0x03C3,
  0x00B5,
  0x03C4,
  0x03A6,
  0x0398,
  0x03A9,
  0x03B4,
  0x221E,
  0x03C6,
  0x03B5,
  0x2229,

  0x2261,
  0x00B1,
  0x2265,
  0x2264,
  0x2320,
  0x2321,
  0x00F7,
  0x2248,
  0x00B0,
  0x2219,
  0x00B7,
  0x221A,
  0x207F,
  0x00B2,
  0x25A0,
  0x00A0,
];

const codepageMap = new Map<string, number>(codepageChars.map((v, i) => [String.fromCodePoint(v), i]));

const ansiIntegerList = (v: string) => v ? v.replace(/;$/, '').split(/;/g).map(Number) : [];

async function main() {
  const req = await reqPromise;
  const b = await req.blob();
  const ib = await createImageBitmap(b);
  const stride = ib.width / 9;
  const drawChar = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, i: number, fgColor: Color, bgColor: Color) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = CSSColors[bgColor];
    ctx.fillRect(x * 8, y * 16, 8, 16);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(ib, (i % stride) * 9, Math.floor(i / stride) * 16, 8, 16, x * 8, y * 16, 8, 16);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = CSSColors[fgColor];
    ctx.fillRect(x * 8, y * 16, 8, 16);
    ctx.restore();
  };
  const bitPatterns = toBits(ib);
  const bitPatternsRotated = rotateBits(bitPatterns);
  const screen = new TextModeScreen(drawChar);
  let { sessionId, headUpdateId } = await openSession(screen.buffer);
  const performUndo = async () => {
    let buffer = new Uint16Array(screen.buffer);
    const { data, newUpdateId } = await undo(sessionId, headUpdateId, buffer);
    screen.buffer.set(data);
    for (let y = 0; y < SCREEN_HEIGHT; y++)
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      screen.updateCanvas(x, y);
    }
    ctx!.globalCompositeOperation = 'copy';
    ctx!.drawImage(screen.canvas, 0, 0);
    headUpdateId = newUpdateId;
  };
  const performRedo = async () => {
    let buffer = new Uint16Array(screen.buffer);
    const { data, newUpdateId } = await redo(sessionId, headUpdateId, buffer);
    screen.buffer.set(data);
    for (let y = 0; y < SCREEN_HEIGHT; y++)
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      screen.updateCanvas(x, y);
    }
    ctx!.globalCompositeOperation = 'copy';
    ctx!.drawImage(screen.canvas, 0, 0);
    headUpdateId = newUpdateId;
  };
  document.getElementById('undo')!.onclick = performUndo;
  document.getElementById('redo')!.onclick = performRedo;
  window.addEventListener('paste', async e => {
    const files = Array.from(e.clipboardData?.files || []);
    for (const file of files) {
      if (await loadFile(file)) {
        break;
      }
    }
  });
  document.addEventListener('keydown', e => {
    if (ctrlOrCmd(e)) {
      if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        performRedo();
        e.preventDefault();
      }
      else if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        performUndo();
        e.preventDefault();
      }
    }
  });
  const screenOverlay = new TextModeOverlay(screen);
  const canvas = document.getElementById('editor') as HTMLCanvasElement;
  const canvasOverlay = document.getElementById('editor-overlay') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  const overlayCtx = canvasOverlay.getContext('2d');
  const temp1 = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  const temp2 = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  if (!ctx || !overlayCtx) {
    throw new Error('unable to create canvas context');
  }
  let flags = ModifyFlags.All;
  document.getElementById('tile')!.onchange = e => {
    if ((e.target as HTMLInputElement).checked) {
      flags |= ModifyFlags.Tile;
    }
    else {
      flags &= ~ModifyFlags.Tile;
    }
  };
  document.getElementById('fgcolor')!.onchange = e => {
    if ((e.target as HTMLInputElement).checked) {
      flags |= ModifyFlags.ForegroundColor;
    }
    else {
      flags &= ~ModifyFlags.ForegroundColor;
    }
  };
  document.getElementById('bgcolor')!.onchange = e => {
    if ((e.target as HTMLInputElement).checked) {
      flags |= ModifyFlags.BackgroundColor;
    }
    else {
      flags &= ~ModifyFlags.BackgroundColor;
    }
  };
  let colors = [7, 0, 0];
  const palette = document.querySelector('.palette') as HTMLElement;
  const setColorSelection = (i: number, right: boolean) => {
    const selectionClass = right ? 'background-selected' : 'foreground-selected';
    const selected = palette.querySelectorAll(`.${selectionClass}`); 
    for (let i = 0; i < selected.length; i++) {
      selected[i].classList.remove(selectionClass);
    }
    const colorCell = palette.querySelector(`.color-cell[data-value='${i}']`);
    if (colorCell) {
      colorCell.classList.add(selectionClass);
    }
    colors[right ? 2 : 0] = i;
  };
  palette.onpointerdown = e => {
    if (e.pointerType !== 'mouse' || (e.button !== 0 && e.button !== 2)) {
      return;
    }
    const selectionClass = (e.button === 0) ? 'foreground-selected' : 'background-selected';
    for (let el = e.target as HTMLElement | null; el && !el.classList.contains('palette'); el = el.parentElement) {
      if ('value' in el.dataset) {
        const selected = palette.querySelectorAll(`.${selectionClass}`); 
        for (let i = 0; i < selected.length; i++) {
          selected[i].classList.remove(selectionClass);
        }
        el.classList.add(selectionClass);
        colors[e.button] = +el.dataset['value']!;
        e.preventDefault();
        e.stopPropagation();
        break;
      }
    }
  };
  palette.oncontextmenu = e => {
    e.preventDefault();
  };
  let currentChars = [219, 0, 32];
  let cursorX = 0, cursorY = 0, cursorLineStart = 0;
  const cursorElement = document.querySelector('.cursor') as HTMLElement;
  const setCursorPosition = (x: number, y: number) => {
    cursorElement.style.left = `${x * 8}px`;
    cursorElement.style.top = `${y * 16}px`;
    cursorElement.style.animation = 'none';
    cursorElement.getBoundingClientRect();
    cursorElement.style.removeProperty('animation');
    cursorX = x;
    cursorY = y;
  };
  const editorBlock = document.querySelector('#editor-block') as HTMLElement;
  let lastTileTool = 'freehand';
  const tools: {[toolName: string]: () => (() => void) | void} = {
    freehand: () => {
      lastTileTool = 'freehand';
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, currentChars[button], colors[0], colors[2], flags);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
              screenOverlay.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          async function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    vbFreehand: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 50 / rect.height);
          screenOverlay.putVHalf(x, y, colors[button]);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 50 / rect.height);  
            for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
              screenOverlay.putVHalf(dx, dy, colors[button]);
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    hbFreehand: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 160 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.putHHalf(x, y, colors[button]);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 160 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);  
            for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
              screenOverlay.putHHalf(dx, dy, colors[button]);
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    lines: () => {
      lastTileTool = 'lines';
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, currentChars[button], colors[0], colors[2], flags);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.reset();
            for (const [dx, dy] of bresenhamLine(startX, startY, x, y)) {
              screenOverlay.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    filledBox: () => {
      lastTileTool = 'filledBox';
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, currentChars[button], colors[0], colors[2], flags);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.reset();
            for (const [dx, dy] of filledRect(startX, startY, x, y)) {
              screenOverlay.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    emptyBox: () => {
      lastTileTool = 'emptyBox';
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, currentChars[button], colors[0], colors[2], flags);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.reset();
            for (const [dx, dy] of emptyRect(startX, startY, x, y)) {
              screenOverlay.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    singleBorder: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, getBoxChar(BOXCHAR_ALL), colors[0], colors[2], flags);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.reset();
            drawBox(startX, startY, x, y, (x, y) => screen.getChar(x, y), (x, y, v) => screenOverlay.setChar(x, y, v, colors[0], colors[2], flags), false);
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    doubleBorder: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, getBoxChar(BOXCHAR_ALL), colors[0], colors[2], flags);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.reset();
            drawBox(startX, startY, x, y, (x, y) => screen.getChar(x, y), (x, y, v) => screenOverlay.setChar(x, y, v, colors[0], colors[2], flags), true);
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    colorFloodFill: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.x) * 80 / rect.width);
          const y = ((e.clientY - rect.y) * 25 / rect.height);
          temp1.set(screen.buffer);
          floodFill(
            x, y,
            (x, y) => screen.getCharInfo(x, y),
            (x, y, v, fg, bg) => screen.putChar(x, y, v, fg, bg),
            bitPatterns,
            bitPatternsRotated,
            colors[button]);
          temp2.set(screen.buffer);
          addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
          .then(newUpdateId => { headUpdateId = newUpdateId; });
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(screen.canvas, 0, 0);
        }
      };
    },
    pick: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          const { charCode, fgColor, bgColor } = screen.getCharInfo(x, y);
          if (flags & ModifyFlags.Tile) selectChar(charCode, button === 2);
          if (flags & ModifyFlags.ForegroundColor) setColorSelection(fgColor, false);
          if (flags & ModifyFlags.BackgroundColor) setColorSelection(bgColor, true);
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            const { charCode, fgColor, bgColor } = screen.getCharInfo(x, y);
            if (flags & ModifyFlags.Tile) selectChar(charCode, button === 2);
            if (flags & ModifyFlags.ForegroundColor) setColorSelection(fgColor, false);
            if (flags & ModifyFlags.BackgroundColor) setColorSelection(bgColor, true);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
            toolSelector.value = lastTileTool;
            toolSelector.dispatchEvent(new Event("change"));
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    text: () => {
      editorBlock.focus();
      let changes = false;
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0) return;
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          setCursorPosition(x, y);
          cursorLineStart = x;
          editorBlock.focus();
        }
      };
      const type = (c: number) => {
        changes = true;
        let pos2 = cursorX;
        while (screenOverlay.isModified(pos2, cursorY)) {
          if (++pos2 === SCREEN_WIDTH) {
            pos2--;
            break;
          }
        }
        if (pos2 > cursorX) {
          screenOverlay.shiftChars(cursorX, cursorY, pos2 + 1 - cursorX, 1);
        }
        screenOverlay.setChar(cursorX, cursorY, c, colors[0], colors[2], flags);
        overlayCtx.globalCompositeOperation = 'copy';
        overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
        if (cursorX === (SCREEN_WIDTH-1)) {
          if (cursorY !== (SCREEN_HEIGHT-1)) {
            setCursorPosition(0, cursorY + 1);
          }
        }
        else {
          setCursorPosition(cursorX+1, cursorY);
        }
      };
      function onblur() {
        if (changes) {
          temp1.set(screen.buffer);
          screenOverlay.commit();
          temp2.set(screen.buffer);
          addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
          .then(newUpdateId => { headUpdateId = newUpdateId; });
          overlayCtx!.globalCompositeOperation = 'copy';
          overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          ctx!.globalCompositeOperation = 'copy';
          ctx!.drawImage(screen.canvas, 0, 0);
          changes = false;
        }
      }
      editorBlock.onblur = onblur;
      let altNums: string[] = [];
      function onkeydown(e: KeyboardEvent) {
        if (e.code === 'AltLeft' || e.code === 'AltRight') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        switch (e.key) {
          case 'Tab': return;
          case 'ArrowDown': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            setCursorPosition(cursorX, Math.min(cursorY + 1, SCREEN_HEIGHT-1));
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          case 'ArrowUp': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            setCursorPosition(cursorX, Math.max(cursorY - 1, 0));
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          case 'ArrowLeft': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (cursorX === 0) {
              if (cursorY !== 0) {
                setCursorPosition(SCREEN_WIDTH-1, cursorY-1);
              }
            }
            else {
              if ((cursorX-1) < cursorLineStart) {
                cursorLineStart = cursorX-1;
              }
              setCursorPosition(cursorX-1, cursorY);
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          case 'ArrowRight': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (cursorX === (SCREEN_WIDTH-1)) {
              if (cursorY !== (SCREEN_HEIGHT-1)) {
                setCursorPosition(0, cursorY + 1);
              }
            }
            else {
              setCursorPosition(cursorX+1, cursorY);
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          case 'Enter': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            setCursorPosition(cursorLineStart, Math.min(SCREEN_HEIGHT-1, cursorY+1));
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          case 'End': case 'PageDown': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            setCursorPosition(cursorX, SCREEN_HEIGHT-1);
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          case 'Home': case 'PageUp': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            setCursorPosition(cursorX, 0);
            e.preventDefault();
            e.stopPropagation();   
            return;
          }
          case 'Backspace': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (cursorX === 0) {
              if (cursorY !== 0) {
                setCursorPosition(SCREEN_WIDTH-1, cursorY-1);
              }
            }
            else {
              if ((cursorX-1) < cursorLineStart) {
                cursorLineStart = cursorX-1;
              }
              setCursorPosition(cursorX-1, cursorY);
            }
            screenOverlay.shiftChars(cursorX, cursorY, SCREEN_WIDTH - cursorX, -1);
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            return;
          }
          case 'Delete': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            screenOverlay.shiftChars(cursorX, cursorY, SCREEN_WIDTH - cursorX, -1);
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            return;
          }
        }
        if (e.altKey && !e.ctrlKey && e.location === 3 && e.key >= '0' && e.key <= '9') {
          altNums.push(e.key);
          e.preventDefault();
          e.stopPropagation();
        }
        else if (!e.ctrlKey && !e.altKey) {
          const charCode = codepageMap.get(e.key);
          if (typeof charCode === 'number') {
            type(charCode);
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
      function onkeyup(e: KeyboardEvent) {
        if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
          if (altNums.length > 0) {
            const val = Number.parseInt(altNums.slice(-3).join('')) & 0xff;
            altNums.length = 0;
            type(val);
          }
          e.preventDefault();
          e.stopPropagation();
        }
      }
      function onpaste(e: ClipboardEvent) {
        const html = e.clipboardData?.getData('text/html');
        if (html) {
          console.log(html);
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tempCanvas.height = 1;
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) {
            throw new Error('unable to get canvas context');
          }
          ctx.globalCompositeOperation = 'copy';
          const getRGBA = (colorString: string) => {
            ctx.fillStyle = colorString;
            ctx.fillRect(0, 0, 1, 1);
            const { data } = ctx.getImageData(0, 0, 1, 1);
            return [data[0], data[1], data[2], data[3]];
          };
          const processEl = (el: HTMLElement, context: { whitespaceMode?: string, hidden?: boolean } = {}, isInner = false) => {
            if (/^(?:script|style|noscript|template|head)$/i.test(el.nodeName)) {
              return;
            }
            if (el.style.display === 'none') {
              return;
            }
            if (/^br$/i.test(el.nodeName)) {
              setCursorPosition(cursorLineStart, Math.min(SCREEN_HEIGHT-1, cursorY+1));
              return;
            }
            let newHidden = Boolean(context.hidden) || (el.style.visibility === 'hidden' || parseFloat(el.style.opacity) <= 0);
            const newFgColor = el.style.color.replace(/^(inherit|currentcolor|initial|revert|revert-layer|unset|transparent)$/i, '');
            const newBgColor = el.style.backgroundColor.replace(/^(inherit|currentcolor|initial|revert|revert-layer|unset|transparent)$/i, '');
            const restoreColor0 = colors[0];
            const restoreColor2 = colors[2];
            if (newFgColor) {
              const rgba = getRGBA(newFgColor);
              if (rgba[3] === 0) {
                newHidden = true;
              }
              const hsv = rgbToHSV(rgba[0], rgba[1], rgba[2]);
              colors[0] = hsvToVGA(hsv[0], hsv[1], hsv[2]);
            }
            if (newBgColor) {
              const rgba = getRGBA(newBgColor);
              const hsv = rgbToHSV(rgba[0], rgba[1], rgba[2]);
              colors[2] = hsvToVGA(hsv[0], hsv[1], hsv[2]);
            }
            const newWhiteSpace = el.style.whiteSpace.replace(/^(inherit|initial|revert|revert-layer|unset)$/i, '') || context.whitespaceMode || '';
            const newContext = (Boolean(context.hidden) !== newHidden) || (newWhiteSpace !== (context.whitespaceMode || '')) ? {
              hidden: newHidden, whitespaceMode: newWhiteSpace,
            } : context;
            const wsHandler = whitespaceHandlers[newWhiteSpace || context.whitespaceMode || 'normal'] || whitespaceHandlers['normal'];
            const textParts: string[] = [];
            const isInline = /^(?:a|abbr|acronym|b|bdo|big|button|cite|code|dfn|em|i|kbd|label|map|object|output|q|samp|small|span|strong|sub|textarea|time|tt|var|ins|del|mark|ruby|rt|rp|html|body)$/i.test(el.nodeName);
            let firstPart = !isInner && !isInline;
            let startX = cursorX, startY = cursorY;
            for (let node = el.firstChild; node; node = node.nextSibling) {
              switch (node.nodeType) {
                case Node.ELEMENT_NODE: {
                  if (textParts.length > 0) {
                    const text = wsHandler((firstPart ? '' : 'X') + textParts.join('') + 'X').slice(firstPart ? 0 : 1, -1);
                    textParts.length = 0;
                    if (text.length > 0) {
                      for (const c of text) {
                        if (c === '\n') {
                          setCursorPosition(cursorLineStart, Math.min(SCREEN_HEIGHT-1, cursorY+1));
                        }
                        else {
                          type(codepageMap.get(c) ?? 63);
                        }
                      }
                    }
                  }
                  if (processEl(node as HTMLElement, newContext, !firstPart)) {
                    startX = cursorX;
                    startY = cursorY;
                    firstPart = true;
                  }
                  else {
                    firstPart = false;
                  }
                  break;
                }
                case Node.TEXT_NODE: case Node.CDATA_SECTION_NODE: case Node.ENTITY_NODE: {
                  textParts.push(node.nodeValue || '');
                  break;
                }
              }
            }
            if (textParts.length > 0) {
              const text = wsHandler((firstPart ? '' : 'X') + textParts.join('')).slice(firstPart ? 0 : 1);
              textParts.length = 0;
              for (const c of text) {
                if (c === '\n') {
                  setCursorPosition(cursorLineStart, Math.min(SCREEN_HEIGHT-1, cursorY+1));
                }
                else {
                  type(codepageMap.get(c) ?? 63);
                }
              }
            }
            colors[0] = restoreColor0;
            colors[2] = restoreColor2;
            if ((startX !== cursorX || startY !== cursorY) && !isInline) {
              setCursorPosition(cursorLineStart, Math.min(SCREEN_HEIGHT-1, cursorY+1));
              return true;
            }
            else {
              return false;
            }
          };
          processEl(doc.documentElement);
          return;
        }
        const pasted = e.clipboardData?.getData('text');
        if (pasted) {
          e.preventDefault();
          for (const c of pasted.replace(/\r\n?|\n\r/g, '\n')) {
            if (c === '\n') {
              setCursorPosition(cursorLineStart, Math.min(SCREEN_HEIGHT-1, cursorY+1));
            }
            else {
              type(codepageMap.get(c) ?? 63);
            }
          }
        }
      }
      editorBlock.addEventListener('keydown', onkeydown);
      editorBlock.addEventListener('keyup', onkeyup);
      document.addEventListener('paste', onpaste);
      return () => {
        editorBlock.onblur = null;
        if (changes) {
          temp1.set(screen.buffer);
          screenOverlay.commit();
          temp2.set(screen.buffer);
          addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
          .then(newUpdateId => { headUpdateId = newUpdateId; });
          overlayCtx!.globalCompositeOperation = 'copy';
          overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          ctx!.globalCompositeOperation = 'copy';
          ctx!.drawImage(screen.canvas, 0, 0);
        }
        editorBlock.removeEventListener('keydown', onkeydown);
        editorBlock.removeEventListener('keyup', onkeyup);
        document.removeEventListener('paste', onpaste);
      };
    },
    gradientBox: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          const gradient = getGradient();
          if (gradient.length === 0) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, 0xDB, gradient[0], 0);
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          const startX = x, startY = y;
          const dirSelector = document.getElementById('gradient-direction-selector') as HTMLSelectElement;
          const getRatio: (x: number, y: number, minX: number, maxX: number, minY: number, maxY: number) => number
            = (dirSelector.value === 'up')      ?    (x, y, minX, maxX, minY, maxY) => (y - maxY) / (minY - maxY)
            : (dirSelector.value === 'right')    ?    (x, y, minX, maxX, minY, maxY) => (x - minX) / (maxX - minX)
            : (dirSelector.value === 'left')   ?    (x, y, minX, maxX, minY, maxY) => (x - maxX) / (minX - maxX)
            : /* (sideSelector.value === 'down') ? */ (x, y, minX, maxX, minY, maxY) => (y - minY) / (maxY - minY);
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.reset();
            const [minX, maxX] = startX < x ? [startX, x] : [x, startX];
            const [minY, maxY] = startY < y ? [startY, y] : [y, startY];
            for (const [dx, dy] of filledRect(startX, startY, x, y)) {
              if (dx < 0 || dy < 0 || dx >= SCREEN_WIDTH || dy >= SCREEN_HEIGHT) {
                continue;
              }
              const ratio = getRatio(dx, dy, minX, maxX, minY, maxY);
              const { charCode, fgColor, bgColor } = calcGradientCharInfo(gradient, ratio);
              screenOverlay.setChar(dx, dy, charCode, fgColor, bgColor);
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    rainbowBrush: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0) return;
          e.preventDefault();
          const gradient = getGradient();
          const gradientLength = gradient.length;
          if (gradientLength === 0) return;
          gradient.push(gradient[0]);
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screenOverlay.setChar(x, y, 0xDB, gradient[0], gradient[0]);
          let pos = 0;
          overlayCtx.globalCompositeOperation = 'copy';
          overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            if (x !== lastX || y !== lastY) {
              let first = true;
              for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
                if (first) {
                  first = false;
                  continue;
                }
                pos = (pos + 0.25) % gradientLength;
                const { charCode, fgColor, bgColor } = calcGradientCharInfo(gradient, pos / gradientLength);
                screenOverlay.setChar(dx, dy, charCode, fgColor, bgColor);
              }
            }
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    spraypaint: () => {
      canvas.onpointerdown = e => {
        const { pointerId, pointerType, button } = e;
        if (pointerType === 'mouse' && button === 0) {
          const gradient = getGradient();
          if (gradient.length === 0) return;
          const sprayfield = new Float32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          sprayfield.fill(-1);
          const rect = canvas.getBoundingClientRect();
          let lastTime = performance.now();
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) {
              return;
            }
            const time = performance.now();
            const timeDiff = time - lastTime;
            lastTime = time;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            const { charCode, fgColor, bgColor } = screen.getCharInfo(x, y);
            const i = y*SCREEN_WIDTH + x;
            if (sprayfield[i] === -1) {
              if (fgColor === bgColor) {
                const pos = gradient.indexOf(bgColor);
                sprayfield[i] = pos === -1 ? 0 : pos;
              }
              else switch (charCode) {
                case 0x00: case 0x20: case 0xFF: {
                  const pos = gradient.indexOf(bgColor);
                  sprayfield[i] = pos === -1 ? 0 : pos;
                  break;
                }
                case 0x08: case 0x0A: case 0xDB: {
                  const pos = gradient.indexOf(fgColor);
                  sprayfield[i] = pos === -1 ? 0 : pos;
                  break;
                }
                case 0xB0: {
                  const bgPos = gradient.indexOf(bgColor);
                  const fgPos = gradient.indexOf(fgColor);
                  if (bgPos === -1) {
                    if (fgPos === -1) {
                      sprayfield[i] = 0;
                    }
                    else {
                      sprayfield[i] = Math.max(0, fgPos - 0.5);
                    }
                  }
                  else if (fgPos === -1) {
                    sprayfield[i] = Math.max(0, bgPos - 0.5);
                  }
                  else if (bgPos === fgPos - 1) {
                    sprayfield[i] = bgPos + 0.25;
                  }
                  else if (fgPos === bgPos - 1) {
                    sprayfield[i] = fgPos + 0.75;
                  }
                  else {
                    sprayfield[i] = Math.max(0, Math.min(fgPos, bgPos) + 0.25);
                  }
                  break;
                }
                case 0xB1: {
                  const bgPos = gradient.indexOf(bgColor);
                  const fgPos = gradient.indexOf(fgColor);
                  if (bgPos === -1) {
                    if (fgPos === -1) {
                      sprayfield[i] = 0;
                    }
                    else {
                      sprayfield[i] = Math.max(0, fgPos - 0.5);
                    }
                  }
                  else if (fgPos === -1) {
                    sprayfield[i] = Math.max(0, bgPos - 0.5);
                  }
                  else if (bgPos === fgPos - 1) {
                    sprayfield[i] = bgPos + 0.5;
                  }
                  else if (fgPos === bgPos - 1) {
                    sprayfield[i] = fgPos + 0.5;
                  }
                  else {
                    sprayfield[i] = Math.max(0, Math.min(fgPos, bgPos) + 0.5);
                  }
                  break;
                }
                case 0xB2: {
                  const bgPos = gradient.indexOf(bgColor);
                  const fgPos = gradient.indexOf(fgColor);
                  if (bgPos === -1) {
                    if (fgPos === -1) {
                      sprayfield[i] = 0;
                    }
                    else {
                      sprayfield[i] = Math.max(0, fgPos - 0.5);
                    }
                  }
                  else if (fgPos === -1) {
                    sprayfield[i] = Math.max(0, bgPos - 0.5);
                  }
                  else if (bgPos === fgPos - 1) {
                    sprayfield[i] = bgPos + 0.75;
                  }
                  else if (fgPos === bgPos - 1) {
                    sprayfield[i] = fgPos + 0.25;
                  }
                  else {
                    sprayfield[i] = Math.max(0, Math.min(fgPos, bgPos) + 0.5);
                  }
                  break;
                }
                default: {
                  let pos = gradient.indexOf(bgColor);
                  if (pos === -1) pos = gradient.indexOf(fgColor);
                  sprayfield[i] = pos + 0.5;
                  break;
                }
              }
            }
            sprayfield[i] += Math.min(0.25, timeDiff/100);
            let newChar: number, newFG: number, newBG: number;
            if (sprayfield[i] >= gradient.length-1) {
              newChar = 0xDB; newFG = gradient[gradient.length-1]; newBG = 0;
            }
            else {
              const intPart = Math.floor(sprayfield[i]);
              const fracPart = sprayfield[i] - intPart;
              if (fracPart < 0.125) {
                newChar = 0xDB; newFG = gradient[intPart]; newBG = 0;
              }
              else if (fracPart < 0.375) {
                newChar = 0xB0; newFG = gradient[intPart+1]; newBG = gradient[intPart];
              }
              else if (fracPart < 0.625) {
                newChar = 0xB1; newFG = gradient[intPart+1]; newBG = gradient[intPart];
              }
              else if (fracPart < 0.875) {
                newChar = 0xB2; newFG = gradient[intPart+1]; newBG = gradient[intPart];
              }
              else {
                newChar = 0xDB; newFG = gradient[intPart+1]; newBG = gradient[intPart];
              }
            }
            if (newChar !== charCode || newFG !== fgColor || newBG !== bgColor) {
              screenOverlay.putChar(x, y, newChar, newFG, newBG);
              overlayCtx!.globalCompositeOperation = 'copy';
              overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            }
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) {
              return;
            }
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    darken: () => {
      canvas.onpointerdown = e => {
        const { pointerId, pointerType, button } = e;
        if (pointerType === 'mouse' && button === 0) {
          const foreField = new Float32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          foreField.fill(-1);
          const backField = new Float32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          backField.fill(-1);
          const rect = canvas.getBoundingClientRect();
          let lastTime = performance.now();
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) {
              return;
            }
            const time = performance.now();
            const timeDiff = time - lastTime;
            lastTime = time;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            const { charCode, fgColor, bgColor } = screen.getCharInfo(x, y);
            const i = y*SCREEN_WIDTH + x;
            if (foreField[i] === -1) {
              foreField[i] = 1 - vgaToLightness(fgColor)/100;
            }
            if (backField[i] === -1) {
              backField[i] = 1 - vgaToLightness(bgColor)/100;
            }
            foreField[i] += Math.min(0.01, timeDiff/1000);
            backField[i] += Math.min(0.01, timeDiff/1000);
            let newChar: number = charCode, newFG: number, newBG: number;
            newFG = vgaWithLightness(fgColor, (1 - foreField[i]) * 100);
            newBG = vgaWithLightness(bgColor, (1 - backField[i]) * 100);
            if (newChar !== charCode || newFG !== fgColor || newBG !== bgColor) {
              screenOverlay.putChar(x, y, newChar, newFG, newBG);
              overlayCtx!.globalCompositeOperation = 'copy';
              overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            }
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) {
              return;
            }
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    lighten: () => {
      canvas.onpointerdown = e => {
        const { pointerId, pointerType, button } = e;
        if (pointerType === 'mouse' && button === 0) {
          const foreField = new Float32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          foreField.fill(-1);
          const backField = new Float32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          backField.fill(-1);
          const rect = canvas.getBoundingClientRect();
          let lastTime = performance.now();
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) {
              return;
            }
            const time = performance.now();
            const timeDiff = time - lastTime;
            lastTime = time;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            const { charCode, fgColor, bgColor } = screen.getCharInfo(x, y);
            const i = y*SCREEN_WIDTH + x;
            if (foreField[i] === -1) {
              foreField[i] = vgaToLightness(fgColor)/100;
            }
            if (backField[i] === -1) {
              backField[i] = vgaToLightness(bgColor)/100;
            }
            foreField[i] += Math.min(0.01, timeDiff/1000);
            backField[i] += Math.min(0.01, timeDiff/1000);
            let newChar: number = charCode, newFG: number, newBG: number;
            newFG = vgaWithLightness(fgColor, foreField[i] * 100);
            newBG = vgaWithLightness(bgColor, backField[i] * 100);
            if (newChar !== charCode || newFG !== fgColor || newBG !== bgColor) {
              screenOverlay.putChar(x, y, newChar, newFG, newBG);
              overlayCtx!.globalCompositeOperation = 'copy';
              overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            }
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) {
              return;
            }
            temp1.set(screen.buffer);
            screenOverlay.commit();
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
  };
  {
    const addGradientSlotButton = document.getElementById('add-gradient-slot')!;
    const gradientSlotTemplate = (document.getElementById('gradient-slot-template') as HTMLTemplateElement).content.querySelector('.gradient-slot') as HTMLElement;
    const gradientSlots = document.querySelector('.gradient-slots') as HTMLElement;
    const addGradientColor = (i: number) => {
      const slot = gradientSlotTemplate.cloneNode(true) as HTMLElement;
      slot.dataset.value = String(i);
      (slot.querySelector('.remove-gradient-slot') as HTMLElement).onclick = () => {
        gradientSlots.removeChild(slot);
      };
      gradientSlots.insertBefore(slot, addGradientSlotButton);
    };
    addGradientSlotButton.onclick = () => {
      addGradientColor(colors[0]);
    };
    addGradientColor(0);
    addGradientColor(8);
    addGradientColor(7);
    addGradientColor(15);
  }
  const getGradient = (): number[] => {
    const nodes = document.querySelectorAll('.gradient-slots .gradient-slot');
    const gradient: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      gradient.push(Number((nodes[i] as HTMLElement).dataset.value));
    }
    return gradient;
  };
  const calcGradientCharInfo = (g: number[], ratio: number): { charCode: number, fgColor: number, bgColor: number } => {
    if (g.length < 2) return { charCode: 0xDB, fgColor: g[0] || 0, bgColor: 0};
    ratio = Math.max(0, Math.min(1, Number(ratio) || 0));
    ratio *= g.length - 1;
    const intPart = Math.floor(ratio);
    if (intPart >= g.length-1) {
      return { charCode: 0xDB, fgColor: g[g.length-1], bgColor: 0 };
    }
    const fracPart = ratio - intPart;
    if (fracPart < 0.125) {
      return {
        charCode: 0x00,
        fgColor: g[intPart+1],
        bgColor: g[intPart],
      }
    }
    else if (fracPart < 0.375) {
      return {
        charCode: 0xB0,
        fgColor: g[intPart+1],
        bgColor: g[intPart],
      };
    }
    else if (fracPart < 0.625) {
      return {
        charCode: 0xB1,
        fgColor: g[intPart+1],
        bgColor: g[intPart],
      };
    }
    else if (fracPart < 0.875) {
      return {
        charCode: 0xB2,
        fgColor: g[intPart+1],
        bgColor: g[intPart],
      };
    }
    else {
      return {
        charCode: 0xDB,
        fgColor: g[intPart+1],
        bgColor: 0,
      };
    }
  };
  let unloadTool: (() => void) | void;
  unloadTool = tools.freehand();
  const toolSelector = document.getElementById('tool-selector') as HTMLSelectElement;
  let selectedTool = toolSelector.value;
  document.body.classList.add('tool-' + selectedTool);
  toolSelector.onchange = (e) => {
    if (unloadTool) unloadTool();
    unloadTool = tools[toolSelector.value]();
    document.body.classList.remove('tool-' + selectedTool);
    selectedTool = toolSelector.value;
    document.body.classList.add('tool-' + selectedTool);
  };
  toolSelector.dispatchEvent(new Event('change'));
  canvas.oncontextmenu = e => {
    e.preventDefault();
  };
  const charPicker = document.getElementById('char-picker') as HTMLCanvasElement;
  const leftPick = document.querySelector('.left-pick') as HTMLElement;
  const rightPick = document.querySelector('.right-pick') as HTMLElement;
  const selectChar = (i: number, right: boolean) => {
    const x = i % 64;
    const y = Math.floor(i / 64);
    const pick = right ? rightPick : leftPick;
    pick.style.left = `${x*8}px`;
    pick.style.top = `${y*16}px`;
    currentChars[right ? 2 : 0] = i;
  };
  {
    const ctx = charPicker.getContext('2d');
    if (!ctx) {
      throw new Error('unable to create canvas context');
    }
    for (let i = 0; i < 256; i++) {
      drawChar(ctx, i%64, Math.floor(i/64), i, 7, 0);
    }
    charPicker.onpointerdown = e => {
      if (e.pointerType !== 'mouse' || (e.button !== 0 && e.button !== 2)) return;
      const rect = charPicker.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.x) * 64 / rect.width);
      const y = Math.floor((e.clientY - rect.y) * 4 / rect.height);
      const i = (y * 64) + x;
      selectChar(i, e.button === 2);
    };
    charPicker.oncontextmenu = e => {
      e.preventDefault();
    };
  }

  const saveButton = document.getElementById('save-image')!;
  const saveMenu = document.getElementById('save-menu')!;

  let saveMenuIsOpen = false;

  const adjustMenuPosition = () => {
    const buttonRect = saveButton.getBoundingClientRect();
    const menuHeight = saveMenu.offsetHeight;
  
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
  
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      saveMenu.style.top = '';
      saveMenu.style.bottom = '100%';
    }
    else {
      saveMenu.style.top = '100%';
      saveMenu.style.bottom = '';
    }
  };

  const toggleMenu = () => {
    saveMenuIsOpen = !saveMenuIsOpen;
    saveMenu.style.display = saveMenuIsOpen ? 'block' : 'none';
    if (saveMenuIsOpen) {
      adjustMenuPosition();
    }
  };

  const closeMenu = () => {
    saveMenuIsOpen = false;
    saveMenu.style.display = 'none';
  };

  saveButton.addEventListener('click', toggleMenu);

  addEventListener('blur', () => {
    closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (!saveMenu.contains(target) && !saveButton.contains(target)) {
      closeMenu();
    }
  }, true);

  document.getElementById('save-dat')!.onclick = e => {
    e.preventDefault();
    closeMenu();
    const blob = screen.saveBlob();
    const blobLink = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'dosimage.dat';
    link.href = blobLink;
    link.click();
    setSessionSaved(sessionId, headUpdateId);
  };

  document.getElementById('save-png')!.onclick = async e => {
    e.preventDefault();
    closeMenu();
    const blob = await new Promise<Blob>((resolve, reject) => screen.canvas.toBlob((blob) => {
      if (blob) resolve(blob); else reject('unable to create blob');
    }));
    const blobLink = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'dosimage.png';
    link.href = blobLink;
    link.click();
  };

  document.getElementById('save-ans')!.onclick = async e => {
    e.preventDefault();
    closeMenu();
    const bytes: number[] = [
      0x1B, '['.charCodeAt(0), '0'.charCodeAt(0), 'm'.charCodeAt(0),
      0x1B, '['.charCodeAt(0), '2'.charCodeAt(0), 'J'.charCodeAt(0),
    ];
    let currentFg = -1, currentBg = -1;
    for (let pos = 0; pos < screen.buffer.length; pos++) {
      if ((pos % SCREEN_WIDTH) === 0) {
        const line = 1 + (pos / SCREEN_WIDTH);
        bytes.push(0x1b, '['.charCodeAt(0), ...[...String(line)].map(v => v.charCodeAt(0)), 'H'.charCodeAt(0));
      }
      const c = screen.buffer[pos] & 0xff;
      if (c < 32) {
        alert('Sorry - ANS format cannot use any of the first 32 characters');
        return;
      }
      const fg = (screen.buffer[pos] >> 8) & 0xf;
      const bg = (screen.buffer[pos] >> 12) & 0xf;
      if (currentFg !== fg || currentBg !== bg) {
        bytes.push(0x1b, '['.charCodeAt(0));
        if (currentFg !== fg) switch (fg) {
          case 0: bytes.push('3'.charCodeAt(0), '0'.charCodeAt(0)); break;
          case 1: bytes.push('3'.charCodeAt(0), '4'.charCodeAt(0)); break;
          case 2: bytes.push('3'.charCodeAt(0), '2'.charCodeAt(0)); break;
          case 3: bytes.push('3'.charCodeAt(0), '6'.charCodeAt(0)); break;
          case 4: bytes.push('3'.charCodeAt(0), '1'.charCodeAt(0)); break;
          case 5: bytes.push('3'.charCodeAt(0), '5'.charCodeAt(0)); break;
          case 6: bytes.push('3'.charCodeAt(0), '3'.charCodeAt(0)); break;
          case 7: bytes.push('3'.charCodeAt(0), '7'.charCodeAt(0)); break;
          case 8: bytes.push('9'.charCodeAt(0), '0'.charCodeAt(0)); break;
          case 9: bytes.push('9'.charCodeAt(0), '4'.charCodeAt(0)); break;
          case 10: bytes.push('9'.charCodeAt(0), '2'.charCodeAt(0)); break;
          case 11: bytes.push('9'.charCodeAt(0), '6'.charCodeAt(0)); break;
          case 12: bytes.push('9'.charCodeAt(0), '1'.charCodeAt(0)); break;
          case 13: bytes.push('9'.charCodeAt(0), '5'.charCodeAt(0)); break;
          case 14: bytes.push('9'.charCodeAt(0), '3'.charCodeAt(0)); break;
          case 15: bytes.push('9'.charCodeAt(0), '7'.charCodeAt(0)); break;
        }
        if (currentFg !== fg && currentBg !== bg) {
          bytes.push(';'.charCodeAt(0));
        }
        if (currentBg !== bg) switch(bg) {
          case 0: bytes.push('4'.charCodeAt(0), '0'.charCodeAt(0)); break;
          case 1: bytes.push('4'.charCodeAt(0), '4'.charCodeAt(0)); break;
          case 2: bytes.push('4'.charCodeAt(0), '2'.charCodeAt(0)); break;
          case 3: bytes.push('4'.charCodeAt(0), '6'.charCodeAt(0)); break;
          case 4: bytes.push('4'.charCodeAt(0), '1'.charCodeAt(0)); break;
          case 5: bytes.push('4'.charCodeAt(0), '5'.charCodeAt(0)); break;
          case 6: bytes.push('4'.charCodeAt(0), '3'.charCodeAt(0)); break;
          case 7: bytes.push('4'.charCodeAt(0), '7'.charCodeAt(0)); break;
          case 8: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '0'.charCodeAt(0)); break;
          case 9: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '4'.charCodeAt(0)); break;
          case 10: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '2'.charCodeAt(0)); break;
          case 11: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '6'.charCodeAt(0)); break;
          case 12: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '1'.charCodeAt(0)); break;
          case 13: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '5'.charCodeAt(0)); break;
          case 14: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '3'.charCodeAt(0)); break;
          case 15: bytes.push('1'.charCodeAt(0), '0'.charCodeAt(0), '7'.charCodeAt(0)); break;
        }
        bytes.push('m'.charCodeAt(0));
        currentFg = fg;
        currentBg = bg;
      }
      bytes.push(c);
    }
    bytes.push(0x1A);
    const blob = new Blob([new Uint8Array(bytes)]);
    const blobLink = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'dosimage.ans';
    link.href = blobLink;
    link.click();
  };

  document.getElementById('save-html')!.onclick = async e => {
    e.preventDefault();
    closeMenu();
    const buf = ['<!DOCTYPE html><html><head><meta charset="utf8"></head><body><pre style="font-family: \'Perfect DOS VGA 437\', \'IBM VGA 8x16\', monospace;"><span>'];
    let currentFg = -1, currentBg = -1;
    for (let pos = 0; pos < screen.buffer.length; pos++) {
      if ((pos % SCREEN_WIDTH) === 0) {
        if (pos !== 0) buf.push('\n');
      }
      const c = screen.buffer[pos] & 0xff;
      const fg = (screen.buffer[pos] >> 8) & 0xf;
      const bg = (screen.buffer[pos] >> 12) & 0xf;
      if (currentFg !== fg || currentBg !== bg) {
        buf.push('</span><span style="')
        switch (fg) {
          case 0: buf.push('color:#000;'); break;
          case 1: buf.push('color:#008;'); break;
          case 2: buf.push('color:#080;'); break;
          case 3: buf.push('color:#088;');; break;
          case 4: buf.push('color:#800;');; break;
          case 5: buf.push('color:#808;');; break;
          case 6: buf.push('color:#880;');; break;
          case 7: buf.push('color:#ccc;');; break;
          case 8: buf.push('color:#888;');; break;
          case 9: buf.push('color:#00f;');; break;
          case 10: buf.push('color:#0f0;');; break;
          case 11: buf.push('color:#0ff;');; break;
          case 12: buf.push('color:#f00;');; break;
          case 13: buf.push('color:#f0f;');; break;
          case 14: buf.push('color:#ff0;');; break;
          case 15: buf.push('color:#fff;');; break;
        }
        switch(bg) {
          case 0: buf.push('background-color:#000;'); break;
          case 1: buf.push('background-color:#008;'); break;
          case 2: buf.push('background-color:#080;'); break;
          case 3: buf.push('background-color:#088;');; break;
          case 4: buf.push('background-color:#800;');; break;
          case 5: buf.push('background-color:#808;');; break;
          case 6: buf.push('background-color:#880;');; break;
          case 7: buf.push('background-color:#ccc;');; break;
          case 8: buf.push('background-color:#888;');; break;
          case 9: buf.push('background-color:#00f;');; break;
          case 10: buf.push('background-color:#0f0;');; break;
          case 11: buf.push('background-color:#0ff;');; break;
          case 12: buf.push('background-color:#f00;');; break;
          case 13: buf.push('background-color:#f0f;');; break;
          case 14: buf.push('background-color:#ff0;');; break;
          case 15: buf.push('background-color:#fff;');; break;
        }
        buf.push('">');
        currentFg = fg;
        currentBg = bg;
      }
      if (c === 0) {
        buf.push('<span style="font-weight:bold"> </span>');
      }
      else {
        const codePoint = codepageChars[c];
        if (codePoint >= 32 && codePoint <= 127) {
          buf.push(String.fromCharCode(codePoint));
        }
        else {
          buf.push('&#x'+codePoint.toString(16)+';');
        }
      }
    }
    buf.push('</span></pre></body></html>');
    const blob = new Blob(buf, {type:'text/html;charset=utf-8'});
    const blobLink = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'dosimage.html';
    link.href = blobLink;
    link.click();
  };

  const loadFile = async (file: File) => {
    if ((file.type || '').startsWith('image/') || /\.(?:jpe?g|jfif|pjpeg|pjp|a?png|gif|bmp|ico|cur|tiff?|svg|webp|avif)$/i.test(file.name || '')) {
      let ib: ImageBitmap;
      try {
        ib = await createImageBitmap(file);
      }
      catch {
        return false;
      }
      if (ib.width === 0 || ib.height === 0) {
        console.warn('empty image');
        return false;
      }
      if (ib.width !== 640 || ib.height !== 400) {
        ib = await createImageBitmap(ib, {resizeWidth: 640, resizeHeight: 400, resizeQuality: ib.width > 640 || ib.height > 400 ? 'high' : 'pixelated'});
      }
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = ib.width;
      tempCanvas.height = ib.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('unable to create canvas context');
      tempCtx.globalCompositeOperation = 'copy';
      tempCtx.drawImage(ib, 0, 0);
      const pixels = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
      return await new Promise<boolean>((resolve, reject) => {
        const webworker = new Worker('./convert-image-worker.js');
        webworker.onmessage = ({ data: { type, data } }: { data: { type: string, data: Uint16Array } }) => {
          if (type === 'image-done') {
            temp1.set(screen.buffer);
            screen.buffer.set(data);
            for (let y = 0; y < SCREEN_HEIGHT; y++)
            for (let x = 0; x < SCREEN_WIDTH; x++) {
              screen.updateCanvas(x, y);
            }
            temp2.set(screen.buffer);
            addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
            .then(newUpdateId => { headUpdateId = newUpdateId; });
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            resolve(true);
          }
        };
        webworker.postMessage({ type: 'init', bitPatterns });
        webworker.postMessage({ type: 'image', rgba: pixels, width: ib.width, height: ib.height }, [pixels.buffer]);
      });
    }
    if (/\.ans$/i.test(file.name || '')) {
      const ab = await file.arrayBuffer();
      let fgColor = 7, bgColor = 0;
      let reverse = false, bold = false;
      let ansiOffset = 0;
      let cursorOffset = 0;
      let savedCursorOffset = 0;
      const u8 = new Uint8Array(ab);
      const newBuffer = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
      ansiLoop: while (ansiOffset < u8.length) {
        if (u8[ansiOffset] === 0x1B) {
          let buffer: string[] = [];
          while (++ansiOffset < u8.length) {
            const c = String.fromCharCode(u8[ansiOffset]);
            buffer.push(c);
            if (buffer.length === 1) {
              if (buffer[0] !== '[') {
                ansiOffset++;
                break;
              }
            }
            else if (/[@A-Z\[\]\^_a-z\{\|\}~]/.test(c)) {
              ansiOffset++;
              break;
            }
          }
          const escape = buffer.join('');
          if (escape[0] === '[') {
            switch (escape.slice(-1)) {
              case 'm': {
                if (/^\[(?:\d+(?:;\d+)*)?m$/.test(escape)) {
                  for (const code of ansiIntegerList(escape.slice(1, -1))) {
                    switch (code) {
                      case 30: fgColor = 0; break;
                      case 34: fgColor = 1; break;
                      case 32: fgColor = 2; break;
                      case 36: fgColor = 3; break;
                      case 31: fgColor = 4; break;
                      case 35: fgColor = 5; break;
                      case 33: fgColor = 6; break;
                      case 37: fgColor = 7; break;
                      case 90: fgColor = 8; break;
                      case 94: fgColor = 9; break;
                      case 92: fgColor = 10; break;
                      case 96: fgColor = 11; break;
                      case 91: fgColor = 12; break;
                      case 95: fgColor = 13; break;
                      case 93: fgColor = 14; break;
                      case 97: fgColor = 15; break;

                      case 40: bgColor = 0; break;
                      case 44: bgColor = 1; break;
                      case 42: bgColor = 2; break;
                      case 46: bgColor = 3; break;
                      case 41: bgColor = 4; break;
                      case 45: bgColor = 5; break;
                      case 43: bgColor = 6; break;
                      case 47: bgColor = 7; break;
                      case 100: bgColor = 8; break;
                      case 104: bgColor = 9; break;
                      case 102: bgColor = 10; break;
                      case 106: bgColor = 11; break;
                      case 101: bgColor = 12; break;
                      case 105: bgColor = 13; break;
                      case 103: bgColor = 14; break;
                      case 107: bgColor = 15; break;

                      case 0: fgColor = 7; bgColor = 0; reverse = false; bold = false; break;
                      case 1: bold = true; break;
                      case 4: break; // underline
                      case 5: break; // blink
                      case 7: reverse = true; break;
                      case 22: bold = false; break;
                      case 27: reverse = false; break;
                      case 39: fgColor = 7; break;
                      case 49: bgColor = 0; break;
                      default: console.log('['+code+'m');
                    }
                  }
                }
                break;
              }
              case 'A': {
                cursorOffset -= (ansiIntegerList(escape.slice(1, -1))[0] ?? 1) * SCREEN_WIDTH;
                break;
              }
              case 'B': {
                cursorOffset += (ansiIntegerList(escape.slice(1, -1))[0] ?? 1) * SCREEN_WIDTH;
                break;
              }
              case 'C': {
                cursorOffset += (ansiIntegerList(escape.slice(1, -1))[0] ?? 1);
                break;
              }
              case 'D': {
                cursorOffset -= (ansiIntegerList(escape.slice(1, -1))[0] ?? 1);
                break;
              }
              case 'H': case 'f': {
                const data = ansiIntegerList(escape.slice(1, -1));
                cursorOffset = ((data[0] ?? 1) - 1) * SCREEN_WIDTH + ((data[1] ?? 1) - 1);
                break;
              }
              case 's': {
                savedCursorOffset = cursorOffset;
                break;
              }
              case 'u': {
                cursorOffset = savedCursorOffset;
                break;
              }
              case 'J': {
                const codes = ansiIntegerList(escape.slice(1, -1));
                if (codes.length === 0) {
                  if (cursorOffset < (SCREEN_WIDTH*SCREEN_HEIGHT)) {
                    newBuffer.fill(
                      0x20 | ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)),
                      Math.max(0, cursorOffset - cursorOffset % SCREEN_WIDTH),
                    );
                  }
                }
                else for (const code of codes) switch (code) {
                  case 1: {
                    if (cursorOffset > 0) {
                      newBuffer.fill(
                        0x20 | ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)),
                        0,
                        Math.min(SCREEN_WIDTH * SCREEN_HEIGHT, (cursorOffset - cursorOffset % SCREEN_WIDTH) + SCREEN_WIDTH),
                      );
                    }
                    break;
                  }
                  case 2: {
                    newBuffer.fill( 0x20 | ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)) );
                    cursorOffset = 0;
                    break;
                  }
                  default: {
                    console.log('['+code+'J');
                    break;
                  }
                }
                break;
              }
              case 'K': {
                if (cursorOffset < 0 || cursorOffset >= SCREEN_WIDTH*SCREEN_HEIGHT) {
                  break;
                }
                const codes = ansiIntegerList(escape.slice(1, -1));
                if (codes.length === 0) {
                  newBuffer.fill(
                    0x20 | ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)),
                    cursorOffset,
                    cursorOffset - (cursorOffset % SCREEN_WIDTH) + SCREEN_WIDTH,
                  );
                }
                else for (const code of codes) switch (code) {
                  case 1: {
                    newBuffer.fill(
                      0x20 | ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)),
                      cursorOffset - (cursorOffset % SCREEN_WIDTH),
                      cursorOffset + 1,
                    );
                    break;
                  }
                  case 2: {
                    newBuffer.fill(
                      0x20 | ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)),
                      cursorOffset - (cursorOffset % SCREEN_WIDTH),
                      cursorOffset - (cursorOffset % SCREEN_WIDTH) + SCREEN_WIDTH,
                    );
                    break;
                  }
                  default: {
                    console.log('['+code+'J');
                    break;
                  }
                }
                break;
              }
              default: {
                console.log(escape);
                break;
              }
            }
          }
          else {
            console.log(escape);
          }
        }
        else switch (u8[ansiOffset]) {
          case 0x0D: {
            cursorOffset -= cursorOffset % SCREEN_WIDTH;
            ansiOffset++;
            break;
          }
          case 0x0A: {
            cursorOffset += SCREEN_WIDTH;
            ansiOffset++;
            break;
          }
          case 0x1A: {
            break ansiLoop;
          }
          default: {
            if (cursorOffset >= 0 && cursorOffset < SCREEN_WIDTH*SCREEN_HEIGHT) {
              newBuffer[cursorOffset++] = u8[ansiOffset++] | (reverse ? ((bgColor << 8) | (fgColor << 12) | (bold ? 0x8000 : 0)) : ((fgColor << 8) | (bgColor << 12) | (bold ? 0x800 : 0)));
            }
            else {
              cursorOffset++;
              ansiOffset++;
            }
            break;  
          }
        }
      }
      temp1.set(screen.buffer);
      screen.buffer.set(newBuffer);
      for (let y = 0; y < SCREEN_HEIGHT; y++)
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        screen.updateCanvas(x, y);
      }
      temp2.set(screen.buffer);
      addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
      .then(newUpdateId => { headUpdateId = newUpdateId; });
      ctx!.globalCompositeOperation = 'copy';
      ctx!.drawImage(screen.canvas, 0, 0);
      return true;
    }
    if ((file.type || 'application/octet-stream') === 'application/octet-stream' && file.size === SCREEN_WIDTH*SCREEN_HEIGHT*2) {
      const temp3 = new Uint16Array(screen.buffer);
      try {
        await screen.loadBlob(file);
      }
      catch (e) {
        alert(e);
        return false;
      }
      temp2.set(screen.buffer);
      addSessionUpdate(sessionId, headUpdateId, temp3, temp2)
      .then(newUpdateId => { headUpdateId = newUpdateId; });  
      ctx.drawImage(screen.canvas, 0, 0);
      return true;
    }
    return false;
  };
  document.getElementById('load-image')!.onclick = async e => {
    const file = await openDialog(['.dat', 'image/*', '.ans']);
    if (file) {
      loadFile(file);
    }
  };
  document.getElementById('clear-image')!.onclick = e => {
    temp1.set(screen.buffer);
    screen.fill(currentChars[2], colors[0], colors[2], flags);
    temp2.set(screen.buffer);
    addSessionUpdate(sessionId, headUpdateId, temp1, temp2)
    .then(newUpdateId => { headUpdateId = newUpdateId; });
    ctx.drawImage(screen.canvas, 0, 0);
  };

  // Counter to keep track of drag enter/leave events
  let dragCounter = 0;

  // Drag enter event handler
  document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    document.body.classList.add('dropping');
  });

  // Drag leave event handler
  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      document.body.classList.remove('dropping');
    }
  });

  // Drag over event handler
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  // Drop event handler
  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter = 0;
    document.body.classList.remove('dropping');
    
    for (const file of e.dataTransfer?.files || []) {
      if (await loadFile(file)) {
        break;
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', main, {once: true});
