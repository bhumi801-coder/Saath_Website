// Photos are optional. Any file named after a service slug in src/assets/services/
// is picked up at build time; missing photos fall back to an icon tile.
const byName = (files) =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), url]));

export const servicePhotos = byName(
  import.meta.glob('./assets/services/*.{svg,jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' })
);
export const heroPhoto =
  byName(import.meta.glob('./assets/hero.{svg,jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' })).hero || null;
