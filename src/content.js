// All narrative content for "Echoes of History": missions, memory fragments,
// character dialogue and quizzes. Keep facts here so they are easy to review.

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
    text: 'In June 1893 a young lawyer named Mohandas Gandhi was removed from a first-class compartment at Pietermaritzburg station in South Africa because of the colour of his skin. He spent a cold night in the waiting room and later described it as a turning point that set him on the path of resisting injustice.',
  },
  {
    id: 'stamp',
    year: 1902,
    title: 'A Patent Office Stamp',
    owner: 'einstein',
    color: '#6fa8dc',
    shape: 'stamp',
    position: [16, 13],
    text: 'In 1902 Albert Einstein took a job as a technical expert (third class) at the Swiss Patent Office in Bern. Reviewing inventions by day, he worked on physics in his spare time — and some of history’s most important ideas grew out of those quiet years.',
  },
  {
    id: 'chalk',
    year: 1905,
    title: 'A Stick of Chalk',
    owner: 'einstein',
    color: '#f3f0e6',
    shape: 'chalk',
    position: [-11, -19],
    text: 'In 1905, his “miracle year”, Einstein published four papers: on the photoelectric effect, on Brownian motion, on special relativity, and one showing that mass and energy are equivalent — the idea written today as E = mc².',
  },
  {
    id: 'medal',
    year: 1921,
    title: 'A Nobel Medal',
    owner: 'einstein',
    color: '#ffcf4d',
    shape: 'medal',
    position: [17, -36],
    text: 'Einstein received the 1921 Nobel Prize in Physics (announced in 1922) “for his services to Theoretical Physics, and especially for his discovery of the law of the photoelectric effect” — not for relativity, as many people assume.',
  },
  {
    id: 'salt',
    year: 1930,
    title: 'A Handful of Salt',
    owner: 'gandhi',
    color: '#ffffff',
    shape: 'salt',
    position: [11, -17],
    text: 'On 12 March 1930 Gandhi set out from Sabarmati Ashram and walked about 240 miles to the coastal village of Dandi, arriving on 6 April. There he picked up salt from the shore, defying the British salt tax. The Salt March inspired civil disobedience across India.',
  },
  {
    id: 'badge',
    year: 1942,
    title: 'A “Quit India” Badge',
    owner: 'gandhi',
    color: '#ff9f43',
    shape: 'badge',
    position: [-17, -40],
    text: 'On 8 August 1942 Gandhi launched the Quit India Movement, calling on Britain to leave India and urging Indians to “Do or Die”. He and other leaders were arrested within hours, but the movement became one of the largest mass protests of the independence struggle.',
  },
];

// Missions unlock in order of `requires`. Objectives complete on game events.
export const MISSIONS = [
  {
    id: 'welcome',
    title: 'A Warm Welcome',
    blurb: 'The Gallery Guide at the info desk is waiting to greet you.',
    objectives: [{ id: 'talk-guide', text: 'Check in with the Gallery Guide', target: 'guide' }],
    reward: 2,
  },
  {
    id: 'minds',
    title: 'Meet the Minds',
    blurb: 'Two of history’s great minds walk these halls. Introduce yourself.',
    requires: ['welcome'],
    objectives: [
      { id: 'talk-gandhi', text: 'Speak with Mahatma Gandhi', target: 'gandhi' },
      { id: 'talk-einstein', text: 'Speak with Albert Einstein', target: 'einstein' },
    ],
    reward: 2,
  },
  {
    id: 'fragments',
    title: 'Fragments of Time',
    blurb: 'The museum’s timeline has shattered. Find the six glowing memory fragments.',
    requires: ['welcome'],
    objectives: [{ id: 'collect', text: 'Collect memory fragments', count: FRAGMENTS.length, target: 'fragment' }],
    reward: 3,
  },
  {
    id: 'quiz',
    title: 'Test of Knowledge',
    blurb: 'Prove what you have learned. Each mind has three questions for you.',
    requires: ['minds'],
    objectives: [
      { id: 'quiz-gandhi', text: 'Pass Gandhi’s quiz (2 of 3)', target: 'gandhi' },
      { id: 'quiz-einstein', text: 'Pass Einstein’s quiz (2 of 3)', target: 'einstein' },
    ],
    reward: 3,
  },
  {
    id: 'timeline',
    title: 'Restore the Timeline',
    blurb: 'Place every fragment on the Timeline Wall in the order history happened.',
    requires: ['fragments'],
    objectives: [{ id: 'restore', text: 'Restore the Timeline Wall', target: 'timeline' }],
    reward: 5,
  },
];

