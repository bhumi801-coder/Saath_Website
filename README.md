# Saath: home and car services, booked together

Residents of a housing society in Uttar Pradesh book services together (AC repair, car wash, sofa
cleaning, deep cleaning, water purifier service, pest control). When enough flats join a group,
everyone gets the group price.

| Layer    | Tech                                                  |
|----------|-------------------------------------------------------|
| Frontend | React 19, React Router, Vite                          |
| Backend  | Node.js 18+, Express (REST API, JWT login, bcrypt)    |
| Database | SQLite (`server/saath.db`, created and seeded on first run) |
| Payments | Razorpay (UPI, cards, netbanking) or pay after service |

## Run it

```bash
npm run setup     # installs server + client packages and builds the React app
npm start         # whole site at http://localhost:4000
```

Demo login: `demo@saath.in` / `demo1234`. `npm run seed` wipes and reseeds the database (never run it on data you want to keep).
Development with hot reload: `npm run dev`.

## What is in this version

- **Uttar Pradesh societies**: 140+ societies and colonies across Noida, Greater Noida (West), Ghaziabad,
  Lucknow, Kanpur, Agra, Varanasi, Prayagraj, Meerut, Bareilly, Aligarh, Gorakhpur, Mathura and more
  (`server/data/up-societies.js`). Sign-up has search, and any resident can add a missing society.
  Locations in tier-2 cities are locality-level resident colonies. Review names before launch.
- **Time slots**: every group has a date and an arrival window (6 AM to 8 PM in 5 slots), shown on group
  cards, booking pages and My bookings. Residents can also leave a note (parking bay, landmark).
- **Dates**: all dates are India time (IST) on the server and in the date picker, so "tomorrow" is never wrong
  at night. Dates must be within the next 60 days.
- **Payments**: join is free. Once a group unlocks, members can pay online or pay the partner after service.
  The amount is always computed on the server. Signatures are verified, and a webhook confirms payments
  even if the customer closes the tab. A cancelled group marks paid members as "refund due".
- **Images**: sharp vector (SVG) illustrations for all six services and the hero, so nothing is blurry on any
  screen. Replace any of them with real photos by dropping `ac-repair.jpg`, etc. in
  `client/src/assets/services/` (delete the matching `.svg`).
- **Alerts to service partners** (popup on the website + WhatsApp + SMS) when a group unlocks, and a **forgot
  password** flow for residents and partners. See "Notifications" and "Forgot password" below.
- **Policies page** at `/policies` (terms, privacy, refunds). It is a starting draft: get it reviewed.

## Service partners (providers)

A group reaching its flat count only **unlocks the price**. The service is confirmed when a real service
partner accepts it, and finished when that partner marks it completed. These are three separate facts and
the customer sees each one on My bookings and on the group page.

```
group forms -> flat count reached (unlocked) -> eligible partner accepts -> service date confirmed -> partner marks completed
```

- **Partner accounts** are separate from resident accounts: `/partner/register`, `/partner/login`, dashboard at `/partner`.
  A partner picks the services and cities they cover and only sees unlocked jobs that match both.
- **One partner per job**, enforced twice: inside a database transaction and by a `UNIQUE(group_id)` constraint on
  `provider_assignments`. A job accepted by one partner disappears for everyone else.
- **Reject** hides the job from that partner only; it stays open for others. **Give job back** returns an accepted job
  to the pool. **Completed** is only allowed on or after the service date (see `ALLOW_EARLY_COMPLETE`).
- **Nothing is auto-assigned.** If nobody accepts, the customer sees "Awaiting provider" and the date stays unconfirmed.
- **Roles**: tokens carry `customer`, `provider` or `admin`. Customer pages and APIs reject partner and admin tokens
  and the other way round (HTTP 403).
- **Privacy**: customers see a partner's name and phone only after acceptance and only if they joined that group.
  A partner sees residents' names, flats and phones only for jobs they hold and have not completed. Provider email,
  password hash and other partners' data are never sent to customers.
- **Payments are untouched.** Acceptance and completion never change a payment. Customers see Unpaid, Payment pending,
  Paid, Refund due or Refunded, driven only by the payment records.
- **Admin** (minimal): `/admin` lists partners (approve / suspend) and unlocked groups (release a job from a partner).
  Create the first admin from the command line, there is no admin sign-up:
  `npm run create-admin -- you@example.com 'a-long-password' "Your Name"` (then log in at `/admin/login`).

### Environment switches (partners)

