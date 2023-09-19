/// <reference lib="webworker" />

import { findNearest } from "./hamming-bk-tree";

const bitCountTable = Uint8Array.from({ length: 256 }, (_, i) => 
  (i >> 7) + ((i >> 6) & 1) + ((i >> 5) & 1) + ((i >> 4) & 1) + 
  ((i >> 3) & 1) + ((i >> 2) & 1) + ((i >> 1) & 1) + (i & 1)
);

interface InitMessage {
  type: 'init';
  bitPatterns: Uint8Array[];
}

interface ImageMessage {
  type: 'image';
  jobId: number | string;
  rgba: Uint8Array;
  width: number;
  height: number;
}

type Message = InitMessage | ImageMessage;

type HSV = [hueSin: number, hueCos: number, saturation: number, value: number];

const hsvDist = (
  [ hueSin1, hueCos1, sat1, val1 ]: HSV,
  [ hueSin2, hueCos2, sat2, val2 ]: HSV,
) => {
  const h1 = Math.atan2(hueSin1, hueCos1);
  const h2 = Math.atan2(hueSin2, hueCos2);
  let hDelta = Math.abs(h1 - h2) / Math.PI;
  if (hDelta > 1) hDelta = 2 - hDelta;
  let sDelta = sat1 - sat2;
  let vDelta = val1 - val2;
  // weighted to account for low saturation and low value
  // making other factors less distinguishable/meaningful
  const weightH = (val1 * sat1 + val2 * sat2) / 2;
  const weightS = (val1 + val2) / 2;  
  return (
    (hDelta * hDelta) * weightH
    + (sDelta * sDelta) * weightS
    + (vDelta * vDelta)
  );
};

const hueToVGA = (hueSin: number, hueCos: number) => {
  let h = Math.atan2(hueSin, hueCos) * 180 / Math.PI;
  if (h < 0) h += 360;
  switch (Math.floor((h + 30) / 60)) {
    case 0: return 4;
    case 1: return 6;
    case 2: return 2;
    case 3: return 3;
    case 4: return 1;
    case 5: return 5;
    case 6: default: return 4;
  }
};

const grayscaleToVGA = (value: number) => {
  return (value < 0.25) ? 0 : (value < 0.65) ? 8 : (value < 0.9) ? 7 : 15;
};

const hsvToVGA = ([hueSin, hueCos, saturation, value]: HSV) => {
  if (saturation < 0.5 || value < 0.25) {
    return grayscaleToVGA(value);
  }
  const baseSection = hueToVGA(hueSin, hueCos);
  return (value >= 0.75) ? baseSection + 8 : baseSection;
};

let bitPatterns: Uint8Array[] | null = null;

const offsetsToBitmap = (v: number[]): Uint8Array => {
  const bitmap = new Uint8Array(16);
  for (const offset of v) {
    const bit = offset & 7, byte = offset >>> 3;
    bitmap[byte] |= (0x80 >> bit);
  }
  return bitmap;
};

