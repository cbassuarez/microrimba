import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { routeVariants } from '../ui/motion';

export function AnimatedPageOutlet() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const routeKey = location.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={routeKey}
        variants={routeVariants(Boolean(reduced))}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Outlet />
      </motion.main>
    </AnimatePresence>
  );
}