// Stars available: 28 before the Timeline Wall (with perfect quizzes) and 34
// in total, so "Curator of Time" can only be earned by finishing the story.
export const RANKS = [
  { stars: 0, title: 'Visitor' },
  { stars: 6, title: 'Explorer' },
  { stars: 14, title: 'Historian' },
  { stars: 22, title: 'Scholar' },
  { stars: 30, title: 'Curator of Time' },
];

// Text conversations. `{name}` is replaced with the player's name.
// Options: `next` jumps to a node, `action` triggers a game action.
export const DIALOGUE = {
  guide: {
    start: {
      text: 'Welcome to the Grand Museum, {name}! I’m the Gallery Guide. I’m afraid you’ve arrived on an unusual day — our Timeline Wall has shattered, and its memories are scattered all over the grounds.',
      options: [
        { label: 'What can I do to help?', next: 'help' },
        { label: 'Tell me about this museum.', next: 'museum' },
        { label: 'Who can I meet here?', next: 'people' },
        { label: 'Goodbye.', action: 'close' },
      ],
    },
    help: {
      text: 'Look for six glowing memory fragments — two are out here in the gardens, the rest are inside the hall. Each one holds a real moment from history. Once you have them all, restore them in the right order on the Timeline Wall at the back of the hall.',
      options: [
        { label: 'How will I find them?', next: 'find' },
        { label: 'Who can I meet here?', next: 'people' },
        { label: 'I’m on it!', action: 'close' },
      ],
    },
    find: {
      text: 'Follow the golden beam of light and the marker on your compass — they always point to your next objective. Press J any time to open your Museum Journal, and P if you’d like a souvenir photo.',
      options: [{ label: 'Thank you!', action: 'close' }],
    },
    museum: {
      text: 'This hall celebrates people whose ideas changed the world. Walk up to any of our guests and press E to talk to them. They love questions — and they will quiz you, too.',
      options: [
        { label: 'What can I do to help?', next: 'help' },
        { label: 'Goodbye.', action: 'close' },
      ],
    },
    people: {
      text: 'Inside you’ll find Mahatma Gandhi, who led India’s nonviolent struggle for independence, and Albert Einstein, whose theories reshaped physics. They’re usually wandering near the centre of the hall.',
      options: [
        { label: 'What can I do to help?', next: 'help' },
        { label: 'Goodbye.', action: 'close' },
      ],
    },
  },
  gandhi: {
    start: {
      text: 'Namaste, {name}. It is good of you to visit. Ask me anything you wish — truth has nothing to hide.',
      options: [
        { label: 'Tell me about the Salt March.', next: 'salt' },
        { label: 'What is satyagraha?', next: 'satyagraha' },
        { label: 'Why the spinning wheel?', next: 'charkha' },
        { label: 'What happened in South Africa?', next: 'africa' },
        { label: 'Quiz me!', action: 'quiz' },
        { label: 'Goodbye.', action: 'close' },
      ],
    },
    salt: {
      text: 'In 1930 the British taxed salt — something even the poorest family needs. So on 12 March we began walking from Sabarmati Ashram to the sea at Dandi, about 240 miles. On 6 April I picked up a little salt from the shore. Such a small act, yet millions joined in breaking an unjust law.',
      options: [
        { label: 'What is satyagraha?', next: 'satyagraha' },
        { label: 'Back to other questions.', next: 'start' },
      ],
    },
    satyagraha: {
      text: 'Satyagraha means, roughly, “truth-force” — holding firmly to truth. It is resistance without violence: we refuse to obey injustice, and we accept the consequences without hatred for our opponent.',
      options: [
        { label: 'Where did the idea begin?', next: 'africa' },
        { label: 'Back to other questions.', next: 'start' },
      ],
    },
    charkha: {
      text: 'The charkha, the spinning wheel, stood for self-reliance. If Indians spun their own khadi cloth instead of buying foreign mill cloth, we would support our villages and loosen the hold of the empire on our daily lives.',
      options: [{ label: 'Back to other questions.', next: 'start' }],
    },
    africa: {
      text: 'I went to South Africa in 1893 as a young lawyer and stayed about twenty-one years. Soon after I arrived I was thrown off a train at Pietermaritzburg for sitting in a first-class carriage. That cold night I decided to stand against such injustice. It was there that satyagraha was born.',
      options: [
        { label: 'Tell me about the Salt March.', next: 'salt' },
        { label: 'Back to other questions.', next: 'start' },
      ],
    },
  },
  einstein: {
    start: {
      text: 'Ah, {name}! Welcome, welcome. Curiosity brought you here, I hope — it is the most important thing we have. What shall we talk about?',
      options: [
        { label: 'What happened in 1905?', next: 'miracle' },
        { label: 'What does E = mc² mean?', next: 'emc2' },
        { label: 'What was your Nobel Prize for?', next: 'nobel' },
        { label: 'You worked at a patent office?', next: 'patent' },
        { label: 'Quiz me!', action: 'quiz' },
        { label: 'Goodbye.', action: 'close' },
      ],
    },
    miracle: {
      text: '1905 — people call it my “miracle year”. I published four papers: one on the photoelectric effect, one on Brownian motion, one on special relativity, and a short one showing that mass and energy are two forms of the same thing.',
      options: [
        { label: 'What does E = mc² mean?', next: 'emc2' },
        { label: 'Back to other questions.', next: 'start' },
      ],
    },
    emc2: {
      text: 'Energy equals mass times the speed of light squared. The speed of light is enormous, so even a tiny amount of mass holds a tremendous amount of energy. It is why the Sun can shine for billions of years.',
      options: [{ label: 'Back to other questions.', next: 'start' }],
    },
    nobel: {
      text: 'Everyone expects me to say relativity! But the 1921 Nobel Prize in Physics was mainly for explaining the photoelectric effect — how light knocks electrons out of metal, as if light came in little packets.',
      options: [{ label: 'Back to other questions.', next: 'start' }],
    },
    patent: {
      text: 'Yes! From 1902 I examined patent applications in Bern. It was a wonderful job for a young physicist: I checked inventions by day and let my thoughts wander in between. Many ideas of my miracle year were born at that desk.',
      options: [
        { label: 'What happened in 1905?', next: 'miracle' },
        { label: 'Back to other questions.', next: 'start' },
      ],
    },
  },
};

