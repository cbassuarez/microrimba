import type { Variants } from 'framer-motion';

export const routeVariants = (reduced: boolean): Variants =>
  reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12, scale: 0.995 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
        exit: { opacity: 0, y: -8, scale: 0.998, transition: { duration: 0.18 } },
      };
