
import "./index.html";
import "./favicon.png";
import "./dosdraw.css";
import "./chardata.png";
import TextModeScreen, { CSSColors, Color, ModifyFlags, SCREEN_HEIGHT, SCREEN_WIDTH } from "./TextModeScreen";
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
  const canvas = document.getElementById('editor') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
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
  const tools: {[toolName: string]: () => void} = {
    freehand: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          screen.setChar(x, y, currentChars[button], colors[0], colors[2], flags);
          ctx.drawImage(screen.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);  
            for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
              screen.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
            ctx!.drawImage(screen.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
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
          screen.putVHalf(x, y, colors[button]);
          ctx.drawImage(screen.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 50 / rect.height);  
            for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
              screen.putVHalf(dx, dy, colors[button]);
            }
            ctx!.drawImage(screen.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
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
          screen.putHHalf(x, y, colors[button]);
          ctx.drawImage(screen.canvas, 0, 0);
          let lastX = x, lastY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 160 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);  
            for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
              screen.putHHalf(dx, dy, colors[button]);
            }
            ctx!.drawImage(screen.canvas, 0, 0);
            lastX = x;
            lastY = y;
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            canvas.removeEventListener('pointermove', onpointermove);
            canvas.removeEventListener('pointerup', onpointerup);
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
    lines: () => {
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          drawChar(ctx, x, y, currentChars[button], colors[0], colors[2]);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            for (const [dx, dy] of bresenhamLine(startX, startY, x, y)) {
              drawChar(ctx!, dx, dy, currentChars[button], colors[0], colors[2]);
            }
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            for (const [dx, dy] of bresenhamLine(startX, startY, x, y)) {
              screen.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
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
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          drawChar(ctx, x, y, currentChars[button], colors[0], colors[2]);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            for (const [dx, dy] of filledRect(startX, startY, x, y)) {
              drawChar(ctx!, dx, dy, currentChars[button], colors[0], colors[2]);
            }
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            for (const [dx, dy] of filledRect(startX, startY, x, y)) {
              screen.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
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
      canvas.onpointerdown = e => {
        if (e.pointerType === 'mouse') {
          const { button, pointerId } = e;
          if (button !== 0 && button !== 2) return;
          e.preventDefault();
          canvas.setPointerCapture(pointerId);
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
          const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
          drawChar(ctx, x, y, currentChars[button], colors[0], colors[2]);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            for (const [dx, dy] of emptyRect(startX, startY, x, y)) {
              drawChar(ctx!, dx, dy, currentChars[button], colors[0], colors[2]);
            }
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            for (const [dx, dy] of emptyRect(startX, startY, x, y)) {
              screen.setChar(dx, dy, currentChars[button], colors[0], colors[2], flags);
            }
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
          drawChar(ctx, x, y, getBoxChar(BOXCHAR_ALL), colors[0], colors[2]);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            drawBox(startX, startY, x, y, (x, y) => screen.getChar(x, y), (x, y, v) => drawChar(ctx!, x, y, v, colors[0], colors[2] ), false);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            drawBox(startX, startY, x, y, (x, y) => screen.getChar(x, y), (x, y, v) => screen.putChar(x, y, v, colors[0], colors[2] ), false);
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
          drawChar(ctx, x, y, getBoxChar(BOXCHAR_ALL), colors[0], colors[2]);
          const startX = x, startY = y;
          function onpointermove(e: PointerEvent) {
            if (e.pointerId !== pointerId) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            ctx!.globalCompositeOperation = 'copy';
            ctx!.drawImage(screen.canvas, 0, 0);
            drawBox(startX, startY, x, y, (x, y) => screen.getChar(x, y), (x, y, v) => drawChar(ctx!, x, y, v, colors[0], colors[2] ), true);
          }
          function onpointerup(e: PointerEvent) {
            if (e.pointerId !== pointerId || e.button !== button) return;
            const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
            const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
            drawBox(startX, startY, x, y, (x, y) => screen.getChar(x, y), (x, y, v) => screen.putChar(x, y, v, colors[0], colors[2] ), true);
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
          ctx!.globalCompositeOperation = 'copy';
          ctx!.drawImage(screen.canvas, 0, 0);
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
            if (e.pointerId !== pointerId || e.button !== button) return;
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
          }
          canvas.addEventListener('pointermove', onpointermove);
          canvas.addEventListener('pointerup', onpointerup);
        }
      };
    },
  };
  tools.freehand();
  const toolSelector = document.getElementById('tool-selector') as HTMLSelectElement;
  let selectedTool = toolSelector.value;
  document.body.classList.add('tool-' + selectedTool);
  toolSelector.onchange = (e) => {
    tools[toolSelector.value]();
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
