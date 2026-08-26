import { describe, expect, it } from "vitest";
import { computeFee } from "./computeFee";
import { aedToFils, formatAed } from "../money";
import type { VatConfig, VehicleRate } from "../types";

/** The example rates from concept doc §6. Placeholders until the owner confirms. */
const CAR: VehicleRate = {
  firstHourFils: aedToFils(5),
  subsequentHourFils: aedToFils(3),
  graceMinutes: 15,
  dailyMaxFils: aedToFils(40),
};

const MOTORCYCLE: VehicleRate = {
  firstHourFils: aedToFils(3),
  subsequentHourFils: aedToFils(2),
  graceMinutes: 15,
  dailyMaxFils: aedToFils(25),
};

const NO_VAT: VatConfig = {
  registered: false,
  ratePercent: 5,
  pricesIncludeVat: false,
};

const ENTRY = new Date("2026-08-14T08:00:00+04:00");

function after(hours: number, minutes = 0): Date {
  return new Date(ENTRY.getTime() + hours * 3_600_000 + minutes * 60_000);
}

describe("computeFee — the concept doc's worked example", () => {
  it("charges AED 14.00 for a car parked 3 hours 20 minutes (§6)", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: NO_VAT,
    });

    expect(fee.durationMinutes).toBe(200);
    expect(fee.billedHours).toBe(4); // rounded up
    expect(fee.totalFils).toBe(aedToFils(14));
    expect(formatAed(fee.totalFils)).toBe("AED 14.00");
  });

  it("itemises that example so the driver can see the arithmetic", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: NO_VAT,
    });

    expect(fee.lines).toHaveLength(2);
    expect(fee.lines[0]).toMatchObject({
      kind: "first_hour",
      quantity: 1,
      amountFils: aedToFils(5),
    });
    expect(fee.lines[1]).toMatchObject({
      kind: "additional_hours",
      quantity: 3,
      unitFils: aedToFils(3),
      amountFils: aedToFils(9),
    });

    const summed = fee.lines.reduce((n, l) => n + l.amountFils, 0);
    expect(summed).toBe(fee.totalFils);
  });
});

describe("grace period", () => {
  it("is free below the grace period", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(0, 10),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.totalFils).toBe(0);
    expect(fee.withinGrace).toBe(true);
    expect(fee.billedHours).toBe(0);
  });

  it("is free at exactly the grace boundary", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(0, 15),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.totalFils).toBe(0);
    expect(fee.withinGrace).toBe(true);
  });

  it("charges a full first hour one minute past the boundary", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(0, 16),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.withinGrace).toBe(false);
    expect(fee.billedHours).toBe(1);
    expect(fee.totalFils).toBe(aedToFils(5));
  });
});

describe("rounding up to the next whole hour", () => {
  it("charges one hour for exactly one hour", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(1),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.billedHours).toBe(1);
    expect(fee.totalFils).toBe(aedToFils(5));
  });

  it("charges two hours one minute past the hour", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(1, 1),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.billedHours).toBe(2);
    expect(fee.totalFils).toBe(aedToFils(8)); // 5 + 3
  });
});

describe("daily maximum", () => {
  it("caps a 24-hour stay at the daily maximum", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(24),
      rate: CAR,
      vat: NO_VAT,
    });

    // Uncapped this would be 5 + 23x3 = AED 74.00
    expect(fee.capApplied).toBe(true);
    expect(fee.totalFils).toBe(aedToFils(40));
  });

  it("shows the cap as a visible reduction line", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(24),
      rate: CAR,
      vat: NO_VAT,
    });

    const capLine = fee.lines.find((l) => l.kind === "daily_cap");
    expect(capLine).toBeDefined();
    expect(capLine!.amountFils).toBeLessThan(0);

    const summed = fee.lines.reduce((n, l) => n + l.amountFils, 0);
    expect(summed).toBe(fee.totalFils);
  });

  it("caps each rolling 24h window separately over a multi-day stay", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(72),
      rate: CAR,
      vat: NO_VAT,
    });

    // Three full windows, each capped at AED 40.
    expect(fee.totalFils).toBe(aedToFils(120));
    expect(fee.capApplied).toBe(true);
  });

  it("does not cap a stay that stays under the maximum", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(5),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.capApplied).toBe(false);
    expect(fee.totalFils).toBe(aedToFils(17)); // 5 + 4x3
  });

  it("honours an uncapped rate", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(24),
      rate: { ...CAR, dailyMaxFils: null },
      vat: NO_VAT,
    });
    expect(fee.capApplied).toBe(false);
    expect(fee.totalFils).toBe(aedToFils(74));
  });
});

describe("motorcycle rates", () => {
  it("uses the motorcycle rate card", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: MOTORCYCLE,
      vat: NO_VAT,
    });
    expect(fee.totalFils).toBe(aedToFils(9)); // 3 + 3x2
  });

  it("caps at the motorcycle daily maximum", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(24),
      rate: MOTORCYCLE,
      vat: NO_VAT,
    });
    expect(fee.totalFils).toBe(aedToFils(25));
  });
});

describe("VAT (§9 — 5% UAE standard rate)", () => {
  it("adds VAT on top when posted prices exclude it", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: { registered: true, ratePercent: 5, pricesIncludeVat: false },
    });

    expect(fee.netFils).toBe(aedToFils(14));
    expect(fee.vatFils).toBe(aedToFils(0.7));
    expect(fee.totalFils).toBe(aedToFils(14.7));
  });

  it("extracts VAT from within when posted prices include it", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: { registered: true, ratePercent: 5, pricesIncludeVat: true },
    });

    expect(fee.totalFils).toBe(aedToFils(14)); // driver still pays 14.00
    expect(fee.netFils).toBe(1333);
    expect(fee.vatFils).toBe(67);
    expect(fee.netFils + fee.vatFils).toBe(fee.totalFils);
  });

  it("charges no VAT when the business is not registered", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: NO_VAT,
    });
    expect(fee.vatFils).toBe(0);
    expect(fee.netFils).toBe(fee.totalFils);
  });

  it("charges no VAT on a free grace-period stay", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(0, 5),
      rate: CAR,
      vat: { registered: true, ratePercent: 5, pricesIncludeVat: false },
    });
    expect(fee.totalFils).toBe(0);
    expect(fee.vatFils).toBe(0);
  });
});

describe("discounts (§8 — owner may waive or reduce)", () => {
  it("applies a discount before VAT", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: NO_VAT,
      discountFils: aedToFils(4),
    });
    expect(fee.totalFils).toBe(aedToFils(10));
  });

  it("never produces a negative total when the discount exceeds the fee", () => {
    const fee = computeFee({
      entryAt: ENTRY,
      exitAt: after(3, 20),
      rate: CAR,
      vat: NO_VAT,
      discountFils: aedToFils(999),
    });
    expect(fee.totalFils).toBe(0);
  });
});

describe("guards", () => {
  it("rejects an exit before the entry", () => {
    expect(() =>
      computeFee({
        entryAt: ENTRY,
        exitAt: new Date(ENTRY.getTime() - 1000),
        rate: CAR,
        vat: NO_VAT,
      }),
    ).toThrow(/before entryAt/);
  });

  it("rejects invalid dates", () => {
    expect(() =>
      computeFee({
        entryAt: ENTRY,
        exitAt: new Date("nonsense"),
        rate: CAR,
        vat: NO_VAT,
      }),
    ).toThrow();
  });
});
