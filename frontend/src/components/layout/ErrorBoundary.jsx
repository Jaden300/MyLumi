/* Catches a render crash so one broken page doesn't blank the whole app.

   Without this, a throw anywhere renders white. That is a bad outcome in any app
   and a worse one here: both useLumiData and useTheme throw by design when used
   outside their provider, and the user's reasonable conclusion from a blank
   screen is "my data is gone".

   So the fallback's first job is to say the opposite, and say it truthfully:
   entries live in localStorage and are untouched by a render error. The second
   job is to offer a way out that does not risk the data - reloading is safe,
   and we do not offer a "reset" button that would clear storage.

   A class component because React has no hook equivalent for error boundaries.

   Deliberately does NOT report the error anywhere. There is no error-reporting
   service in this app and adding one would break the "nothing about your use of
   the app is sent anywhere" claim on the Your Data page. The message goes to the
   console, which is where a developer can find it and nobody else can. */

import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Console only - never sent anywhere. See the header comment.
    console.error('MyLumi render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="card" role="alert">
        <h2 className="card__title">Something went wrong on this screen</h2>
        <div className="stack text-sm">
          <p>
            <strong>Your check-ins are safe.</strong> They're stored in this browser and nothing
            here has changed them.
          </p>
          <p className="text-muted">
            Reloading usually fixes it. If it keeps happening, you can export your data from the
            Your data page and it will still be complete.
          </p>
          <div>
            <button type="button" className="btn btn--secondary" onClick={() => window.location.reload()}>
              Reload MyLumi
            </button>
          </div>
        </div>
      </section>
    );
  }
}
