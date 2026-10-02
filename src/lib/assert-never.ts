// Exhaustive switches over a union (board types): adding a member makes
// TypeScript point at every switch that doesn't handle it yet.
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
