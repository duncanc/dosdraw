
export const BOXCHAR_UP = 0x01;
export const BOXCHAR_DOWN = 0x02;
export const BOXCHAR_LEFT = 0x04;
export const BOXCHAR_RIGHT = 0x08;
export const BOXCHAR_ALL = BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT;
export const BOXCHAR_VERT_DOUBLE = 0x10;
export const BOXCHAR_HORIZ_DOUBLE = 0x20;

export const DOUBLE_LEFT = 0x10;
export const DOUBLE_RIGHT = 0x01;
export const DOUBLE_TOP = 0x20;
export const DOUBLE_BOTTOM = 0x02;
export const DOUBLE_ALL = 0x33;

export const SINGLE_LEFT = 0x00;
export const SINGLE_RIGHT = 0x00;
export const SINGLE_TOP = 0x00;
export const SINGLE_BOTTOM = 0x00;
export const SINGLE_ALL = 0x00;

const boxchars = new Uint8Array([
  // v single, h single
  0, // none
  0xC1, // up (, down, left)
  0xC2, // down (, left, right)
  0xB3, // up, down
  0xB4, // left (, up, down)
  0xD9, // up, left
  0xBF, // down, left
  0xB4, // up, down, left
  0xC3, // right (, up, down)
  0xC0, // up, right
  0xDA, // down, right
  0xC3, // up, down, right
  0xC4, // left, right
  0xC1, // up, left, right
  0xC2, // down, left, right
  0xC5, // up, down, left, right

  // v double, h single
  0, // none
  0xD0, // up (, left, right)
  0xD2, // down (, left, right)
  0xBA, // up, down
  0xB4, // left (, up, down)
  0xBD, // up, left
  0xB7, // down, left
  0xB6, // up, down, left
  0xC3, // right (, up, down)
  0xD3, // up, right
  0xD6, // down, right
  0xC7, // up, down, right
  0xC4, // left, right
  0xD0, // up, left, right
  0xD2, // down, left, right
  0xD7, // up, down, left, right

  // v single, h double
  0, // none
  0xB4, // up (, left, right)
  0xCB, // down (, left, right)
  0xB3, // up, down
  0xB5, // left (, up, down)
  0xBE, // up, left
  0xB8, // down, left
  0xB5, // up, down, left
  0xC6, // right (, up, down)
  0xD4, // up, right
  0xD5, // down, right
  0xC6, // up, down, right
  0xCD, // left, right
  0xCF, // up, left, right
  0xD1, // down, left, right
  0xD8, // up, down, left, right

  // v double, h double
  0, // none
  0xD0, // up (, left, right)
  0xD2, // down (, left, right)
  0xBA, // up, down
  0xB5, // left (, up, down)
  0xBC, // up, left
  0xBB, // down, left
  0xB9, // up, down, left
  0xC6, // right (, up, down)
  0xC8, // up, right
  0xC9, // down, right
  0xCC, // up, down, right
  0xCD, // left, right
  0xCA, // up, left, right
  0xCB, // down, left, right
  0xCE, // up, down, left, right
]);

const BOXCHARS_OFFSET = 0xB3

const boxchar_info = new Uint8Array([
  // 0xB3
  BOXCHAR_UP | BOXCHAR_DOWN,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT,
  // 0xC0
  BOXCHAR_UP | BOXCHAR_RIGHT,
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_RIGHT,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_RIGHT,
  BOXCHAR_LEFT | BOXCHAR_RIGHT,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_UP | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  // 0xD0
  BOXCHAR_UP | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_UP | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_UP | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_DOWN | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_VERT_DOUBLE,
  BOXCHAR_UP | BOXCHAR_DOWN | BOXCHAR_LEFT | BOXCHAR_RIGHT | BOXCHAR_HORIZ_DOUBLE,
  BOXCHAR_UP | BOXCHAR_LEFT,
  BOXCHAR_DOWN | BOXCHAR_RIGHT,
]);

export function getBoxCharFlags(char: number) {
  char = char - BOXCHARS_OFFSET;
  return !Number.isInteger(char) || (char < 0 || char >= boxchar_info.length) ? 0 : boxchar_info[char];
}

