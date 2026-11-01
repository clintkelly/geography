export interface TrailEvent {
  id: string;
  title: string;
  text: string;
  /** What a correct answer earns. A wrong answer costs nothing. */
  points: number;
  snack?: boolean;
  freeClue?: boolean;
  success: string;
}

export const TRAIL_EVENTS: readonly TrailEvent[] = [
  { id: 'bridge', title: 'Washed-Out Bridge', text: 'The trail ends at a broken bridge. A nearby sign has a riddle about a shortcut.', points: 2, success: 'You found the shortcut and 2 Trail Points on the way.' },
  { id: 'hiker', title: 'Lost Hiker', text: 'A hiker has lost their way and asks for help with their map.', points: 2, success: 'The grateful hiker gives you 2 Trail Points.' },
  { id: 'prospector', title: 'Old Prospector', text: 'A prospector offers a reward to anyone who can answer a question.', points: 3, success: 'The prospector hands you 3 Trail Points.' },
  { id: 'campfire', title: 'Friendly Campfire', text: 'Travelers around a campfire offer to share if you can join in their quiz.', points: 0, snack: true, success: 'They pack you a Trail Snack for later.' },
  { id: 'ranger', title: 'Ranger Station', text: 'A ranger has been watching the creature and will share a tip for a right answer.', points: 1, freeClue: true, success: 'You get 1 Trail Point and an extra clue at the next stop.' },
  { id: 'marker', title: 'Old Trail Marker', text: 'A carved marker holds a question. Answer it and it points the way.', points: 0, freeClue: true, success: 'The marker gives you an extra clue at the next stop.' },
];