| Variable | Default outside production | Default in production | Meaning |
|---|---|---|---|
| `ALLOW_DEMO_PROVIDERS` | on | off | partners registered are flagged **Demo partner** and customers see that tag |
| `PROVIDER_AUTO_APPROVE` | on | off | off = new partners are `pending` until an admin approves them |
| `ALLOW_EARLY_COMPLETE` | on | off | on = a partner may mark a job done before its service date (so you can demo today) |

Set any of them to `1` or `0` to override.

### Demo workflow (local, no real people or money)

1. `npm run setup && npm start`, open http://localhost:4000.
2. Register a test partner at **/partner/register**: choose *Car wash* and *Noida*. It is flagged as a demo partner.
3. Log out. Log in as the customer `demo@saath.in` / `demo1234`. Open **Groups**, pick the Noida **Car wash** group
   (25 of 25 flats, already unlocked) and tap *Join group*. My bookings shows **Awaiting provider**, date not confirmed.
   (To try unlocking yourself, start a new group with a target of 5 and join with the other seeded neighbours' accounts,
   for example `priya0@example.com` / `demo1234`.)
4. Log out, log in at **/partner/login**, open the dashboard and press **Accept job**.
5. Log out, log in as the customer again. My bookings and the group page now show **Provider assigned**, the partner's
   name and phone with a **Demo partner** tag, **Confirmed** service date, and payment still **Unpaid**.
6. As the partner, press **Mark as completed**. The customer now sees **Completed**.

Run the automated checks with `npm test` (starts its own server on a temporary database). They cover the partner flow,
the alerts (popup, WhatsApp and SMS lines read from the server console) and forgot password.

### Database changes (backward compatible)

The notification and password-reset update adds `notification_log`, `provider_notifications`, `notify_sent` and
`password_resets`, and a `pw_version` column on `users` and `providers`, the same safe way. Existing data is untouched.

New tables are added with `CREATE TABLE IF NOT EXISTS` the next time the server starts: `providers`,
`provider_services`, `provider_areas`, `provider_assignments`, `provider_job_events` (accept / reject / withdraw /
complete history) and `admins`. No existing table, row or seed value is changed, and `DATA_VERSION` is unchanged,
so an existing database is **not** reset. To upgrade: back up `saath.db`, deploy, restart. Nothing else to run.

## Notifications (popup, WhatsApp, SMS)

Messages are sent by the server right after the change is saved, and never slow down or break the booking.

| When | Who is told | How |
|---|---|---|
| A group reaches its flat count (unlocks) | every **active** partner who covers that service **and** city and has not declined it | popup + WhatsApp + SMS |
| The same event | the residents in the group | WhatsApp, or SMS if WhatsApp is not available |
| A resident joins a job a partner already accepted | that partner | popup + WhatsApp + SMS |
| A partner accepts | the residents, with the partner's name and number | WhatsApp, else SMS |
| A partner gives a job back, or an admin releases it | the other matching partners | popup + WhatsApp + SMS |
| The host cancels the group | the partner who held it, and the other residents | as above |
| An admin approves a partner | that partner | popup + WhatsApp + SMS |
| A new partner registers | the Saath team (`ADMIN_NOTIFY_PHONE` / `ADMIN_NOTIFY_EMAIL`) | WhatsApp or SMS, and email |

- **The popup** appears on any page while a partner is logged in (it checks every 15 seconds and when the tab is
  opened) and refreshes the job list. "View jobs" opens the dashboard.
- A group's "unlocked" alert goes out **once**, even if residents leave and rejoin around the target.
- Alerts never contain residents' phone numbers. Those stay behind "Accept job", as before.
- **Channels** use Twilio (SMS and WhatsApp) and Resend (email). Set the keys from `.env.example`. With no keys,
  in development every message is **printed in the server console** so you can test the whole flow for free;
  in production it is saved as `skipped` in the `notification_log` table and a warning is printed at start-up.
  Every message sent or failed is in `notification_log` (reset codes are never stored there).
- **Before going live**: WhatsApp only lets a business start a conversation with an approved *message template*,
  and Indian SMS needs DLT registration (sender ID and template). Free-text messages like these work in the Twilio
  WhatsApp sandbox and inside a 24-hour customer chat, but for real alerts register templates with the same wording
  (see `server/events.js` and `server/password-reset.js`) and get them approved. Partners agree to receive alerts
  on the registration form.

## Forgot password

Residents (`/forgot-password`) and partners (`/partner/forgot-password`, linked from both log-in pages):

1. Enter the email. A **6-digit code** is sent to that email and to the mobile number on the account (WhatsApp, else SMS).
2. Enter the code and a new password.

