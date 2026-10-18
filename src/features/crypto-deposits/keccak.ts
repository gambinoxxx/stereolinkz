// Keccak-256 (the original Keccak padding Ethereum uses, not NIST SHA3-256),
// for EIP-55 address checksums only. Small and dependency-free; checked
// against published test vectors in keccak.test.ts.
const MASK = (BigInt(1) << BigInt(64)) - BigInt(1);
const RC = [
  "0000000000000001",
  "0000000000008082",
  "800000000000808a",
  "8000000080008000",
  "000000000000808b",
  "0000000080000001",
  "8000000080008081",
  "8000000000008009",
  "000000000000008a",
  "0000000000000088",
  "0000000080008009",
  "000000008000000a",
  "000000008000808b",
  "800000000000008b",
  "8000000000008089",
  "8000000000008003",
  "8000000000008002",
  "8000000000000080",
  "000000000000800a",
  "800000008000000a",
  "8000000080008081",
  "8000000000008080",
  "0000000080000001",
  "8000000080008008",
].map((h) => BigInt(`0x${h}`));
// Rotation offsets r[x][y].
const R = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

const rot = (v: bigint, n: number) =>
  n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK;

function permute(a: bigint[]) {
  for (let round = 0; round < 24; round++) {
    const c = [0, 1, 2, 3, 4].map(
      (x) => a[x]! ^ a[x + 5]! ^ a[x + 10]! ^ a[x + 15]! ^ a[x + 20]!,
    );
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5]! ^ rot(c[(x + 1) % 5]!, 1);
      for (let y = 0; y < 5; y++) a[x + 5 * y] = a[x + 5 * y]! ^ d;
    }
    const b: bigint[] = new Array(25).fill(BigInt(0));
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rot(a[x + 5 * y]!, R[x]![y]!);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        a[x + 5 * y] =
          b[x + 5 * y]! ^
          (~b[((x + 1) % 5) + 5 * y]! & MASK & b[((x + 2) % 5) + 5 * y]!);
    a[0] = a[0]! ^ RC[round]!;
  }
}

export function keccak256(input: Uint8Array): Uint8Array {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
  padded.set(input);
  padded[input.length] = 0x01;
  padded[padded.length - 1]! |= 0x80;
  const state: bigint[] = new Array(25).fill(BigInt(0));
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = BigInt(0);
      for (let k = 7; k >= 0; k--)
        lane = (lane << BigInt(8)) | BigInt(padded[off + i * 8 + k]!);
      state[i] = state[i]! ^ lane;
    }
    permute(state);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = state[i]!;
    for (let k = 0; k < 8; k++) {
      out[i * 8 + k] = Number(lane & BigInt(0xff));
      lane >>= BigInt(8);
    }
  }
  return out;
}
