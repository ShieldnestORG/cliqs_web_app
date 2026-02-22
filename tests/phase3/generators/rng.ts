export class RNG {
  private seed: number;

  constructor(seed = 0xC0FFEE) {
    this.seed = seed >>> 0;
  }

  nextU32(): number {
    // xorshift32
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed;
  }

  float(): number {
    return this.nextU32() / 0xffffffff;
  }

  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    const span = max - min + 1;
    return min + (this.nextU32() % span);
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  bool(pTrue = 0.5): boolean {
    return this.float() < pTrue;
  }
}
