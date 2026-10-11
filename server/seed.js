import bcrypt from 'bcryptjs';
import { db, createSchema, DATA_VERSION } from './db.js';
import { nextWeekday } from './dates.js';
import { UP_SOCIETIES } from './data/up-societies.js';

const DROP_ALL = `
  DROP TABLE IF EXISTS provider_notifications; DROP TABLE IF EXISTS password_resets;
  DROP TABLE IF EXISTS notification_log;       DROP TABLE IF EXISTS notify_sent;
  DROP TABLE IF EXISTS provider_job_events; DROP TABLE IF EXISTS provider_assignments;
  DROP TABLE IF EXISTS provider_areas;      DROP TABLE IF EXISTS provider_services;
  DROP TABLE IF EXISTS providers;           DROP TABLE IF EXISTS admins;
  DROP TABLE IF EXISTS payments;    DROP TABLE IF EXISTS comments;
  DROP TABLE IF EXISTS memberships; DROP TABLE IF EXISTS groups;
  DROP TABLE IF EXISTS services;    DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS societies;
`;

export const SERVICES = [
  ['ac-repair', 'AC repair & service', 'Jet-wash servicing, gas check and minor repairs at your door.', 'AC',
    'CoolCare Technicians', 1499, ['Indoor + outdoor jet wash', 'Gas pressure check', 'Filter and coil cleaning', '30-day service warranty']],
  ['car-wash', 'Car wash', 'Foam wash and interior vacuum, done in your parking bay.', 'car',
    'ShineLane Auto Care', 499, ['Foam exterior wash', 'Interior vacuum', 'Tyre and dashboard polish', 'Water-saving wash']],
  ['home-cleaning', 'Deep home cleaning', 'Kitchen, bathrooms, floors and balconies scrubbed top to bottom.', 'flat',
    'SparkNest Home Services', 3499, ['Kitchen degreasing', 'Bathroom descaling', 'Floor scrubbing', 'Window and balcony wipe']],
  ['water-purifier', 'Water purifier service', 'Filter change and sanitisation for RO and UV purifiers.', 'purifier',
    'PureFlow Care', 799, ['Filter and membrane check', 'Tank sanitisation', 'TDS test', '60-day service warranty']],
  ['pest-control', 'Pest control', 'Odourless gel and spray treatment for cockroaches, ants and more.', 'flat',
    'SafeNest Pest Solutions', 1999, ['Kitchen and bathroom gel treatment', 'Spray for skirting and balcony', 'Safe for kids and pets', '90-day service warranty']],
  ['sofa-cleaning', 'Sofa & carpet cleaning', 'Dry-vacuum and shampoo cleaning for sofas, carpets and mattresses.', 'sofa set',
    'FreshFibre Cleaners', 1299, ['Dry vacuum', 'Shampoo extraction', 'Stain treatment', 'Dries in 3-4 hours']],
];

function insertSocieties() {
  const add = db.prepare('INSERT OR IGNORE INTO societies (name, area, city, state, flats) VALUES (?,?,?,?,?)');
  for (const [name, area, city, flats] of UP_SOCIETIES) add.run(name, area, city, 'Uttar Pradesh', flats);
}

