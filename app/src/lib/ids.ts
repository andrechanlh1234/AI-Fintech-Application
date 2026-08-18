let seq = 1000;

export function uid(): string {
  return 'id' + seq++;
}
