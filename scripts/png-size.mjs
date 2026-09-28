// Prints a PNG's dimensions from its IHDR chunk.
//   node scripts/png-size.mjs board.png
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/png-size.mjs <file.png>");

const buf = readFileSync(file);
const signature = "89504e470d0a1a0a";
if (buf.subarray(0, 8).toString("hex") !== signature) {
  throw new Error(`${file} is not a PNG`);
}
// Bytes 12–15 are the chunk type ("IHDR"), 16–19 width, 20–23 height.
const chunk = buf.subarray(12, 16).toString("ascii");
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
console.log(
  `${file}: chunk=${chunk} width=${width} height=${height} bytes=${buf.length}`,
);
if (width !== 1080 || height !== 1920) {
  console.error("✗ expected 1080 × 1920");
  process.exitCode = 1;
} else {
  console.log("✓ 1080 × 1920");
}
