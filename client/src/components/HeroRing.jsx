import { useEffect, useRef, useState } from 'react';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}

// Weak devices keep the lightweight CSS ring instead of loading three.js.
function lowPowerDevice() {
  const n = navigator;
  return (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2) || n.connection?.saveData === true;
}

// The CSS ring is both the instant placeholder and the fallback when WebGL is unavailable.
function CssRing() {
  return (
    <div className="ring-fallback">
      <div className="rf-ribbon" />
      <div className="rf-float"><div className="rf-ring" /></div>
    </div>
  );
}

export default function HeroRing() {
  const host = useRef(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || lowPowerDevice() || !webglAvailable()) return undefined;
    let cancelled = false;
    let dispose;
    import('../three/ringScene.js')
      .then(({ createRingScene }) => {
        if (cancelled) return;
        try {
          dispose = createRingScene(el, { onReady: () => setLive(true), onFail: () => setLive(false) });
        } catch {
          setLive(false);
        }
      })
      .catch(() => setLive(false));
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return (
    <div ref={host} className={`hero-ring${live ? ' is-live' : ''}`} aria-hidden="true">
      <CssRing />
    </div>
  );
}
