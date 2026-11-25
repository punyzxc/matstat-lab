/**
 * Every interface string of the story lectures in one place, so the language toggle can swap them.
 * Text with `$…$` is typeset.
 */
export const STORY_TEXT = {
  editHint: 'Press Enter or type a number to change it; arrow keys step it.',
  editShort: 'click or type to change',
  demo: 'Demo',
  explore: 'Explore',
  demoHint: 'Each step sets the experiment up for you.',
  exploreHint: 'Your values stay as you read on. Type any of them.',
  whatIf: 'What if…',
  layers: { intuition: 'Intuition', definition: 'Definition', formula: 'Formula', details: 'Details & proof' },
  openStation: 'Open the full station',
  noStation: 'This source has no full station yet',
  pause: 'Pause',
  play: 'Play',
  restart: 'Restart',
  step: 'Step',
  keys: 'scroll or ← → · Space pause · E explore',
  figureLabel: 'Live figure',
  reset: 'Back to the step’s values',
  scientists: 'In history',
} as const;
