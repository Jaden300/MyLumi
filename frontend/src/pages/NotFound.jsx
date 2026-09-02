import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <Card>
      <div className="lumi-row">
        <Lumi size={56} state="lost" />
        <div className="stack stack--tight">
          <h1 className="h-size-h3">Page not found</h1>
          <p className="text-muted text-sm">That link doesn't lead anywhere.</p>
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-5)' }}>
        <Button block onClick={() => navigate('/')}>
          Back to today
        </Button>
      </div>
    </Card>
  );
}
