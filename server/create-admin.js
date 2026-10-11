// Create (or reset the password of) an administrator account.
//   npm run create-admin -- you@example.com 'a-long-password' "Your Name"
// Admins cannot sign up from the website; this is the only way to make one.
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const [emailArg, password, ...nameParts] = process.argv.slice(2);
const email = String(emailArg || '').trim().toLowerCase();
const name = nameParts.join(' ').trim() || 'Saath admin';

if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
  console.error("Usage: npm run create-admin -- <email> <password> [name]");
  process.exit(1);
}
if (password.length < 10) {
  console.error('Use a password of at least 10 characters.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
if (existing) {
  db.prepare('UPDATE admins SET password_hash = ?, name = ? WHERE id = ?').run(hash, name, existing.id);
  console.log(`Updated the password for admin ${email}.`);
} else {
  db.prepare('INSERT INTO admins (name, email, password_hash) VALUES (?,?,?)').run(name, email, hash);
  console.log(`Created admin ${email}. Log in at /admin/login.`);
}
