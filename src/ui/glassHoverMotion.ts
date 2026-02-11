export const glassHoverMotion = {
  whileHover: { y: -2, scale: 1.01 },
  whileTap: { y: 0, scale: 0.995 },
  transition: { type: 'spring', stiffness: 420, damping: 34 },
} as const;
