
import "./index.html";
import "./favicon.png";
import "./dosdraw.css";
import "./chardata.png";
import TextModeScreen, { CSSColors, Color, SCREEN_HEIGHT, SCREEN_WIDTH } from "./TextModeScreen";

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
  const screen = new TextModeScreen(drawChar);
  const canvas = document.getElementById('editor') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('unable to create canvas context');
  }
  let colors = [7, 0, 0];
  const palette = document.querySelector('.palette') as HTMLElement;
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
  canvas.onpointerdown = e => {
    if (e.pointerType === 'mouse') {
      const { button, pointerId } = e;
      if (button !== 0 && button !== 2) return;
      canvas.setPointerCapture(pointerId);
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
      const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);
      screen.putChar(x, y, currentChars[button], colors[0], colors[2]);
      ctx.drawImage(screen.canvas, 0, 0);
      let lastX = x, lastY = y;
      function onpointermove(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        const x = Math.floor((e.clientX - rect.x) * 80 / rect.width);
        const y = Math.floor((e.clientY - rect.y) * 25 / rect.height);  
        for (const [dx, dy] of bresenhamLine(lastX, lastY, x, y)) {
          screen.putChar(dx, dy, currentChars[button], colors[0], colors[2]);
        }
        ctx!.drawImage(screen.canvas, 0, 0);
        lastX = x;
        lastY = y;
      }
      function onpointerup(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        canvas.removeEventListener('pointermove', onpointermove);
        canvas.removeEventListener('pointerup', onpointerup);
      }
      canvas.addEventListener('pointermove', onpointermove);
      canvas.addEventListener('pointerup', onpointerup);
    }
  };
  canvas.oncontextmenu = e => {
    e.preventDefault();
  };
  const charPicker = document.getElementById('char-picker') as HTMLCanvasElement;
  {
    const ctx = charPicker.getContext('2d');
    if (!ctx) {
      throw new Error('unable to create canvas context');
    }
    for (let i = 0; i < 256; i++) {
      drawChar(ctx, i%64, Math.floor(i/64), i, 7, 0);
    }
    const leftPick = document.querySelector('.left-pick') as HTMLElement;
    const rightPick = document.querySelector('.right-pick') as HTMLElement;
    charPicker.onpointerdown = e => {
      if (e.pointerType !== 'mouse' || (e.button !== 0 && e.button !== 2)) return;
      const rect = charPicker.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.x) * 64 / rect.width);
      const y = Math.floor((e.clientY - rect.y) * 4 / rect.height);
      const i = (y * 64) + x;
      const pick = e.button === 2 ? rightPick : leftPick;
      currentChars[e.button] = i;
      pick.style.left = `${x*8}px`;
      pick.style.top = `${y*16}px`;
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
    screen.fill(currentChars[2], colors[0], colors[2]);
    ctx.drawImage(screen.canvas, 0, 0);
  };
}

window.addEventListener('DOMContentLoaded', main, {once: true});
