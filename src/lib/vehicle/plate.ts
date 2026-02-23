export function normalizePlate(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function isLikelyChilePlate(normalized: string) {
  // Chile formats vary (e.g. AB1234, ABCD12). Keep it permissive but not empty.
  return /^[A-Z0-9]{5,8}$/.test(normalized);
}