export function getBoxChar(flags: number) {
  return boxchars[flags] || 0;
}

export function drawBox(x1: number, y1: number, x2: number, y2: number, get: (x: number, y: number) => number, set: (x: number, y: number, v: number) => void, double: boolean) {
  const [minX, maxX] = x1 < x2 ? [x1, x2] : [x2, x1];
  const [minY, maxY] = y1 < y2 ? [y1, y2] : [y2, y1];
  const hz = double ? BOXCHAR_HORIZ_DOUBLE : 0;
  const vt = double ? BOXCHAR_VERT_DOUBLE : 0;
  if (minY === maxY) {
    if (minX === maxX) {
      set(minX, minY, getBoxChar(BOXCHAR_ALL));
    }
    else {
      set(minX, minY, getBoxChar((getBoxCharFlags(get(minX, minY)) & ~BOXCHAR_HORIZ_DOUBLE) | BOXCHAR_RIGHT | hz));
      for (let dx = minX+1; dx < maxX; dx++) {
        set(dx, minY, getBoxChar((getBoxCharFlags(get(dx, minY)) & ~BOXCHAR_HORIZ_DOUBLE) | BOXCHAR_LEFT | BOXCHAR_RIGHT | hz));
      }
      set(maxX, minY, getBoxChar((getBoxCharFlags(get(maxX, minY)) & ~BOXCHAR_HORIZ_DOUBLE) | BOXCHAR_LEFT | hz));
    }
  }
  else if (minX === maxX) {
    set(minX, minY, getBoxChar((getBoxCharFlags(get(minX, minY)) & ~BOXCHAR_VERT_DOUBLE) | BOXCHAR_DOWN | vt));
    for (let dy = minY+1; dy < maxY; dy++) {
      set(minX, dy, getBoxChar((getBoxCharFlags(get(minX, dy)) & ~BOXCHAR_VERT_DOUBLE) | BOXCHAR_UP | BOXCHAR_DOWN | vt));
    }
    set(minX, maxY, getBoxChar((getBoxCharFlags(get(minX, maxY)) & ~BOXCHAR_VERT_DOUBLE) | BOXCHAR_UP | vt));
  }
  else {
    set(minX, minY, getBoxChar((getBoxCharFlags(get(minX, minY)) & ~(BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE)) | BOXCHAR_DOWN | BOXCHAR_RIGHT | hz | vt));
    for (let dx = minX+1; dx < maxX; dx++) {
      set(dx, minY, getBoxChar((getBoxCharFlags(get(dx, minY)) & ~BOXCHAR_HORIZ_DOUBLE) | BOXCHAR_LEFT | BOXCHAR_RIGHT | hz));
    }
    set(maxX, minY, getBoxChar((getBoxCharFlags(get(maxX, minY)) & ~(BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE)) | BOXCHAR_DOWN | BOXCHAR_LEFT | hz | vt));
    for (let dy = minY+1; dy < maxY; dy++) {
      set(minX, dy, getBoxChar((getBoxCharFlags(get(minX, dy)) & ~BOXCHAR_VERT_DOUBLE) | BOXCHAR_DOWN | BOXCHAR_UP | vt));              
      set(maxX, dy, getBoxChar((getBoxCharFlags(get(maxX, dy)) & ~BOXCHAR_VERT_DOUBLE) | BOXCHAR_DOWN | BOXCHAR_UP | vt));
    }
    set(minX, maxY, getBoxChar((getBoxCharFlags(get(minX, maxY)) & ~(BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE)) | BOXCHAR_UP | BOXCHAR_RIGHT | hz | vt));              
    for (let dx = minX+1; dx < maxX; dx++) {
      set(dx, maxY, getBoxChar((getBoxCharFlags(get(dx, maxY)) & ~BOXCHAR_HORIZ_DOUBLE) | BOXCHAR_LEFT | BOXCHAR_RIGHT | hz));
    }
    set(maxX, maxY, getBoxChar((getBoxCharFlags(get(maxX, maxY)) & ~(BOXCHAR_VERT_DOUBLE | BOXCHAR_HORIZ_DOUBLE)) | BOXCHAR_UP | BOXCHAR_LEFT | vt | hz));
  }
}