onmessage = ({ data: message }: { data: Message }) => {
  switch (message.type) {
    case 'init': {
      bitPatterns = message.bitPatterns;
      break;
    }
    case 'image': {
      if (!bitPatterns) {
        postMessage({type: 'error', error:'init not called'});
        break;
      }
      const { rgba } = message;
      const rgba_stride = message.width * 4;
      const pixel_width = message.width - (message.width % 8);
      const pixel_height = message.height - (message.height % 16);
      const huesCos = new Float32Array(pixel_width * pixel_height);
      const huesSin = new Float32Array(pixel_width * pixel_height);
      const saturations = new Float32Array(pixel_width * pixel_height);
      const values = new Float32Array(pixel_width * pixel_height);
      for (let y = 0; y < pixel_width; y++)
      for (let x = 0; x < pixel_width; x++) {
        const rgba_i = (y * rgba_stride) + x * 4;
        const component_i = y * pixel_width + x;
        // Normalize red, green, and blue values
        const rNorm = rgba[rgba_i] / 255;
        const gNorm = rgba[rgba_i + 1] / 255;
        const bNorm = rgba[rgba_i + 2] / 255;
        
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
        h *= Math.PI * 2;
        huesCos[component_i] = Math.cos(h);
        huesSin[component_i] = Math.sin(h);
        saturations[component_i] = s;
        values[component_i] = v;
      }
      const cellsAcross = pixel_width/8;
      const cellsDown = pixel_height/16;
      const cellBuffer = new Uint16Array(cellsAcross * cellsDown);
      for (let cellY = 0; cellY < cellsDown; cellY++)
      for (let cellX = 0; cellX < cellsAcross; cellX++) {
        const getHSV = (xo: number, yo: number): HSV => {
          const component_i = (cellY * 16 + yo) * pixel_width + cellX * 8 + xo;
          return [
            huesSin[component_i],
            huesCos[component_i],
            saturations[component_i],
            values[component_i],
          ];
        };

        const c1_hsv = getHSV(0, 0);
        let c2_hsv = getHSV(1, 0), c2_dist = hsvDist(c1_hsv, c2_hsv);

        for (let test_i = 2; test_i < 8*16; test_i++) {
          const test_hsv = getHSV(test_i % 8, Math.floor(test_i / 8));
          const test_dist = hsvDist(c1_hsv, test_hsv);
          if (test_dist > c2_dist) {
            c2_hsv = test_hsv;
            c2_dist = test_dist;
          }
        }

        const c1_vga = hsvToVGA(c1_hsv);
        const c2_vga = hsvToVGA(c2_hsv);

        let fgColor = 7, bgColor = 0, charCode = 32;

        if (c1_vga === c2_vga) {
          bgColor = c1_vga;
        }
        else {
          const getCentroids = (start1: HSV, start2: HSV): [{which:number[], hsv:HSV}, {which:number[], hsv:HSV}] => {
            const in1: number[] = [], in2: number[] = [];
            let totalHCos1 = 0, totalHSin1 = 0, totalS1 = 0, totalV1 = 0, count1 = 0;
            let totalHCos2 = 0, totalHSin2 = 0, totalS2 = 0, totalV2 = 0, count2 = 0;
            for (let yo = 0; yo < 16; yo++)
            for (let xo = 0; xo < 8; xo++) {
              const hsv = getHSV(xo, yo);
              if (hsvDist(hsv, start1) < hsvDist(hsv, start2)) {
                in1.push(yo*8 + xo);
                totalHSin1 += hsv[0];
                totalHCos1 += hsv[1];
                totalS1 += hsv[2];
                totalV1 += hsv[3];
                count1++;
              }
              else {
                in2.push(yo*8 + xo);
                totalHSin2 += hsv[0];
                totalHCos2 += hsv[1];
                totalS2 += hsv[2];
                totalV2 += hsv[3];
                count2++;
              }
            }
            const ang1 = Math.atan2(totalHSin1, totalHCos1);
            const ang2 = Math.atan2(totalHSin2, totalHCos2);
            const res1 = {which:in1, hsv:[Math.sin(ang1), Math.cos(ang1), totalS1/count1, totalV1/count1] as HSV};
            const res2 = {which:in2, hsv:[Math.sin(ang2), Math.cos(ang2), totalS2/count2, totalV2/count2] as HSV};
            return (in1.length < in2.length) ? [res2, res1] : [res1, res2];
          };

          const hsvToString = (hsv: HSV) => {
            let h = Math.atan2(hsv[0], hsv[1]) * 180 / Math.PI;
            if (h < 0) h += 360;
            const s = hsv[2] * 100;
            const v = hsv[3] * 100;
            return `hsv(${h.toFixed(2)}°, ${s.toFixed(2)}%, ${v.toFixed(2)}%}`;
          };

          let centroids = getCentroids(c1_hsv, c2_hsv);
          let maxIterations = 100;
          const MIN_DELTA = 1e-3;
          do {
            const oldCentroids = centroids;
            const newCentroids = getCentroids(centroids[0].hsv, centroids[1].hsv);
            centroids = newCentroids;
            if (centroids[1].which.length === 0 || (hsvDist(oldCentroids[0].hsv, newCentroids[0].hsv) < MIN_DELTA && hsvDist(oldCentroids[1].hsv, newCentroids[1].hsv) < MIN_DELTA)) {
              break;
            }
          } while (--maxIterations > 0);

          fgColor = hsvToVGA(centroids[0].hsv);
          bgColor = hsvToVGA(centroids[1].hsv);
          const bitPattern = offsetsToBitmap(centroids[0].which);
          const [foundCharCode, foundDistance] = findNearest(bitPattern, bitPatterns);
          charCode = foundCharCode;
          if (foundDistance > 0) {
            for (let i = 0; i < 16; i++) bitPattern[i] ^= 0xff;
            const [invertCharCode, invertDistance] = findNearest(bitPattern, bitPatterns);
            if (invertDistance < foundDistance) {
              charCode = invertCharCode;
              [fgColor, bgColor] = [bgColor, fgColor];
            }
          }
        }

        cellBuffer[(cellY * cellsAcross) + cellX] = charCode | (fgColor << 8) | (bgColor << 12);
      }
      postMessage({
        type: 'image-done',
        jobId: message.jobId,
        data: cellBuffer,
      }, [cellBuffer.buffer]);
      break;
    }
  }
};