// Extra line a character says when the player already carries one of
// "their" fragments — a small reward for exploring.
export const FRAGMENT_REMARKS = {
  gandhi: 'I see you carry a memory from my life. Treasure it — small things can carry great truths.',
  einstein: 'Is that one of my memories you are carrying? Wonderful! Physics and history are both about following the clues.',
};

export const QUIZZES = {
  gandhi: [
    {
      q: 'In which year did the Salt March take place?',
      options: ['1920', '1930', '1942', '1947'],
      answer: 1,
      explain: 'The Salt March ran from 12 March to 6 April 1930.',
    },
    {
      q: 'What does “satyagraha” roughly mean?',
      options: ['Holy war', 'Self-rule', 'Truth-force', 'Salt tax'],
      answer: 2,
      explain: 'Satyagraha means holding firmly to truth — nonviolent resistance.',
    },
    {
      q: 'Where did Gandhi live for about 21 years before returning to India?',
      options: ['England', 'South Africa', 'Burma', 'Kenya'],
      answer: 1,
      explain: 'He lived in South Africa from 1893 to 1914.',
    },
  ],
  einstein: [
    {
      q: 'Einstein’s “miracle year” of four groundbreaking papers was…',
      options: ['1895', '1905', '1915', '1921'],
      answer: 1,
      explain: 'In 1905 he published four papers that changed physics.',
    },
    {
      q: 'His Nobel Prize in Physics was mainly awarded for…',
      options: ['The theory of relativity', 'The photoelectric effect', 'Black holes', 'Quantum computing'],
      answer: 1,
      explain: 'The 1921 prize cited his discovery of the law of the photoelectric effect.',
    },
    {
      q: 'Before becoming a professor, Einstein worked at…',
      options: ['A bank in Zurich', 'A watch factory', 'A patent office in Bern', 'A railway station'],
      answer: 2,
      explain: 'He was a technical expert at the Swiss Patent Office from 1902.',
    },
  ],
};

// Readable plaques placed around the hall. Position is [x, z].
export const PLAQUES = [
  {
    id: 'plaque-gandhi',
    title: 'Mahatma Gandhi (1869–1948)',
    position: [8, -12.6],
    text: 'Born in Porbandar, India, on 2 October 1869. Trained as a lawyer in London, he developed nonviolent resistance — satyagraha — in South Africa and later led India’s struggle for independence. His birthday is marked as the International Day of Non-Violence.',
  },
  {
    id: 'plaque-einstein',
    title: 'Albert Einstein (1879–1955)',
    position: [-8, -12.6],
    text: 'Born in Ulm, Germany, on 14 March 1879. His special (1905) and general (1915) theories of relativity transformed our understanding of space, time and gravity. He moved to the United States in 1933 and worked at the Institute for Advanced Study in Princeton.',
  },
];
