import { useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { DisclaimerFooter } from './DisclaimerFooter.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { Banner } from '../ui/Banner.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { useLumiData } from '../../hooks/useLumiData.jsx';
import { pingHealth } from '../../lib/api.js';

export function AppShell() {
  const { storageAvailable, storageError, recovery } = useLumiData();

  /* Start Render's cold start early. The free tier sleeps after ~15 minutes and
     takes ~50s to wake; kicking it here means the wake overlaps with the user
     reading the dashboard instead of blocking them later. Fire-and-forget —
     nothing waits on it and a failure is silent. */
  useEffect(() => {
    pingHealth();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          <Lumi size={28} />
          MyLumi
        </Link>
        <nav className="topbar__nav">
          <NavLink to="/" className="navlink" end>
            Today
          </NavLink>
          <NavLink to="/history" className="navlink">
            History
          </NavLink>
          <ThemeToggle />
        </nav>
      </header>

      <main className="app-main">
        {!storageAvailable && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Banner tone="caution" title="Your browser isn't saving data">
              Entries will be lost when you close this tab. This usually happens in private browsing.
            </Banner>
          </div>
        )}

        {storageError === 'quota' && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Banner tone="alert" title="Storage is full" role="alert">
              Your last change may not have been saved. Try exporting and clearing old data.
            </Banner>
          </div>
        )}

        {recovery?.reason === 'corrupt' && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Banner tone="caution" title="We couldn't read your saved data">
              MyLumi started fresh. Your previous data was kept in your browser storage rather than
              deleted, in case it can be recovered.
            </Banner>
          </div>
        )}

        <Outlet />
      </main>

      <DisclaimerFooter />
    </div>
  );
}
