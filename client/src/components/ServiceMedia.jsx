import { servicePhotos } from '../assets.js';
import { ServiceIcon } from './Icons.jsx';

// A real photo when one has been added to src/assets/services/, otherwise an icon tile.
export default function ServiceMedia({ service, iconSize = 44, className = '', eager = false }) {
  const photo = servicePhotos[service.slug];
  if (photo) {
    return (
      <div className={`media ${className}`}>
        <img src={photo} alt={`${service.name}`} width="640" height="400" loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </div>
    );
  }
  return (
    <div className={`media media-icon tone-${service.slug} ${className}`} role="img" aria-label={`${service.name} icon`}>
      <ServiceIcon slug={service.slug} size={iconSize} />
    </div>
  );
}
