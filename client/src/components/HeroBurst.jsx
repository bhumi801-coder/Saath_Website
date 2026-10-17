import { PartDefs, Pieces } from './parts.jsx';

// Replaces the 3D ring: the same "pieces fly apart and come back together" effect, looping on its own.
export default function HeroBurst({ service }) {
  if (!service) return null;
  return (
    <div className="hero-burst" aria-hidden="true">
      <PartDefs />
      <div className="cin-scene"><div className="cin-glow" /><div className="cin-art"><Pieces slug={service.slug} /></div></div>
    </div>
  );
}
