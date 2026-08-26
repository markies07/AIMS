# Parking Management System

### Concept & How It Works

**For:** Dubai Parking Lot Project
**Prepared for:** Partner Review
**Date:** 12 August 2026
**Status:** Draft — rates and details still to be confirmed together

---

## 1. What This Is

A **website that shows people whether your parking lot has free spaces**, and a simple system your staff use to keep that information accurate.

It has two sides:

**The public side** — anyone can open the website on their phone and see how many parking slots are free right now. No login, no account needed.

**The staff side** — your attendants log in and record vehicles as they arrive and leave. Every time they do, the public website updates automatically.

That is the whole idea. Your staff do their normal job, and as a side effect, drivers across Dubai always see accurate availability.

---

## 2. The Problem It Solves

| Today                                                      | With the system                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Drivers arrive, find the lot full, and drive away annoyed. | Drivers check first. They only come when there is space.               |
| Nobody knows exactly how many slots are free.              | The count is always correct and visible to everyone.                   |
| Fees are computed in the head or on paper.                 | The system computes the fee automatically from the actual time parked. |
| No record of how much was collected today.                 | Every payment is recorded. Daily totals are one click away.            |
| Two cars sent to the same slot by mistake.                 | Impossible — a slot is reserved the moment it is assigned.             |

---

## 3. Who Uses It

### The Public — drivers

No login. They can only see **how many slots are free**. They cannot see plate numbers, fees, or any private information.

### Admin — your parking attendants

The staff at the entrance and exit. They are the ones who keep the information true to what is actually happening in the lot.

They can:

- Record a vehicle arriving (plate number and type)
- Give the driver a slot
- Look up a vehicle by plate number
- Process the exit, collect the payment, print the receipt
- Mark a slot as unusable if something is blocking it

They cannot change prices, add or remove slots, or create staff accounts.

### Super Admin — you, the owner

Full control over everything.

You can:

- Do everything an attendant can do
- Add, remove, or renumber parking slots
- Set the parking rates
- Create and manage attendant accounts
- See all reports: daily income, busiest hours, how full the lot is
- See a history of who changed what

---

## 4. The Four States of a Parking Slot

Every parking slot is always in one of four states. This is the heart of the system.

| State                 | What it means                                   | Shown as free to the public? |
| --------------------- | ----------------------------------------------- | :--------------------------: |
| 🟢 **Available**      | Empty and ready                                 |           **Yes**            |
| 🟡 **Assigned**       | Given to a car that is on its way to it         |              No              |
| 🔴 **Occupied**       | A car is parked in it                           |              No              |
| ⚫ **Out of Service** | Cannot be used — flooded, blocked, under repair |              No              |

**Why "Assigned" matters:** there is always a minute or two between your attendant saying _"go to slot B-14"_ and the driver actually parking there. During that gap, the slot must already be blocked off — otherwise another attendant could send a second car to the same space. This one small detail prevents a very common real-world problem.

---

## 5. How It Works, Step by Step

### Step 1 — The driver checks the website

The driver opens your website on their phone and sees:

- How many slots are free right now
- How many are free **for cars** and how many **for motorcycles**
- A map of the lot showing which spaces are open
- Your address, opening hours, and rates

They decide whether to come. If the lot is full, they save the trip.

### Step 2 — The driver arrives at the entrance

Your attendant at the entrance:

1. Asks for the **plate number** and notes the **vehicle type** (car or motorcycle)
2. Types it into the system
3. The system shows which slots are free and suitable
4. The attendant picks one — for example, **B-14**
5. **That slot is immediately blocked off** so nobody else gets it
6. The system records the **arrival time** — the billing starts here
7. The attendant tells the driver: _"Level 2, slot B-14"_

### Step 3 — The driver parks

Once the driver has parked, the attendant confirms it on screen. The slot is now marked **Occupied**, and the public website shows one less space available.

### Step 4 — The car stays parked

Nothing for staff to do. The system quietly counts the time.

At any moment, your staff can search a plate number and see which slot that car is in, how long it has been there, and how much it owes so far.

### Step 5 — The driver leaves

The driver drives to the exit. Your attendant there:

