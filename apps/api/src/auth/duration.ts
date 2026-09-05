const UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses the `15m` / `30d` spellings used in the environment file. */
export function durationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (match === null) throw new Error(`Invalid duration "${value}", expected e.g. 15m or 30d`);

  const amount = Number(match[1]);
  const unit = UNITS[match[2] ?? ''];
  if (unit === undefined) throw new Error(`Invalid duration unit in "${value}"`);
  return amount * unit;
}