The code lasts 15 minutes, works once and allows 5 wrong tries. At most 3 codes per account per hour. The page never
says whether an email has an account. Only a keyed hash of the code is stored. After a reset, every older login of that
account is logged out, and the owner gets a "your password was changed" message. Admin passwords are reset from the
command line: `npm run create-admin -- you@example.com 'new-long-password'` (it updates an existing admin).

## Turn on real payments (Razorpay)

1. Create a Razorpay account and finish KYC. Copy the Key ID and Key Secret.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on your server (see `.env.example`).
3. In Razorpay > Webhooks add `https://YOUR-DOMAIN/api/payments/webhook`, event `payment.captured`, and set the
   same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Test with Razorpay test keys first. Refunds are issued from the Razorpay dashboard for bookings marked
   "refund due".

Provider acceptance and completion never mark a payment as paid and do not depend on the payment mode.

Before enabling live payments also: (a) confirm the Razorpay account is KYC-approved and test with test keys first,
(b) set `JWT_SECRET` and put the site behind HTTPS, (c) set the webhook and verify one real payment and one refund,
(d) decide your refund process for a group where a partner accepted and the resident already paid, and
(e) replace the example partner names in `server/seed.js` (they are no longer shown as the assigned provider).

Without keys, local development uses a demo checkout (no real money). In production without keys, only
"pay after service" is offered, and the demo checkout is never available.

## Deploy

Needs a host that keeps files between restarts, because SQLite is a file. Mount a persistent disk, set
`DB_FILE` to a path on it, and back it up daily.

```bash
npm run setup
NODE_ENV=production JWT_SECRET=<long random string> DB_FILE=/data/saath.db node server/index.js
```

A `Dockerfile` is included. Put the site behind HTTPS (Render, Railway, Fly.io, or Nginx + Let's Encrypt).

## Before you launch

- The example partner names in `server/seed.js` (CoolCare, ShineLane...) are placeholders and are no longer shown as
  the assigned provider. Real partners register themselves. Review them in `/admin` before they handle real residents.
- Verify the society list and add flat counts. Remove the demo account and demo groups.
- Fill in your business name, address and support email on the policies page.
- Test one real payment and one refund end to end.

## API

| Method        | Route                            | Auth | Purpose                              |
|---------------|----------------------------------|------|--------------------------------------|
| GET           | /api/meta                        | no   | societies, services, slots, payment mode |
| POST          | /api/societies                   | no   | add a missing society                |
| POST          | /api/auth/register, /login       | no   | create account, log in               |
| POST          | /api/auth/forgot, /reset         | no   | forgot password: send code, set new password |
| GET           | /api/auth/me                     | yes  | current user                         |
| GET           | /api/groups                      | no   | list (`society_id`, `city`, `service`) |
| GET           | /api/groups/:id                  | no   | group, members, comments             |
| POST          | /api/groups                      | yes  | start a group (date + time slot)     |
| DELETE        | /api/groups/:id                  | host | cancel a group                       |
| POST / DELETE | /api/groups/:id/join             | yes  | join or update / leave               |
| POST          | /api/groups/:id/comments         | yes  | comment                              |
| POST          | /api/payments/order, /verify     | yes  | start and confirm an online payment  |
| POST          | /api/payments/webhook            | sig  | Razorpay confirmation                |
| GET           | /api/me/bookings                 | yes  | my bookings with group, provider, payment and service status |
| GET           | /api/session                     | any  | role and profile of the logged-in account |
| POST          | /api/provider/auth/register, /login | no | service partner sign-up and login   |
| GET           | /api/provider/auth/me            | partner | partner profile                   |
| POST          | /api/provider/auth/forgot, /reset | no  | partner forgot password              |
| GET           | /api/provider/notifications      | partner | unread popup alerts               |
| POST          | /api/provider/notifications/read | partner | mark alerts read (`{ids:[...]}` or `{ids:"all"}`) |
| GET           | /api/provider/jobs               | partner | available, upcoming, completed, cancelled |
| POST          | /api/provider/jobs/:id/accept, /reject, /withdraw, /complete | partner | job transitions, validated on the server |
| POST          | /api/admin/auth/login            | no   | admin login                          |
| GET           | /api/admin/overview              | admin | partners and unlocked groups        |
| POST          | /api/admin/providers/:id/status  | admin | approve or suspend a partner        |
| POST          | /api/admin/jobs/:id/release      | admin | take an accepted job back           |

## Service partner coverage

A job shows in a partner's **Available** tab only when both its service and its city are in the partner's
coverage. Partners can change this any time from the dashboard (**Edit coverage**). When unlocked jobs
exist in a city the partner does not cover yet, the dashboard says so and offers a one-click **Add city** button.
