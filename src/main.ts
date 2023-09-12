
import "./index.html";
import "./favicon.png";
import "./dosdraw.css";
import "./chardata.png";
import TextModeScreen, { CSSColors, Color, ModifyFlags, SCREEN_HEIGHT, SCREEN_WIDTH, TextModeOverlay } from "./TextModeScreen";
import { BOXCHAR_ALL, drawBox, getBoxChar } from "./boxchars";

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

function openDialog() {
  return new Promise<Blob | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      
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
  const ctx = canvas.getContext('2d');
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
  const screenOverlay = new TextModeOverlay(screen);
  const canvas = document.getElementById('editor') as HTMLCanvasElement;
  const canvasOverlay = document.getElementById('editor-overlay') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  const overlayCtx = canvasOverlay.getContext('2d');
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
  let currentChars = [219, 0, 0];
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
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            screenOverlay.commit();
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
            screenOverlay.commit();
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
            screenOverlay.commit();
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
            screenOverlay.commit();
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
            screenOverlay.commit();
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
            screenOverlay.commit();
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
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            screenOverlay.commit();
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
            screenOverlay.commit();
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
          floodFill(
            x, y,
            (x, y) => screen.getCharInfo(x, y),
            (x, y, v, fg, bg) => screen.putChar(x, y, v, fg, bg),
            bitPatterns,
            bitPatternsRotated,
            colors[button]);
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
        screenOverlay.commit();
        overlayCtx!.globalCompositeOperation = 'copy';
        overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
        ctx!.globalCompositeOperation = 'copy';
        ctx!.drawImage(screen.canvas, 0, 0);
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
            screenOverlay.clearChar(cursorX, cursorY);
            overlayCtx!.globalCompositeOperation = 'copy';
            overlayCtx!.drawImage(screenOverlay.canvas, 0, 0);
            return;
          }
          case 'Delete': {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            screenOverlay.clearChar(cursorX, cursorY);
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
        screenOverlay.commit();
        overlayCtx.globalCompositeOperation = 'copy';
        overlayCtx.drawImage(screenOverlay.canvas, 0, 0);
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(screen.canvas, 0, 0);
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
            screenOverlay.commit();
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
            screenOverlay.commit();
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
  document.getElementById('save-image')!.onclick = e => {
    const blob = screen.saveBlob();
    const blobLink = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'dosimage.dat';
    link.href = blobLink;
    link.click();
  };
  document.getElementById('load-image')!.onclick = async e => {
    const blob = await openDialog();
    if (blob) {
      try {
        await screen.loadBlob(blob);
      }
      catch (e) {
        alert(e);
        return;
      }
      ctx.drawImage(screen.canvas, 0, 0);
    }
  };
  document.getElementById('clear-image')!.onclick = e => {
    screen.fill(currentChars[2], colors[0], colors[2], flags);
    ctx.drawImage(screen.canvas, 0, 0);
  };
}

window.addEventListener('DOMContentLoaded', main, {once: true});
