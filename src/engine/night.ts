/** Night creatures come out from early evening until dawn, by the player's own clock. */
export const NIGHT_FROM = 17;
export const NIGHT_UNTIL = 6;

export function isNight(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= NIGHT_FROM || hour < NIGHT_UNTIL;
}
