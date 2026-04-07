/**
 * Configurable GSAP timeline for scroll-driven card-stack animations.
 * Uses crossfade overlap: outgoing card exits while incoming card enters,
 * so every pixel of scroll produces visual movement (no dead zones).
 */

export interface CardStackOptions {
  enterStyle?: 'fade-up' | 'slide-left' | 'slide-right' | 'scale-fade' | 'slide-up';
  exitStyle?: 'fade-out-up' | 'fade-out-left' | 'scale-down' | 'fade-out';
  enterEase?: string;
  exitEase?: string;
  /** How long the card stays fully visible before crossfade begins (default 0.6) */
  holdDuration?: number;
  /** Duration of the crossfade transition zone (default 1) */
  crossfadeDuration?: number;
  manageActiveClass?: boolean;
  onCardEnter?: (card: HTMLElement, index: number) => void;
  onCardExit?: (card: HTMLElement, index: number) => void;
}

const ENTER_FROM: Record<string, Record<string, number>> = {
  'fade-up':    { opacity: 0, y: 60, x: 0, scale: 0.98 },
  'slide-left': { opacity: 0, y: 0, x: 80, scale: 1 },
  'slide-right':{ opacity: 0, y: 0, x: -80, scale: 1 },
  'scale-fade': { opacity: 0, y: 0, x: 0, scale: 0.88 },
  'slide-up':   { opacity: 0, y: 50, x: 0, scale: 0.96 },
};

const EXIT_TO: Record<string, Record<string, number>> = {
  'fade-out-up':  { opacity: 0, y: -40, x: 0, scale: 0.95 },
  'fade-out-left':{ opacity: 0, y: 0, x: -60, scale: 1 },
  'scale-down':   { opacity: 0, y: 0, x: 0, scale: 0.85 },
  'fade-out':     { opacity: 0, y: 0, x: 0, scale: 1 },
};

const REST = { opacity: 1, y: 0, x: 0, scale: 1 };

export function buildCardStackTimeline(
  gsap: any,
  cards: HTMLElement[],
  options: CardStackOptions = {},
) {
  const {
    enterStyle = 'fade-up',
    exitStyle = 'fade-out-up',
    enterEase = 'power2.out',
    exitEase = 'power1.in',
    holdDuration = 0.6,
    crossfadeDuration = 1,
    manageActiveClass = true,
    onCardEnter,
    onCardExit,
  } = options;

  const enterFrom = ENTER_FROM[enterStyle] || ENTER_FROM['fade-up'];
  const exitTo = EXIT_TO[exitStyle] || EXIT_TO['fade-out-up'];

  const tl = gsap.timeline();

  // Total duration per card = holdDuration + crossfadeDuration
  // The crossfade zone is where exit of card[i] overlaps with enter of card[i+1]
  const segmentDuration = holdDuration + crossfadeDuration;

  cards.forEach((card, i) => {
    const isFirst = i === 0;
    const isLast = i === cards.length - 1;
    const segmentStart = i * segmentDuration;

    if (isFirst) {
      // First card: starts visible
      gsap.set(card, { ...REST });
      if (manageActiveClass) card.classList.add('is-active');
      if (onCardEnter) onCardEnter(card, i);
    } else {
      // Enter: starts at the crossfade zone of the previous segment
      // Overlap = previous card's exit starts at (segmentStart - crossfadeDuration)
      // This card's enter also starts there, creating simultaneous movement
      const enterStart = segmentStart - crossfadeDuration * 0.4; // 40% overlap with exit
      tl.fromTo(card, { ...enterFrom }, {
        ...REST,
        duration: crossfadeDuration,
        ease: enterEase,
        onStart: () => {
          if (manageActiveClass) card.classList.add('is-active');
          if (onCardEnter) onCardEnter(card, i);
        },
      }, enterStart);
    }

    // Exit: starts after the hold period
    if (!isLast) {
      const exitStart = segmentStart + holdDuration;
      tl.fromTo(card, { ...REST }, {
        ...exitTo,
        duration: crossfadeDuration,
        ease: exitEase,
        onComplete: () => {
          if (manageActiveClass) card.classList.remove('is-active');
          if (onCardExit) onCardExit(card, i);
        },
      }, exitStart);
    }
  });

  return tl;
}
