/** Night creatures come out from early evening until dawn, by the player's own clock. */
export const NIGHT_FROM = 17;
export const NIGHT_UNTIL = 6;

export function isNight(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= NIGHT_FROM || hour < NIGHT_UNTIL;
}

/** The Winter Festival runs through December and the first days of January, by the player's own clock. */
export const WINTER_UNTIL_JAN = 6;

export function isWinter(now: number): boolean {
  const d = new Date(now);
  return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= WINTER_UNTIL_JAN);
}
