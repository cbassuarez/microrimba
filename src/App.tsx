import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AudioProvider } from './audio/AudioContextProvider';
import { AppShell } from './components/AppShell';
import { PitchListPage } from './pages/PitchListPage';
import { GroupsPage } from './pages/GroupsPage';
import { InstrumentProfilePage, ScaleInstrumentProfilePage } from './pages/InstrumentProfilePage';
import { BarDetailPage } from './pages/BarDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AboutPage } from './pages/AboutPage';
import { initTheme } from './ui/theme';

export function App() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <AudioProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<PitchListPage />} />
          <Route path="/scale/:scaleId" element={<ScaleInstrumentProfilePage />} />
          <Route path="/instrument/:instrumentId" element={<InstrumentProfilePage showModeChips={false} forcedMode="all" pagination="none" />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/bar/:barId" element={<BarDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/scale" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AudioProvider>
  );
}
