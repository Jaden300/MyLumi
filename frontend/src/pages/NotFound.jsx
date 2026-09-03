import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="hero">
      <div className="hero__art">
        <Lumi size={140} state="lost" />
      </div>
      <h1 className="hero__title">Page not found</h1>
      <p className="hero__lede">That link doesn't lead anywhere.</p>
      <div style={{ marginTop: 'var(--space-3)' }}>
        <Button onClick={() => navigate('/')}>Back to today</Button>
      </div>
    </div>
  );
}
