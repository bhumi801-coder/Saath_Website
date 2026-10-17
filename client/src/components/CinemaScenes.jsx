import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from './Icons.jsx';
import { PartDefs, Pieces } from './parts.jsx';
import { rupees } from '../format.js';

// Ingredients-style particles that burst outward and settle as a scene comes into focus.
const DOTS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.45;
  const r = 170 + ((i * 53) % 190);
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 0.72), s: 3 + ((i * 7) % 8), o: 0.22 + ((i * 13) % 6) / 12, gold: i % 4 === 0 };
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// One full-screen scene per service. Scroll moves the page through them; nothing here changes data or routes.
// A scene picture is `<slug>-scene.(png|webp|jpg)` if present, otherwise the service photo `<slug>.*`.
export default function CinemaScenes({ services, groupsFor }) {
  const wrap = useRef(null);
  const stage = useRef(null);
  const scenes = useRef([]);
  const n = services.length;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el || !n) return undefined;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    const update = () => {
      raf = 0;
      if (still.matches) return;
      const room = Math.max(1, el.offsetHeight - (stage.current?.offsetHeight || window.innerHeight));
      const p = clamp(-el.getBoundingClientRect().top / room, 0, 1);
      const q = p * (n - 1);
      scenes.current.forEach((sc, i) => {
        if (!sc) return;
        const d = q - i;
        const ad = Math.min(Math.abs(d), 1);
        const o = clamp(1 - (Math.abs(d) - 0.3) / 0.25, 0, 1);
        sc.style.setProperty('--o', o.toFixed(3));
        sc.style.setProperty('--to', clamp(1 - (Math.abs(d) - 0.08) / 0.2, 0, 1).toFixed(3));
        const e = clamp((Math.abs(d) - 0.08) / 0.47, 0, 1);
        sc.style.setProperty('--e', (e * e * (3 - 2 * e)).toFixed(3));
        sc.style.setProperty('--out', d > 0 ? '1' : '0');
        sc.style.setProperty('--in', d > 0 ? '0' : '1');
        sc.style.setProperty('--d', d.toFixed(3));
        sc.style.setProperty('--ad', ad.toFixed(3));
        sc.style.setProperty('--k', (1 - ad).toFixed(3));
        sc.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        sc.style.pointerEvents = o > 0.55 ? 'auto' : 'none';
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    still.addEventListener?.('change', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      still.removeEventListener?.('change', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);

  return (
    <div className="cin" ref={wrap} style={{ '--n': n }}>
      <PartDefs />
      <div className="cin-stage" ref={stage}>
        {services.map((s, i) => {
          const words = s.name.split(' ');
          const last = words.pop();
          const live = groupsFor(s.slug);
          const lowest = live.length ? Math.min(...live.map((g) => g.group_price)) : null;
          return (
            <section className="cin-scene" key={s.slug} ref={(node) => { scenes.current[i] = node; }} aria-label={s.name}>
              <div className="cin-glow" aria-hidden="true" />
              <div className="cin-dots" aria-hidden="true">
                {DOTS.map((d, k) => (
                  <i key={k} className={d.gold ? 'gold' : ''} style={{ '--dx': d.dx, '--dy': d.dy, width: d.s, height: d.s, opacity: d.o }} />
                ))}
              </div>
              <div className="cin-art" aria-hidden="true"><Pieces slug={s.slug} /></div>
              <div className="cin-copy">
                <p className="cin-eyebrow">
                  {lowest ? `Group price from ${rupees(lowest)}` : `Starting at ${rupees(s.regular_price)}`} per {s.unit_label}
                </p>
                <h3 className="cin-title">{words.join(' ')}{words.length ? ' ' : ''}<em>{last}</em></h3>
                <p className="cin-sub">{s.tagline}</p>
                <Link className="btn btn-ghost" to={`/services/${s.slug}`}>Book now <ArrowRightIcon size={16} /></Link>
              </div>
              <span className="cin-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            </section>
          );
        })}
      </div>
    </div>
  );
}
