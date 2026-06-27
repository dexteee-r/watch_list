// Shared motion tokens — one source of truth so every animation feels coherent.
// (See motion-design skill: consistent easing/duration across the project.)

export const EASE_OUT = [0.16, 1, 0.3, 1]
export const SPRING = { type: 'spring', stiffness: 300, damping: 26 }

// Page-level cross-fade + small vertical shift.
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}
export const pageTransition = { duration: 0.25, ease: EASE_OUT }

// List/grid waterfall reveal.
export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}

export const riseItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING },
}

// Tactile feedback for buttons/cards.
export const tap = { scale: 0.97 }
