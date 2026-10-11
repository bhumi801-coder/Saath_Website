// <option> list of societies, grouped by city (use inside a <select>).
export default function SocietyOptions({ societies, withArea = false }) {
  const byCity = new Map();
  societies.forEach((s) => {
    if (!byCity.has(s.city)) byCity.set(s.city, []);
    byCity.get(s.city).push(s);
  });
  return [...byCity.entries()].map(([city, list]) => (
    <optgroup key={city} label={`${city} (${list.length})`}>
      {list.map((s) => <option key={s.id} value={s.id}>{s.name}{withArea ? `, ${s.area}` : ''}</option>)}
    </optgroup>
  ));
}
