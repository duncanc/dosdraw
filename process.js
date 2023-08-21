const { readFileSync } = require("fs");
const { stdout } = require("process");

const data = readFileSync('src/chardata.data')

const buf = Buffer.alloc(16 * 256);

const stride = 32 * 9;

for (let i = 0; i < 256; i++) {
  const x = 9 * (i % 32);
  const y = 16 * Math.floor(i / 32);
  for (let yo = 0; yo < 16; yo++) {
    let c = 0;
    for (let xo = 0; xo < 8; xo++) {
      c |= data[stride*(y + yo) + x + xo] << (7-xo);
    }
    buf[i * 16 + yo]  = c;
  }
}

stdout.write('export default const CHAR_DATA = new Uint8Array([');
for (let i = 0; i < buf.length; i++) {
  if (i%16 === 0) stdout.write('\n');
  console.log(`  0b${buf[i].toString(2).padStart(8, '0')},`);
}
console.log(']);');
