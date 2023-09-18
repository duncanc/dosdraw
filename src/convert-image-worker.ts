/// <reference lib="webworker" />

import hammingBKTree from "./hamming-bk-tree";

const bitCountTable = Uint8Array.from({ length: 256 }, (_, i) => 
  (i >> 7) + ((i >> 6) & 1) + ((i >> 5) & 1) + ((i >> 4) & 1) + 
  ((i >> 3) & 1) + ((i >> 2) & 1) + ((i >> 1) & 1) + (i & 1)
);

interface InitMessage {
  type: 'init';
  charData: Uint8Array;
}

interface ImageMessage {
  type: 'image';
  jobId: number | string;
  rgba: Uint8Array;
  width: number;
  height: number;
}

type Message = InitMessage | ImageMessage;

onmessage = ({ data: message }: { data: Message }) => {
  switch (message.type) {
    case 'init': {
      break;
    }
    case 'image': {
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
        let totalHSin = 0, totalHCos = 0, totalS = 0, totalV = 0;
        for (let yo = 0; yo < 16; yo++)
        for (let xo = 0; xo < 8; xo++) {
          const component_i = (cellY * 16 + yo) * pixel_width + cellX * 8 + xo;
          totalHSin += huesSin[component_i];
          totalHCos += huesCos[component_i];
          totalS += saturations[component_i];
          totalV += values[component_i];
        }
        const meanH = Math.atan2(totalHSin, totalHCos);
        const meanS = totalS / (8 * 16);
        const meanV = totalV / (8 * 16);
        let varSumH = 0, varSumS = 0, varSumV = 0;
        for (let yo = 0; yo < 16; yo++)
        for (let xo = 0; xo < 8; xo++) {
          const i = ((cellY * 16 + yo) * pixel_width + cellX * 8 + xo);
          const h = Math.atan2(huesSin[i], huesCos[i]);
          let delta = Math.abs(h - meanH);
          delta = delta > Math.PI ? Math.PI * 2 - delta : delta;
          varSumH += delta * delta;
          varSumS += saturations[i] * saturations[i];
          varSumV += values[i] * values[i];
        }
        const varianceH = varSumH / (8 * 16);
        const varianceS = varSumS / (8 * 16);
        const varianceV = varSumV / (8 * 16);
        const stdDevH = Math.sqrt(varianceH);
        const stdDevS = Math.sqrt(varianceS);
        const stdDevV = Math.sqrt(varianceV);
        let fgColor = 7, bgColor = 0, charCode = 32;
        const s = meanS * 100;
        const v = meanV * 100;
        let h = meanH * 180 / Math.PI;
        if (h < 0) h += 360;
        const VALUE_DARK_THRESHOLD = 70;
        if (s < 70) {
          if (v < 25) bgColor = 0;
          else if (v < 65) bgColor = 8;
          else if (v < 90) bgColor = 7;
          else bgColor = 15;
        }
        else if (v < 10) {
          bgColor = 0;
        }
        else if (h < 30 || h >= 330) {
          bgColor = (v < VALUE_DARK_THRESHOLD) ? 4 : 4+8;
        }
        else if (h < 90) {
          bgColor = (v < VALUE_DARK_THRESHOLD) ? 6 : 6+8;
        }
        else if (h < 150) {
          bgColor = (v < VALUE_DARK_THRESHOLD) ? 2 : 2+8;
        }
        else if (h < 210) {
          bgColor = (v < VALUE_DARK_THRESHOLD) ? 3 : 3+8;
        }
        else if (h < 270) {
          bgColor = (v < VALUE_DARK_THRESHOLD) ? 1 : 1+8;
        }
        else {
          bgColor = (v < VALUE_DARK_THRESHOLD) ? 5 : 5+8;
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
