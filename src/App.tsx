import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AudioProvider } from './audio/AudioContextProvider';
import { AppShell } from './components/AppShell';
import { routeVariants } from './ui/motion';
import { PitchListPage } from './pages/PitchListPage';
import { GroupsPage } from './pages/GroupsPage';
import { InstrumentProfilePage, ScaleInstrumentProfilePage } from './pages/InstrumentProfilePage';
import { BarDetailPage } from './pages/BarDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AboutPage } from './pages/AboutPage';
import { initTheme } from './ui/theme';

export function App() {
  const location = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <AudioProvider>
      <AnimatePresence mode="wait">
        <motion.div key={location.pathname} variants={routeVariants(Boolean(reduced))} initial="initial" animate="animate" exit="exit">
          <Routes location={location}>
            <Route element={<AppShell />}>
              <Route path="/" element={<PitchListPage />} />
              <Route path="/scale/:scaleId" element={<ScaleInstrumentProfilePage />} />
              <Route path="/instrument/:instrumentId" element={<InstrumentProfilePage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/bar/:barId" element={<BarDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/scale" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AudioProvider>
  );
}