1. Searches the **plate number**
2. The system instantly shows: the slot, the arrival time, **how long they stayed**, and **how much they owe**
3. The attendant tells the driver the amount
4. The driver pays in cash
5. The attendant confirms the payment received
6. **A receipt is printed** for the driver
7. **The slot immediately becomes Available again**

### Step 6 — The cycle closes

The freed slot appears as available on the website within seconds. The next driver checking their phone sees the accurate number.

This is the loop that makes the whole thing work: **your staff doing their job automatically keeps the public information correct.**

---

## 6. How the Payment Works

Money is still collected **in cash, in person, at the exit** — exactly as you do now. The system does not touch the money. It only calculates the correct amount, records that it was paid, and prints the receipt.

### The rates

> ⚠️ **These numbers are examples only.** We need your real rates — see Section 10.

|                   | Car              | Motorcycle       |
| ----------------- | ---------------- | ---------------- |
| First hour        | AED 5.00         | AED 3.00         |
| Each hour after   | AED 3.00         | AED 2.00         |
| Free grace period | First 15 minutes | First 15 minutes |
| Maximum per day   | AED 40.00        | AED 25.00        |

Time is rounded up to the next full hour, which is standard parking practice.

### A real example

A car parks for **3 hours and 20 minutes**:

|                         |                    |
| ----------------------- | ------------------ |
| Time parked             | 3 hours 20 minutes |
| Rounded up to           | 4 hours            |
| First hour              | AED 5.00           |
| 3 more hours × AED 3.00 | AED 9.00           |
| **Total to pay**        | **AED 14.00**      |

This exact breakdown appears on the attendant's screen and on the receipt. So if a driver argues about the price, the attendant simply shows them the arrival time, the departure time, and the calculation. **Most parking disputes disappear the moment the customer can see the maths.**

### The receipt

Every driver gets a receipt showing:

- Your parking lot name and address
- Receipt number
- Plate number and slot
- Time in, time out, total duration
- The fee breakdown
- **Total paid in AED**
- Which attendant handled it

---

## 7. What Each Person Sees

### The public website

- **Home page** — the free slot count, split between cars and motorcycles
- **Slot map** — a colour-coded picture of the lot: green means free, grey means taken
- **Rates page** — your prices and opening hours

### The attendant's screen

- **Dashboard** — free slots right now, cars currently parked
- **Vehicle In** — record an arriving car and give it a slot
- **Vehicle Out** — search a plate, see the fee, take payment, print receipt
- **Lot map** — the full picture, with plate numbers visible to staff
- **Search** — find any car by plate number
- **My shift** — what this attendant handled and collected today

### Your screen as owner

- **Dashboard** — today's income, how full the lot is, busiest hours
- **Slots** — add, edit, or retire parking spaces
- **Rates** — change your prices
- **Staff** — create and manage attendant accounts
- **History** — every completed parking session, searchable
- **Reports** — income and occupancy over any period
- **Activity log** — who changed what, and when

---

## 8. When Things Go Wrong

Real parking lots are messy. Here is how the system handles the common situations.

| Situation                                    | What happens                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The lot is full**                          | The entry screen shows no free slots. The attendant turns the car away. The system can count these turn-aways — useful proof of lost business if you ever consider expanding. |
| **The driver changes their mind and leaves** | The attendant cancels. The slot goes back to free.                                                                                                                            |
| **The driver parks in the wrong slot**       | The attendant simply reassigns it. The correct slot is marked occupied, the wrong one is freed, and the arrival time stays the same.                                          |
| **Wrong plate number typed**                 | The attendant can correct it. The correction is recorded.                                                                                                                     |
| **A car at the exit has no record**          | The attendant searches part of the plate. If it is still not found, you as owner can create the record manually with a reason noted.                                          |
| **The car stays overnight or for days**      | Billing continues, but the daily maximum protects the customer from a huge bill. Long-staying cars are flagged on your dashboard.                                             |
| **A car is abandoned**                       | Cars parked beyond a set limit (for example 3 days) are flagged for you to act on.                                                                                            |
| **A slot becomes unusable**                  | The attendant marks it Out of Service with a reason. It stops being counted as available.                                                                                     |
| **A driver argues about the fee**            | The receipt shows the full breakdown. You can approve a discount or waive the fee, and the reason is recorded.                                                                |
| **The internet goes down**                   | Staff write plate numbers and times on paper, then enter them once the connection returns. These late entries are flagged.                                                    |
| **Shift change**                             | The outgoing attendant's cash collected is totalled by the system, so it can be checked against the actual cash.                                                              |

