// All narrative content for "Echoes of History": missions, memory fragments,
// and exhibit plaques. Keep facts here so they are easy to review.

export const GAME_TITLE = 'The Grand Museum';
export const GAME_SUBTITLE = 'Echoes of History';

// Six memory fragments, each tied to a real moment. `year` drives the
// Timeline Wall puzzle; `position` is [x, z] on the map (height is computed).
export const FRAGMENTS = [
  {
    id: 'ticket',
    year: 1893,
    title: 'A First-Class Train Ticket',
    owner: 'gandhi',
    color: '#e8b04a',
    shape: 'ticket',
    position: [-15, 11],
    text: 'Gandhi is thrown off a train in South Africa for the colour of his skin — the night he resolves to fight injustice.',
  },
  {
    id: 'stamp',
    year: 1902,
    title: 'A Patent Office Stamp',
    owner: 'einstein',
    color: '#6fa8dc',
    shape: 'stamp',
    position: [16, 13],
    text: 'Einstein starts work at the Swiss Patent Office in Bern, doing physics in his spare time.',
  },
  {
    id: 'chalk',
    year: 1905,
    title: 'A Stick of Chalk',
    owner: 'einstein',
    color: '#f3f0e6',
    shape: 'chalk',
    position: [-11, -19],
    text: 'Einstein’s “miracle year”: special relativity and E = mc².',
  },
  {
    id: 'medal',
    year: 1921,
    title: 'A Nobel Medal',
    owner: 'einstein',
    color: '#ffcf4d',
    shape: 'medal',
    position: [17, -36],
    text: 'Einstein wins the Nobel Prize in Physics — for the photoelectric effect, not relativity.',
  },
  {
    id: 'salt',
    year: 1930,
    title: 'A Handful of Salt',
    owner: 'gandhi',
    color: '#ffffff',
    shape: 'salt',
    position: [11, -17],
    text: 'Gandhi walks about 240 miles to Dandi and picks up salt, defying the British salt tax.',
  },
  {
    id: 'badge',
    year: 1942,
    title: 'A “Quit India” Badge',
    owner: 'gandhi',
    color: '#ff9f43',
    shape: 'badge',
    position: [-17, -40],
    text: 'Gandhi launches the Quit India Movement, demanding that Britain leave India.',
  },
];

// Missions unlock in order of `requires`. Objectives complete on game events.
export const MISSIONS = [
  {
    id: 'welcome',
    title: 'A Warm Welcome',
    blurb: 'The Gallery Guide at the info desk is waiting to greet you.',
    objectives: [{ id: 'talk-guide', text: 'Say hello at the info desk', target: 'guide' }],
    reward: 2,
  },
  {
    id: 'minds',
    title: 'Meet the Minds',
    blurb: 'Two of history’s great minds walk these halls. Introduce yourself.',
    requires: ['welcome'],
    objectives: [
      { id: 'talk-gandhi', text: 'Talk to Gandhi', target: 'gandhi' },
      { id: 'talk-einstein', text: 'Talk to Einstein', target: 'einstein' },
    ],
    reward: 2,
  },
  {
    id: 'fragments',
    title: 'Fragments of Time',
    blurb: 'The museum’s timeline has shattered. Find the six glowing memory fragments.',
    requires: ['welcome'],
    objectives: [{ id: 'collect', text: 'Find memory fragments', count: FRAGMENTS.length, target: 'fragment' }],
    reward: 3,
  },
  {
    id: 'timeline',
    title: 'Restore the Timeline',
    blurb: 'Place every fragment on the Timeline Wall in the order history happened.',
    requires: ['fragments'],
    objectives: [{ id: 'restore', text: 'Fix the Timeline Wall', target: 'timeline' }],
    reward: 5,
  },
];

// Stars available: 17 before the Timeline Wall and 23 in total, so
// "Curator of Time" can only be earned by finishing the story.
export const RANKS = [
  { stars: 0, title: 'Visitor' },
  { stars: 5, title: 'Explorer' },
  { stars: 10, title: 'Historian' },
  { stars: 14, title: 'Scholar' },
  { stars: 20, title: 'Curator of Time' },
];

// Readable plaques placed around the hall. Position is [x, z].
export const PLAQUES = [
  {
    id: 'plaque-gandhi',
    title: 'Mahatma Gandhi (1869–1948)',
    position: [8, -12.6],
    text: 'Led India\u2019s nonviolent struggle for independence.',
  },
  {
    id: 'plaque-einstein',
    title: 'Albert Einstein (1879–1955)',
    position: [-8, -12.6],
    text: 'His theories of relativity changed how we see space and time.',
  },
];
