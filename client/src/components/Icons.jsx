const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
const Svg = ({ size = 24, strokeWidth, children }) => (
  <svg {...base} width={size} height={size} strokeWidth={strokeWidth || base.strokeWidth}>{children}</svg>
);

const service = {
  'ac-repair': (<><rect x="3" y="4" width="18" height="7" rx="2" /><path d="M6.5 8h11" /><path d="M8 14.5c0 1.4-1 1.6-1 3M12 14.5c0 1.4-1 1.6-1 3M16 14.5c0 1.4-1 1.6-1 3" /></>),
  'car-wash': (<><path d="M4 16.5V13l1.8-4.2A2 2 0 0 1 7.6 7.5h8.8a2 2 0 0 1 1.8 1.3L20 13v3.5" /><path d="M3 13h18v3.5H3z" /><circle cx="7.5" cy="16.5" r="1.6" /><circle cx="16.5" cy="16.5" r="1.6" /><path d="M8 3.5v1M12 2.5v2M16 3.5v1" /></>),
  'home-cleaning': (<><path d="M11 3l1.7 4.6L17.5 9.3l-4.8 1.7L11 15.6 9.3 11 4.5 9.3l4.8-1.7z" /><path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>),
  'water-purifier': <path d="M12 3c3.5 4.3 6 7.3 6 10.5a6 6 0 0 1-12 0C6 10.3 8.5 7.3 12 3z" />,
  'pest-control': (<><ellipse cx="12" cy="14" rx="4" ry="5.5" /><path d="M9.5 8.5C9.5 6.8 10.6 5.5 12 5.5s2.5 1.3 2.5 3M12 9v10.5" /><path d="M8 12l-3.5-1.5M8 15.5l-3.5.5M8.5 18.5L5.5 21M16 12l3.5-1.5M16 15.5l3.5.5M15.5 18.5l3 2.5" /></>),
  'sofa-cleaning': (<><path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11" /><path d="M3 13a2 2 0 0 1 4 0v1.5h10V13a2 2 0 0 1 4 0v4.5H3z" /><path d="M6 17.5V20M18 17.5V20" /></>),
};

export function ServiceIcon({ slug, size = 24 }) {
  return <Svg size={size}>{service[slug] || service['home-cleaning']}</Svg>;
}

const icon = (children) => ({ size = 20 }) => <Svg size={size}>{children}</Svg>;
export const SearchIcon = icon(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>);
export const PinIcon = icon(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>);
export const MenuIcon = icon(<path d="M4 7h16M4 12h16M4 17h16" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const MinusIcon = icon(<path d="M5 12h14" />);
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
export const CalendarIcon = icon(<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const UsersIcon = icon(<><circle cx="9" cy="8.5" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.5a3 3 0 0 1 0 6M18 14.8c1.8.7 3 2.4 3 5.2" /></>);
export const ReceiptIcon = icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>);
export const TagIcon = icon(<><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></>);
export const HomeIcon = icon(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>);
export const ShareIcon = icon(<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>);
export const ChevronRightIcon = icon(<path d="M9 5l7 7-7 7" />);
export const AlertIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16v.1" /></>);
export const ClockIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
