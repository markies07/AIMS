# Dubai Parking System

A parking-lot system with two faces, built from [docs/Dubai-Parking-System-Concept.md](docs/Dubai-Parking-System-Concept.md):

- **Public** — drivers check free spaces before setting off. No login.
- **Staff** — attendants record vehicles in and out; the owner manages slots, rates, staff and reports.

Attendants doing their normal job is what keeps the public number honest. That loop is the product.

> **Operating the system rather than developing it?** Read
> **[docs/Operations-Manual.md](docs/Operations-Manual.md)** — sample accounts, the
> attendant gate workflow, the owner console, fee calculation, and what to settle
> before launch. This README covers developer setup only.

**Stack:** Next.js 16 (App Router) · Tailwind v4 · Firebase (Firestore + Auth) · TypeScript · deployed to Vercel.

---

## Getting started

```bash
npm install
```

### 1. Firebase admin credentials (required)

The public web config is already in `.env.local`. You still need a **service account**, which is secret:

1. Firebase console → **Project settings → Service accounts → Generate new private key**
2. Open the downloaded JSON and copy three values into `.env.local`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and the `\n`)
3. Delete the downloaded JSON.

Without these the app still builds and the public page renders a graceful "temporarily unavailable" — it just has no data.

### 2. Enable Email/Password auth

Firebase console → **Authentication → Sign-in method → Email/Password → Enable**.

### 3. Deploy the security rules

```bash
npm run rules:deploy    # publishes firestore.rules using the service account
npm run rules:verify    # proves the live rules from an anonymous client
```

**Do this before any real data exists.** Firestore defaults are permissive;
[firestore.rules](firestore.rules) is what stops anonymous visitors reading
plate numbers. `rules:verify` checks nine cases against the live project —
availability and rates readable, `sessions`/`slots`/`auditLog`/`users` denied,
and all client writes denied.

### 4. Seed a demo lot

```bash
npm run seed
```

Creates 34 slots across two levels, the §6 placeholder rates, and two accounts printed at the end. **Change both passwords before this is publicly reachable.**

### 5. Run

```bash
npm run dev
```

|          |                        |
| -------- | ---------------------- |
| `/`      | Public availability    |
| `/rates` | Public rates and hours |
| `/login` | Staff sign-in          |
| `/staff` | Attendant console      |
| `/owner` | Owner console          |

---

## Commands

|                         |                                           |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Development server                        |
| `npm run build`         | Production build                          |
| `npm test`              | Unit tests                                |
| `npm run typecheck`     | TypeScript                                |
| `npm run lint`          | ESLint                                    |
| `npm run seed`          | Seed the configured project               |
| `npm run emulators`     | Local Firebase emulators (**needs Java**) |
| `npm run seed:emulator` | Seed the emulators                        |

---

## How it is put together

### No client writes, anywhere

Every mutation goes through a server action using the Admin SDK. [firestore.rules](firestore.rules) denies client writes outright. This keeps slot transitions, fee calculation, receipt numbering and audit entries in one place instead of duplicating them in a rules language that cannot express transactions.

### The slot guarantee

§4 claims two cars can never be sent to the same space. That rests on a read-assert-write inside one Firestore transaction in [admitVehicle](src/lib/actions/vehicles.ts) — the slot's status is asserted `available` in the same transaction that claims it. Two attendants tapping the same slot: one wins, the other gets `slotTaken` and a refreshed picker.

### One public document

Anonymous visitors read a single denormalised `publicView/current` doc, rewritten inside the same transaction as every slot change. It leaks nothing (no plates, no fees, no times), costs one read per visitor instead of one per slot, and cannot drift out of step with the slots it describes.

### Money is integer fils

1 AED = 100 fils, stored and computed as integers. `0.1 + 0.2 !== 0.3` is not an acceptable property for something that decides what a driver is charged.

### Rates are versioned

Never edited in place. A session snapshots the rate at entry, so a mid-stay price change cannot surprise a driver who is already parked, and any completed session stays explicable against the price in force when it happened.

### Times

Stored UTC, rendered in the lot's timezone (`Asia/Dubai`). Entry and exit instants are always server-generated — never a browser clock, since that is where the person being billed is sitting.

---

## Testing

```bash
npm test
```

35 unit tests covering the fee engine (including the doc's worked example: 3h20m → **AED 14.00**) and the public projection.

A further 15 tests need the Firestore emulator and are skipped without it — security rules (most importantly that anonymous reads of `sessions` **fail**) and the concurrent-assignment guarantee:

```bash
npm run emulators                                    # terminal 1 — needs Java
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test      # terminal 2
```

Java is not currently installed on this machine, so those 15 have not yet been
executed. The security rules they cover **have** been verified another way —
`npm run rules:verify` runs the same assertions against the live project from an
unauthenticated client and passes 9/9. The concurrency test remains unproven.

---

## Still needed from the client

The build does not block on these — all are configuration, editable in the owner console — but the seeded data is placeholder until §10 is answered:

- **Real rates**, and whether a daily cap applies
- **Actual slot count**, codes and levels
- **Opening hours** — 24/7? Different rates at night or on weekends?
- **VAT registration**, and whether posted prices already include it
- Whether the entrance and exit are staffed by different people

One flagged assumption: **the daily maximum is applied per rolling 24 hours from entry**, and the first-hour premium is charged once per stay rather than once per day. This materially changes multi-day bills and should be confirmed before launch.

---

## Deliberately not built

Advance booking, driver accounts, card payment, QR tickets, SMS/WhatsApp, monthly contracts, plate cameras, barriers — all §11 "later" items. The public page's hourly row shows **today's occupancy, read-only**; it is styled like the booking mockup but takes no reservations, and is labelled so no driver mistakes it for one.

Arabic is not built, but the structure is ready for it: `/[locale]` routes, all strings in `messages/en.json`, and logical CSS properties throughout. Adding it means adding `"ar"` to [src/i18n/routing.ts](src/i18n/routing.ts) and supplying `messages/ar.json` — no component changes.
