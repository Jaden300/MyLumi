import { useEffect, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { DisclaimerFooter } from './DisclaimerFooter.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { Banner } from '../ui/Banner.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { RedFlagBanner } from '../RedFlagBanner.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { useLumiData } from '../../hooks/useLumiData.jsx';
import { pingHealth } from '../../lib/api.js';

export function AppShell() {
  const { storageAvailable, storageError, recovery, isDemoData } = useLumiData();
  const location = useLocation();
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  /* Start Render's cold start early. The free tier sleeps after ~15 minutes and
     takes ~50s to wake; kicking it here means the wake overlaps with the user
     reading the dashboard instead of blocking them later. Fire-and-forget -
     nothing waits on it and a failure is silent. */
  useEffect(() => {
    pingHealth();
  }, []);

  /* Move focus to <main> on navigation. React Router does not do this, so
     without it a keyboard or screen-reader user stays parked on the nav link
     they just activated and has no signal the page changed.

     Skipped on first render: focusing the page on initial load would steal focus
     from wherever the browser put it and announce the region for no reason. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="app-shell">
      {/* The natural use for the .sr-only class base.css already defines. With a
          persistent 4-item nav on every route, this saves a keyboard user four
          tab stops per page. */}
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="topbar">
        <Link to="/" className="topbar__brand">
          <Lumi size={28} />
          MyLumi
        </Link>
        <nav className="topbar__nav">
          <NavLink to="/" className="navlink" end>
            Today
          </NavLink>
          <NavLink to="/insights" className="navlink">
            Insights
          </NavLink>
          <NavLink to="/history" className="navlink">
            History
          </NavLink>
          <ThemeToggle />
        </nav>
      </header>

      <main className="app-main" id="main" ref={mainRef} tabIndex={-1}>
        {/* Above the storage notices deliberately. Those are about the app; this
            one is about the user, and it is the only banner here that could
            matter clinically. Rendered in the shell so it is visible from every
            screen, including mid-check-in. */}
        <RedFlagBanner />

        {/* Visible on every screen while demo data is loaded. A judge who cannot
            tell seeded data from their own is a worse outcome than a judge who
            has to click once to load it. */}
        {isDemoData && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Banner tone="info" title="You're looking at demo data">
              These entries were generated to show what MyLumi looks like in use. Clear them on{' '}
              <Link to="/data">Your data</Link>.
            </Banner>
          </div>
        )}

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

        {/* Keyed by route so a crash on one page does not leave the whole app
            stuck in the error state after navigating away. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <DisclaimerFooter />
    </div>
  );
}
