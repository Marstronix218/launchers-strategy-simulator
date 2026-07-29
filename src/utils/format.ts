export function formatYen(value: number, compact = true): string {
  if (!Number.isFinite(value)) return "—";
  if (compact) {
    const oku = value / 100_000_000;
    if (Math.abs(oku) >= 0.1) {
      return `${oku.toLocaleString("ja-JP", {
        maximumFractionDigits: Math.abs(oku) >= 100 ? 0 : 1,
      })}億円`;
    }
    const man = value / 10_000;
    return `${man.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}万円`;
  }
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) >= 90) return "—";
  return `${value.toFixed(1)}x`;
}

export function signedYen(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatYen(value)}`;
}
