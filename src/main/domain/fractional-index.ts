const DEFAULT_STEP = 1000;

export function atStart(first: number): number {
  return first - DEFAULT_STEP;
}

export function atEnd(last: number): number {
  return last + DEFAULT_STEP;
}

export function between(prev: number | null, next: number | null): number {
  if (prev === null && next === null) {
    return DEFAULT_STEP;
  }
  if (prev === null && next !== null) {
    return atStart(next);
  }
  if (prev !== null && next === null) {
    return atEnd(prev);
  }
  if (prev !== null && next !== null) {
    if (prev === next) {
      return prev + 0.5;
    }
    return prev + (next - prev) / 2;
  }
  return DEFAULT_STEP;
}