export function seedIfEmpty({ reset = false } = {}) {
  const version = db.pragma('user_version', { simple: true });
  const hasData = db.prepare('SELECT COUNT(*) n FROM services').get().n > 0;

  // Databases made before the Uttar Pradesh release hold demo-only societies: rebuild them once.
  if (reset || (hasData && version < DATA_VERSION)) {
    db.pragma('foreign_keys = OFF');
    db.exec(DROP_ALL);
    db.pragma('foreign_keys = ON');
    createSchema();
  } else if (hasData) {
    return false;
  }

  const tx = db.transaction(() => {
    insertSocieties();
    const sid = (name, city) => db.prepare('SELECT id FROM societies WHERE name = ? AND city = ?').get(name, city).id;
    const home = sid('Supertech Capetown', 'Noida');
    const lko = sid('Omaxe City', 'Lucknow');
    const gzb = sid('Shipra Suncity', 'Ghaziabad');
    const gnw = sid('Gaur City 1', 'Greater Noida West');

    const addService = db.prepare(
      'INSERT INTO services (slug, name, tagline, unit_label, partner, regular_price, includes) VALUES (?,?,?,?,?,?,?)'
    );
    const svc = {};
    for (const s of SERVICES) svc[s[0]] = { id: addService.run(s[0], s[1], s[2], s[3], s[4], s[5], JSON.stringify(s[6])).lastInsertRowid };

    // ---- a demo login plus neighbours ------------------------------------
    const addUser = db.prepare('INSERT INTO users (name, email, password_hash, phone, society_id, flat) VALUES (?,?,?,?,?,?)');
    const hash = bcrypt.hashSync('demo1234', 10);
    addUser.run('Amit Verma', 'demo@saath.in', hash, '9876500001', home, 'B-402');
    const first = ['Priya', 'Rahul', 'Sneha', 'Vikram', 'Anita', 'Rohan', 'Meera', 'Karan', 'Divya', 'Arjun',
      'Neha', 'Sanjay', 'Pooja', 'Imran', 'Kavita', 'Suresh', 'Isha', 'Nikhil', 'Farah', 'Manoj',
      'Ritu', 'Deepak', 'Swati', 'Harsh', 'Lata', 'Varun', 'Tanvi', 'Girish', 'Asha', 'Yash'];
    const last = ['Sharma', 'Gupta', 'Yadav', 'Mehta', 'Mishra', 'Tiwari', 'Singh', 'Joshi', 'Khan', 'Agarwal'];
    const neighbours = first.map((f, i) => {
      const flat = `${'ABC'[i % 3]}-${(1 + (i % 8)) * 100 + 1 + (i % 7)}`;
      return addUser.run(`${f} ${last[i % last.length]}`, `${f.toLowerCase()}${i}@example.com`, hash, null, home, flat).lastInsertRowid;
    });
    const others = [lko, gzb, gnw].map((s, i) =>
      addUser.run(`${first[i]} ${last[i + 3]}`, `host${i}@example.com`, hash, null, s, `A-10${i + 1}`).lastInsertRowid);

    // ---- groups ------------------------------------------------------------
    const addGroup = db.prepare(
      `INSERT INTO groups (society_id, service_id, description, scheduled_date, time_slot, target, group_price, created_by)
       VALUES (?,?,?,?,?,?,?,?)`);
    const join = db.prepare('INSERT INTO memberships (group_id, user_id, units) VALUES (?,?,?)');
    const comment = db.prepare('INSERT INTO comments (group_id, user_id, body) VALUES (?,?,?)');

    const g1 = addGroup.run(home, svc['ac-repair'].id, 'Please keep the AC switched off and the indoor unit accessible.',
      nextWeekday(0, 2), '9-12', 20, 999, neighbours[0]).lastInsertRowid;
    neighbours.slice(0, 13).forEach((u, i) => join.run(g1, u, 1 + (i % 3 === 0 ? 1 : 0)));
    comment.run(g1, neighbours[0], 'Booked the technician for Sunday morning. 7 more flats and we unlock the price.');
    comment.run(g1, neighbours[4], 'I have two ACs, so I added both. Please share this in the block C group.');

    const g2 = addGroup.run(home, svc['car-wash'].id, 'Wash happens in the basement parking. Leave your car unlocked with the key at the gate.',
      nextWeekday(6, 1), '9-12', 25, 299, neighbours[7]).lastInsertRowid;
    neighbours.slice(5, 30).forEach((u) => join.run(g2, u, 1));
    comment.run(g2, neighbours[9], 'Done this last month. Good job, the interiors came out clean.');

    const g3 = addGroup.run(home, svc['water-purifier'].id, 'One visit covers all purifier brands. Filters are billed separately only if they need replacing.',
      nextWeekday(3, 4), '12-3', 15, 499, neighbours[2]).lastInsertRowid;
    neighbours.slice(10, 14).forEach((u) => join.run(g3, u, 1));

    const g4 = addGroup.run(home, svc['pest-control'].id, 'Treatment is odourless and you can be back in the flat within 2 hours.',
      nextWeekday(1, 6), '3-6', 12, 1299, neighbours[12]).lastInsertRowid;
    neighbours.slice(14, 16).forEach((u) => join.run(g4, u, 1));

    const g5 = addGroup.run(home, svc['home-cleaning'].id, 'Four-person crew per flat, about 5 hours. Cleaning material is included.',
      nextWeekday(0, 9), '9-12', 10, 2499, neighbours[20]).lastInsertRowid;
    join.run(g5, neighbours[20], 1);

    const og = [
      addGroup.run(lko, svc['ac-repair'].id, 'Servicing for all split and window ACs this Saturday.', nextWeekday(6, 2), '9-12', 15, 949, others[0]).lastInsertRowid,
      addGroup.run(gzb, svc['car-wash'].id, 'Wash in the stilt parking, weekend mornings.', nextWeekday(0, 3), '6-9', 30, 279, others[1]).lastInsertRowid,
      addGroup.run(gnw, svc['sofa-cleaning'].id, 'Dry-vacuum and shampoo clean for sofas and carpets.', nextWeekday(0, 5), '12-3', 10, 899, others[2]).lastInsertRowid,
    ];
    others.forEach((u, i) => join.run(og[i], u, 1));
  });
  tx();
  db.pragma(`user_version = ${DATA_VERSION}`);
  return true;
}

// `node seed.js --reset` wipes and reseeds
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const reset = process.argv.includes('--reset');
  console.log(seedIfEmpty({ reset }) ? 'Database seeded.' : 'Database already has data (use --reset to wipe).');
}
