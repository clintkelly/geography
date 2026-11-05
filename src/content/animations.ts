/** Sprites with a looping idle animation: `<artId>-f1.png` to `-f4.png`, the same size and position as the still. */
export const ANIMATED_ART: readonly string[] = ['voltewe', 'paddlet', 'paddlet-scholar-3', 'paddlet-ranger-3', 'paddlet-banner-3', 'coatikit', 'coatikit-scholar-3', 'coatikit-ranger-3', 'coatikit-banner-3', 'kiwikin', 'kiwikin-scholar-3', 'kiwikin-ranger-3', 'kiwikin-banner-3'];
export const IDLE_FRAMES = 4;
export const idleFrames = (artId: string) => Array.from({ length: IDLE_FRAMES }, (_, i) => `${artId}-f${i + 1}`);