---

## 9. Things Specific to Dubai

These are points we should confirm together.

|                   |                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Currency**      | Everything in UAE Dirham (AED).                                                                                                                                                                                                                            |
| **Time**          | Gulf Standard Time (UTC+4).                                                                                                                                                                                                                                |
| **VAT**           | The UAE standard VAT rate is 5%. We need to know if your business is VAT-registered and whether your posted prices already include it — this changes how the receipt must be printed.                                                                      |
| **Language**      | Should the public website be in **English and Arabic**? Arabic reads right to left, so it is much cheaper to plan for this now than to add it later.                                                                                                       |
| **Plate numbers** | UAE plates have an emirate, a code, and a number (for example _Dubai · A · 12345_). We should record these as separate fields so that searching for a car actually works. Cars from other emirates and from neighbouring countries will also use your lot. |
| **Opening hours** | Are you open 24/7? Do prices change at night, on weekends, or on public holidays?                                                                                                                                                                          |
| **Rules**         | Public paid parking in Dubai falls under the RTA. A **private** lot normally sets its own prices, but you should confirm whether any permit or price-display rules apply to your site.                                                                     |
| **Records**       | Plate numbers count as personal data in the UAE. We should agree how long to keep old records.                                                                                                                                                             |

---

## 10. What We Need From You

These are the decisions needed before building starts. This section is meant to guide our next conversation.

### About the parking lot

1. How many parking slots in total? How many for cars and how many for motorcycles?
2. Is the lot divided into levels or sections? What are the actual slot numbers painted on the ground?
3. What are your opening hours? Are you open 24 hours?
4. How many attendants work at the same time? Are the entrance and exit staffed by different people?
5. Are any slots reserved — for staff, VIPs, disabled parking, or electric vehicles?

### About pricing

6. What are your **actual rates**? Flat fee, or per hour?
7. Should the first few minutes be free?
8. Is there a maximum charge per day?
9. Do prices change for motorcycles, at night, or on weekends and holidays?
10. Is the business VAT-registered? Do your posted prices include VAT?

### About payment

11. Is **cash only** correct for the launch, or do you need card payment straight away?
12. Does the receipt need to follow any specific legal format in the UAE?

### About the future

13. Do you plan to run **more parking lots** later? How many, and how soon?
14. Would you want drivers to **book a slot in advance** at some point?
15. Do you offer, or want to offer, **monthly parking** for regular customers?

---

## 11. What We Could Add Later

The first version stays deliberately simple so it works well and launches quickly. These can be added once the basics are running:

|                              |                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **More parking lots**        | Run several locations from the same system. Drivers pick the one they want. The system is already designed with this in mind. |
| **Card and digital payment** | Less cash to handle, faster exits.                                                                                            |
| **English and Arabic**       | Reaches far more of Dubai's population.                                                                                       |
| **Advance booking**          | Drivers reserve a slot before arriving.                                                                                       |
| **QR code ticket**           | The driver gets a code at entry; scanning it at exit pulls up their record instantly.                                         |
| **SMS or WhatsApp**          | Send the slot number and fee to the driver's phone.                                                                           |
| **Monthly parking**          | Contracts for regular customers — common in Dubai.                                                                            |
| **Automatic plate cameras**  | The system reads plates by itself, so no typing at all.                                                                       |
| **Automatic barriers**       | The barrier only opens once payment is confirmed.                                                                             |

---

## In Short

Your attendants keep doing what they already do — greeting drivers, assigning spaces, collecting money at the exit. The only change is that they now tap it into a screen instead of remembering it.

In exchange, you get three things you do not have today:

1. **Drivers across Dubai can see your free spaces before they drive over.**
2. **Parking fees are calculated correctly and automatically, every single time.**
3. **You know exactly how much your lot earned today, without counting anything by hand.**

---

**Next step:** Go through Section 10 together. Once those answers are settled, we can move on to the detailed build plan.
