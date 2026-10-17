import { servicePhotos } from '../assets.js';

// Shared gradients for the vector pieces. Replace any piece with a real PNG by naming files:
//   <slug>-scene.png  -> the centre object      <slug>-p1.png ... <slug>-p6.png -> the flying pieces
export function PartDefs() {
  const g = (id, a, b) => <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>;
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {g('gw', '#FFFFFF', '#B9C3D8')}{g('gs', '#EEF1F7', '#74809A')}{g('gb', '#7DB2FF', '#1D4ED8')}{g('gt', '#9AEFF5', '#0891B2')}
        {g('gg', '#7BEBA9', '#15803D')}{g('go', '#FFBB78', '#C2410C')}{g('gy', '#FFE98A', '#D99A06')}{g('gr', '#FF9494', '#B91C1C')}{g('gk', '#454B5E', '#14161F')}
      </defs>
    </svg>
  );
}

const SPRAYER = (<>
  <rect x="62" y="78" width="76" height="106" rx="18" fill="url(#gg)" /><rect x="80" y="104" width="40" height="44" rx="6" fill="#ECFDF5" opacity=".9" />
  <rect x="86" y="50" width="28" height="32" rx="6" fill="url(#gs)" /><path d="M86 52L150 44L156 58L114 66Z" fill="url(#gk)" />
  <path d="M158 50l24-6M158 56l26 2M156 62l22 12" stroke="#BFF5D8" strokeWidth="3" strokeLinecap="round" fill="none" />
</>);

const PART = {
  ac: (<><rect x="8" y="52" width="184" height="78" rx="20" fill="url(#gw)" stroke="#9AA6BD" strokeWidth="2" /><rect x="24" y="64" width="152" height="8" rx="4" fill="#DDE3EF" /><rect x="22" y="96" width="156" height="20" rx="10" fill="#8E9BB5" /><rect x="30" y="102" width="140" height="5" rx="2.5" fill="#5C6A87" /><circle cx="170" cy="78" r="5" fill="#22C55E" /></>),
  car: (<><path d="M12 130L22 104Q28 90 44 88L80 86Q92 64 118 62L146 64Q162 68 170 88L186 100Q196 106 196 120L196 134L12 134Z" fill="url(#gb)" /><path d="M88 86Q98 70 118 70L142 71Q152 74 158 88Z" fill="#D5E9FF" opacity=".9" /><circle cx="56" cy="136" r="17" fill="url(#gk)" /><circle cx="56" cy="136" r="7" fill="url(#gs)" /><circle cx="152" cy="136" r="17" fill="url(#gk)" /><circle cx="152" cy="136" r="7" fill="url(#gs)" /></>),
  sofa: (<><rect x="26" y="52" width="148" height="56" rx="20" fill="url(#go)" /><rect x="8" y="84" width="40" height="62" rx="16" fill="url(#go)" /><rect x="152" y="84" width="40" height="62" rx="16" fill="url(#go)" /><rect x="30" y="98" width="140" height="44" rx="14" fill="#FF9A52" /><rect x="30" y="148" width="10" height="16" rx="3" fill="#5A2A12" /><rect x="160" y="148" width="10" height="16" rx="3" fill="#5A2A12" /></>),
  purifier: (<><rect x="46" y="14" width="108" height="168" rx="20" fill="url(#gw)" stroke="#9AA6BD" strokeWidth="2" /><rect x="60" y="30" width="80" height="46" rx="10" fill="url(#gt)" /><circle cx="70" cy="92" r="4" fill="#22C55E" /><circle cx="84" cy="92" r="4" fill="#38BDF8" /><rect x="90" y="108" width="20" height="30" rx="6" fill="#8E9BB5" /><rect x="72" y="146" width="56" height="14" rx="7" fill="#C9D3E6" /></>),
  sprayer: SPRAYER,
  bucket: (<><path d="M44 96L156 96L144 176Q142 184 134 184L66 184Q58 184 56 176Z" fill="url(#gb)" /><ellipse cx="100" cy="96" rx="56" ry="10" fill="#1D4ED8" /><rect x="96" y="6" width="8" height="96" rx="4" fill="#C79A5A" transform="rotate(14 100 56)" /><circle cx="70" cy="90" r="14" fill="#fff" opacity=".92" /><circle cx="96" cy="82" r="18" fill="#fff" opacity=".92" /><circle cx="126" cy="90" r="13" fill="#fff" opacity=".92" /></>),
  wrench: (<g transform="rotate(-38 100 100)"><rect x="91" y="56" width="18" height="124" rx="9" fill="url(#gs)" /><path fillRule="evenodd" d="M100 12a34 34 0 1 0 .01 0ZM89 12h22v32H89Z" fill="url(#gs)" /></g>),
  drop: <path d="M100 14C132 58 152 90 152 122a52 52 0 0 1-104 0C48 90 68 58 100 14Z" fill="url(#gt)" />,
  sparkle: <path d="M100 8L117 83L192 100L117 117L100 192L83 117L8 100L83 83Z" fill="url(#gw)" />,
  bubble: (<><circle cx="100" cy="100" r="82" fill="#BDE3FF" opacity=".18" stroke="#DFF1FF" strokeWidth="4" /><ellipse cx="72" cy="66" rx="17" ry="9" fill="#fff" opacity=".85" transform="rotate(-35 72 66)" /></>),
  snow: <g stroke="#C4E5FF" strokeWidth="9" strokeLinecap="round"><path d="M100 12V188M24 56L176 144M24 144L176 56" /></g>,
  sponge: (<><rect x="22" y="56" width="156" height="90" rx="22" fill="url(#gy)" /><circle cx="64" cy="88" r="7" fill="#B07A06" opacity=".5" /><circle cx="108" cy="112" r="9" fill="#B07A06" opacity=".5" /><circle cx="140" cy="84" r="6" fill="#B07A06" opacity=".5" /></>),
  shield: (<><path d="M100 12L178 40V96Q178 152 100 190Q22 152 22 96V40Z" fill="url(#gg)" /><path d="M62 98L92 128L140 72" stroke="#fff" strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>),
  bug: (<><path d="M70 90L22 70M68 116L16 120M72 142L26 174M130 90L178 70M132 116L184 120M128 142L174 174M92 38L80 12M108 38L120 12" stroke="#7F1D1D" strokeWidth="7" strokeLinecap="round" fill="none" /><ellipse cx="100" cy="112" rx="34" ry="52" fill="url(#gr)" /><circle cx="100" cy="56" r="20" fill="#7F1D1D" /></>),
  glass: (<><path d="M52 28H148L136 180H64Z" fill="#CFE9FF" opacity=".3" stroke="#E6F4FF" strokeWidth="5" /><path d="M58 84H142L136 180H64Z" fill="url(#gt)" /></>),
  filter: (<><rect x="56" y="18" width="88" height="166" rx="16" fill="url(#gt)" /><path d="M56 62H144M56 102H144M56 142H144" stroke="#067A92" strokeWidth="6" /><rect x="72" y="6" width="56" height="16" rx="6" fill="url(#gs)" /></>),
  cushion: (<><rect x="22" y="22" width="156" height="156" rx="36" fill="url(#go)" /><circle cx="100" cy="100" r="9" fill="#9A3412" /><path d="M40 40L70 70M160 40L130 70M40 160L70 130M160 160L130 130" stroke="#9A3412" strokeWidth="4" strokeLinecap="round" /></>),
  brush: (<><rect x="94" y="10" width="12" height="60" rx="6" fill="#C79A5A" /><rect x="28" y="64" width="144" height="46" rx="14" fill="url(#gb)" /><path d="M44 110v28M66 110v28M88 110v28M110 110v28M132 110v28M154 110v28" stroke="#DDEBFF" strokeWidth="6" strokeLinecap="round" /></>),
  toolbox: (<><rect x="14" y="70" width="172" height="106" rx="16" fill="url(#go)" /><path d="M66 70V50Q66 38 78 38H122Q134 38 134 50V70" stroke="#7C2D12" strokeWidth="10" fill="none" /><rect x="86" y="108" width="28" height="22" rx="5" fill="#FDE68A" /></>),
};

