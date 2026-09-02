import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LumiDataProvider } from './hooks/useLumiData.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Onboarding } from './pages/Onboarding.jsx';
import { NightCheckIn } from './pages/NightCheckIn.jsx';
import { MorningCheckIn } from './pages/MorningCheckIn.jsx';
import { Insights } from './pages/Insights.jsx';
import { History } from './pages/History.jsx';
import { EntryDetail } from './pages/EntryDetail.jsx';
import { YourData } from './pages/YourData.jsx';
import { About } from './pages/About.jsx';
import { NotFound } from './pages/NotFound.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <LumiDataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              {/* Check-in routes take no date parameter - the target night is
                  always derived, so there is no way to backfill a past night. */}
              <Route path="checkin/night" element={<NightCheckIn />} />
              <Route path="checkin/morning" element={<MorningCheckIn />} />
              <Route path="insights" element={<Insights />} />
              <Route path="history" element={<History />} />
              <Route path="history/:nightOf" element={<EntryDetail />} />
              <Route path="data" element={<YourData />} />
              <Route path="about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LumiDataProvider>
    </ThemeProvider>
  );
}
