# Dubai Central Parking — Operations Manual

**For:** Owner and parking attendants
**Covers:** The public website, the attendant console, and the owner console
**Status:** Running against the live Firebase project with placeholder settings

---

A website that tells drivers whether there is space, and a console your attendants
use to keep that answer true.

There is one idea holding the whole system up: **your attendants doing their
normal job is what keeps the public number honest.** Nobody maintains the
website. It is a by-product of the gate being worked properly.

| | |
|---|---|
| **Currency** | AED, held internally as whole fils |
| **Time zone** | Asia/Dubai (UTC+4) |
| **Payment** | Cash, in person, at the exit |
| **Seeded lot** | 34 bays across 2 levels and 2 zones |

---

## Contents

1. [Getting in](#1-getting-in)
2. [Sample accounts](#2-sample-accounts)
3. [How it fits together](#3-how-it-fits-together)
4. [The four bay states](#4-the-four-bay-states)
5. [The public site](#5-the-public-site)
6. [Attendant manual](#6-attendant-manual)
7. [Owner manual](#7-owner-manual)
8. [How fees are worked out](#8-how-fees-are-worked-out)
9. [When things go wrong](#9-when-things-go-wrong)
10. [Before you go live](#10-before-you-go-live)

---

## 1. Getting in

The site runs on your machine with one command. It talks to the live Firebase
project, so anything an attendant records here is real data.

```bash
# from f:\CODES\ParkingSystem
npm run dev

# then open
http://localhost:3000
```

Four addresses matter:

| Address | Who it is for | Sign-in |
|---|---|---|
| `/` | Drivers — landing page and live count | None |
| `/availability` | Drivers — the full bay map | None |
| `/admin` | Staff and owner sign-in | Required |
| `/staff` · `/owner` | The consoles | Required |

### Why `/admin` is not linked anywhere

There is no "staff login" link on the public site, and the page asks search
engines not to index it. Attendants reach it by bookmark.

This is tidiness rather than protection. The real guard is that every screen and
every action behind it re-checks who you are on the server, so knowing the
address gets an outsider nowhere.

---

## 2. Sample accounts

Two accounts were created when the lot was set up. Both work at `/admin`.

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Owner** | `owner@dubaicentralparking.ae` | `ChangeMe-Owner-2026` | `/owner` |
| **Attendant** | `attendant@dubaicentralparking.ae` | `ChangeMe-Staff-2026` | `/staff` |

> ⚠️ **Change both before anyone else can reach this.**
> These passwords are demonstration values and were written down in plain text
> during setup. Sign in as the owner, open **Staff**, create real accounts with
> real passwords, then deactivate these two. Every action in the system is
> recorded against the account that performed it, so shared or throwaway logins
> make the audit trail worthless.

### What each role can do

| Task | Attendant | Owner |
|---|:---:|:---:|
| Admit a vehicle, assign a bay | Yes | Yes |
| Take payment, print the receipt | Yes | Yes |
| Search any plate, see the lot map | Yes | Yes |
| Close a bay as out of service | Yes | Yes |
| Add, renumber or retire bays | No | Yes |
| Change the prices | No | Yes |
| Create and disable staff accounts | No | Yes |
| Discount or waive a fee | No | Yes |
| Create a record by hand | No | Yes |
| See income, reports and the activity log | Own shift only | Everything |

---

## 3. How it fits together

**A driver checks first.** Opens the site on their phone, sees the count,
decides whether to drive over. If the lot is full they save the trip.

**An attendant records the arrival.** Types the plate, picks a bay. That bay is
blocked the instant it is chosen, and the public count drops by one.

**An attendant records the exit.** Searches the plate, reads out the amount,
takes the cash, prints the receipt. The bay frees and the count goes back up.

### Two cars, one bay — why it cannot happen

When an attendant picks a bay, the system checks it is still free and claims it
in the same indivisible operation. If two attendants tap the same bay at the same
instant, one succeeds and the other is told *"That slot was just taken by someone
else"* and shown a refreshed map. There is no window in between.

---

## 4. The four bay states

Every bay is always in exactly one of these. The colours are the same on the
public map and in the console.

| State | Colour | Meaning | Counted as free? |
|---|---|---|:---:|
| **Free** | Green | Empty and offerable | Yes |
| **Held** | Amber | Given to a driver on their way to it | No |
| **Taken** | Red | A vehicle is parked in it | No |
| **Out of service** | Hatched grey | Flooded, blocked, under repair | No |

**Held is the one that matters.** There is always a minute or two between an
attendant saying *"go to B-04"* and the driver actually parking there. During
that gap the bay is already blocked, so a second attendant cannot send another
car to it. Removing that state is how most parking systems end up with two cars
in one space.

**Out-of-service bays leave the total, not just the free count.** If ten of fifty
bays are flooded, the site says *"40 spaces"*, not *"40 of 50"* — claiming
capacity you cannot offer misrepresents the lot.

Colour is never the only signal. Taken bays also carry a vehicle icon,
out-of-service bays are hatched, and every bay has a text label for screen
readers. Green-versus-red is the worst possible pairing for the most common form
of colour blindness, and a phone screen in Dubai sunlight washes both out.

---

## 5. The public site

**No sign-in.** Anyone can open it. They can see how many spaces are free and
which bays those are. They cannot see plate numbers, fees, arrival times, or
anything else.

### Landing page — `/`

The free count in the hero, the address, a directions button, and the rates. A
driver who has been before takes the availability link and never reads the rest.

### Availability — `/availability`

The full picture: a capacity row across the four bay states, then the bay map
with tabs for each level and bays grouped by zone. It updates live — leave it
open and it will change as staff work the gate. There is also an hour-by-hour
band showing how busy the lot has been today.

> **The site does not take bookings.**
> The hourly band is a record of how full the lot was, not a set of slots to
> reserve. Nothing on the public site holds a space. It is labelled *"View only
> — no booking"* so no driver arrives believing they have one.

### Rates — `/rates` · Location — `/location`

Prices, grace period, daily maximum and opening hours. These are read from the
same price list the exit gate charges from, so what is posted and what is
collected cannot drift apart.

---

## 6. Attendant manual

Five screens, reachable from the sidebar on a desktop or the bar along the bottom
on a phone. Almost all of a shift is spent on two of them.

### Dashboard

Opens on four figures — free now, parked now, entered today, and what you
personally have collected — then four large buttons for the things you actually
do. Below that: any vehicle still on its way to a bay, any vehicle parked more
than 24 hours, and the recent arrivals.

### Vehicle in

A driver has pulled up at the entrance.

1. **Pick the vehicle type.** Car or motorcycle. The bay map filters to match.

2. **Enter the plate.** Emirate, code, then number — three separate fields,
   because that is how a UAE plate is actually made up and it is what makes
   searching work later. The number field brings up a numeric keypad.

3. **Choose a bay from the floor plan.** Free bays are green and tappable; taken
   ones are shown but cannot be picked, so you can see the real shape of the lot
   against the numbers painted outside.

4. **Press "Assign slot".** The bay is blocked immediately and the clock starts.
   The screen shows the bay code in large type — read it to the driver.

5. **Press "Confirm parked" once they have parked.** The bay moves from held to
   taken. If the driver changes their mind and leaves instead, press
   **"Driver left — cancel"** and the bay goes straight back to free.

### Vehicle out

A driver has come to the exit to pay.

1. **Search the plate.** Type any part of it — the last three digits is usually
   enough. Matches appear as you type.

2. **Tap the vehicle.** You get the bay, the arrival time, how long they stayed
   and the amount due. Open **"How this was calculated"** to show the driver the
   arithmetic line by line.

3. **Tell the driver the amount and take the cash.** The system never touches the
   money. It only works out the figure.

4. **Press "Confirm cash received".** The session closes, a receipt number is
   issued, and the bay is free again within seconds — on the public site too.

5. **Print the receipt.** Opens a receipt sized for an 80mm till roll. Any
   printer works; nothing special needs installing.

> **If a driver argues about the price**, show them the breakdown. It lists the
> arrival time, the departure time, how the hours were counted and what each one
> cost. Most disputes end the moment the customer can see the sum.

### Lot map

The full picture with plate numbers visible to staff. Tap any bay to confirm a
driver has parked, cancel a hold, or close the bay as out of service with a
reason.

### My shift

Every vehicle you have checked out today, with the cash totalled. At handover,
check that total against what is actually in the drawer.

---

## 7. Owner manual

Everything an attendant can do, plus six screens that decide how the lot runs.

### Overview

Today's revenue, current occupancy, average stay, and how many vehicles were
turned away. Below: occupancy hour by hour with the busiest hour picked out, an
alerts panel, and the day's transactions with a link to every receipt.

Alerts are worked out from live data rather than stored, so they never need
dismissing — when a condition clears it simply stops appearing. You will see the
lot nearly full, vehicles parked over 24 hours, and bays currently closed.

### Slots

Add bays in ranges rather than one at a time — set a level, zone, prefix and a
number range and it creates them in one go.

Retiring a bay is blocked while a vehicle is in it, since removing it would
strand a live session and lose the money owed.

### Rates

Set the first hour, each hour after, the free grace period and the daily maximum,
separately for cars and motorcycles. Also whether the business is VAT-registered
and whether your posted prices already include it — that changes how receipts
must be printed.

> **Prices are versioned, never overwritten.**
> Saving a new price list creates a new version from a date you choose. The old
> one stays. A vehicle already parked keeps the price it arrived on, so nobody is
> surprised by a change made while they were inside, and any past session can
> still be explained against the price in force at the time.

### Staff

Create attendant accounts with a name, email and password of at least ten
characters.

Deactivating an account disables it immediately and ends any session already open
— someone who leaves mid-shift loses access at once, not whenever their login
happens to expire.

### History

Every completed session, searchable by plate or receipt number, with the
duration, the amount and a link to the receipt.

### Activity log

Who changed what, and when. Every price change, closed bay, cancelled hold,
corrected plate, discount and staff account appears here against the person who
did it.

Entries are written in the same operation as the change itself, so there can be
no change without its record.

---

## 8. How fees are worked out

Time is rounded up to the next whole hour, which is standard parking practice.
The first hour is charged at one rate and every hour after at another. Stays
inside the grace period are free.

### A car parked 3 hours 20 minutes

| Line | Working | AED |
|---|---|---:|
| Time parked | 3h 20m | — |
| Rounded up to | 4 hours | — |
| First hour | 1 × 5.00 | 5.00 |
| Additional hours | 3 × 3.00 | 9.00 |
| **Total** | | **14.00** |

That exact breakdown appears on the attendant's screen and on the receipt.

The amount is always worked out **on the server** from the recorded arrival time
— never from the clock on the attendant's machine, and never from anything the
browser sends. Money is held in fils as whole numbers rather than decimals, so no
rounding error can creep into a total.

> ⚠️ **One rule still needs your confirmation.**
> For stays over a day, the daily maximum is currently applied to each rolling
> 24 hours from arrival, and the first-hour premium is charged once for the whole
> stay rather than once per day. A three-day stay is therefore capped three
> times. This was an assumption — it changes long-stay bills materially, so
> confirm it before launch.

---

## 9. When things go wrong

Real lots are messy. Each of these is a button somewhere, and each one is
recorded against whoever pressed it.

| Situation | What to do | Who |
|---|---|---|
| **The lot is full** | Turn the car away and press **Record turn-away**. These add up into evidence of lost business. | Attendant |
| **Driver changes their mind before parking** | Cancel the hold. The bay goes straight back to free. | Attendant |
| **Driver parks in the wrong bay** | Reassign from the lot map. The arrival time is untouched — the driver is not charged for the paperwork. | Attendant |
| **Plate typed wrong** | Correct it. The change and the old value are both recorded. | Attendant |
| **A bay becomes unusable** | Close it with a reason. It stops being counted immediately. | Attendant |
| **Car at the exit with no record** | Search part of the plate first. If there is genuinely nothing, the owner creates the record by hand with an arrival time and a reason. | Owner |
| **Internet goes down** | Write plates and times on paper. Enter them afterwards as manual records — they are flagged so you can see which ones they were. | Owner |
| **A fee needs reducing or waiving** | Apply a discount at checkout. A reason is required and it is logged. | Owner |
| **Car parked for days** | Flagged on both dashboards after 24 hours. The daily maximum protects the customer from an absurd bill. | Both |
| **Shift change** | Check **My shift** against the cash in the drawer before handing over. | Attendant |

---

## 10. Before you go live

The lot is seeded with placeholder settings so the system is usable immediately.
All of it is editable from the owner console — none of it needs a developer.

- [x] **Security rules published and verified.** Checked against the live project
      from an anonymous browser: the availability count and rates are readable,
      plate numbers and everything else are not. Re-run any time with
      `npm run rules:verify`.
- [x] **Lot seeded.** 34 bays across two levels and two zones, with a price list.
- [ ] **Replace the demo accounts.** Create real staff accounts, then deactivate
      `owner@dubaicentralparking.ae` and `attendant@dubaicentralparking.ae`.
- [ ] **Enter your real prices.** The seeded figures are the examples from the
      concept doc (AED 5 first hour / 3 after / 40 cap for cars). Your mockup
      showed 20 / 10 / 150 — neither has been confirmed as real.
- [ ] **Enter the real bays.** The actual count, the codes painted on the ground,
      and the levels and zones they sit in.
- [ ] **Set the lot name, address and opening hours.** These drive the public
      pages and the receipt header.
- [ ] **Confirm the VAT position.** Whether the business is registered, and
      whether posted prices already include VAT. It changes what must appear on
      a receipt.
- [ ] **Confirm the multi-day capping rule.** See section 8.
- [ ] **Rotate the Firebase service account key** if it has ever been shared.

---

## Command reference

| Command | What it does |
|---|---|
| `npm run dev` | Start the site locally |
| `npm run build` | Production build |
| `npm test` | Unit tests (fee engine, availability projection) |
| `npm run seed` | Create or refresh the demo lot |
| `npm run rules:deploy` | Publish `firestore.rules` to the live project |
| `npm run rules:verify` | Prove the live rules from an anonymous client |
| `npm run typecheck` · `npm run lint` | Static checks |

---

*Prices, bay numbers and opening hours shown anywhere in this document are the
seeded placeholders and are changed from the owner console.*