const SETS = {
  'ac-repair': ['ac', ['wrench', 'snow', 'toolbox', 'drop', 'sparkle', 'filter']],
  'car-wash': ['car', ['drop', 'sponge', 'bubble', 'bubble', 'sprayer', 'sparkle']],
  'home-cleaning': ['bucket', ['sprayer', 'sponge', 'bubble', 'sparkle', 'brush', 'drop']],
  'water-purifier': ['purifier', ['glass', 'drop', 'filter', 'drop', 'sparkle', 'bubble']],
  'pest-control': ['sprayer', ['shield', 'bug', 'sparkle', 'bubble', 'drop', 'bug']],
  'sofa-cleaning': ['sofa', ['cushion', 'brush', 'sponge', 'sprayer', 'bubble', 'sparkle']],
};

// x, y, size (in vmin-style units), rotation, scatter x, scatter y, scatter spin, zoom-past-camera
const SLOTS = [
  [-34, -20, 22, -18, -26, -16, -120, 1.5], [33, -24, 18, 14, 28, -18, 140, 1.4], [-40, 16, 20, 24, -30, 12, 150, 1.6],
  [36, 22, 24, -10, 30, 16, -130, 1.4], [-10, -34, 14, 8, -6, -26, 90, 1.8], [12, 32, 16, -26, 8, 26, -100, 1.7],
];

const Art = ({ name, photo }) => (photo
  ? <img src={photo} alt="" decoding="async" draggable="false" />
  : <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">{PART[name]}</svg>);

// The centre object and six pieces that fly apart and come back together as `--e` (0 = assembled, 1 = scattered) changes.
export function Pieces({ slug }) {
  const [hero, sats] = SETS[slug] || SETS['home-cleaning'];
  return (
    <>
      {sats.map((name, i) => {
        const [x, y, s, r, sx, sy, sr, z] = SLOTS[i];
        return (
          <div className="px" key={i} style={{ '--x': x, '--y': y, '--sz': s, '--r': r, '--sx': sx, '--sy': sy, '--sr': sr, '--z': z }}>
            <Art name={name} photo={servicePhotos[`${slug}-p${i + 1}`]} />
          </div>
        );
      })}
      <div className="px px-hero" style={{ '--x': 0, '--y': 0, '--sz': 54, '--r': 0, '--sx': 0, '--sy': -5, '--sr': -8, '--z': 0.9 }}>
        <Art name={hero} photo={servicePhotos[`${slug}-scene`]} />
      </div>
    </>
  );
}
