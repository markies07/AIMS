import { describe, expect, it } from "vitest";
import {
  HOUR_NOT_RECORDED,
  buildPublicView,
  countSlots,
  emptyHourlyOccupancy,
  occupancyPercent,
  sampleOccupancy,
  toPublicSlot,
  withSlotStatus,
} from "./publicView";
import type { PublicSlot, Slot } from "../types";

function slot(overrides: Partial<PublicSlot> = {}): PublicSlot {
  return {
    code: "A-01",
    level: "Ground",
    zone: "Zone A",
    section: "A",
    vehicleType: "car",
    status: "available",
    ...overrides,
  };
}

describe("countSlots", () => {
  it("counts free and total per vehicle type", () => {
    const { freeByType, totalByType } = countSlots([
      slot({ code: "A-01", status: "available" }),
      slot({ code: "A-02", status: "occupied" }),
      slot({ code: "M-01", vehicleType: "motorcycle", status: "available" }),
    ]);

    expect(freeByType).toEqual({ car: 1, motorcycle: 1 });
    expect(totalByType).toEqual({ car: 2, motorcycle: 1 });
  });

  it("excludes out-of-service slots from capacity entirely", () => {
    // Reporting "1 of 2 free" when the other space is flooded would overstate
    // the lot: that slot is not capacity, it is a hole in the floor.
    const { freeByType, totalByType } = countSlots([
      slot({ code: "A-01", status: "available" }),
      slot({ code: "A-02", status: "out_of_service" }),
    ]);

    expect(freeByType.car).toBe(1);
    expect(totalByType.car).toBe(1);
  });
});

describe("occupancyPercent", () => {
  it("reports 0 for an empty lot and 100 for a full one", () => {
    expect(
      occupancyPercent({ car: 10, motorcycle: 0 }, { car: 10, motorcycle: 0 }),
    ).toBe(0);
    expect(
      occupancyPercent({ car: 0, motorcycle: 0 }, { car: 10, motorcycle: 0 }),
    ).toBe(100);
  });

  it("does not divide by zero when the lot has no slots", () => {
    expect(
      occupancyPercent({ car: 0, motorcycle: 0 }, { car: 0, motorcycle: 0 }),
    ).toBe(0);
  });
});

describe("sampleOccupancy", () => {
  const timeZone = "Asia/Dubai";

  it("records the sample in the local hour bucket", () => {
    // 09:30 UTC is 13:30 in Dubai (UTC+4).
    const at = new Date("2026-08-14T09:30:00Z");
    const state = sampleOccupancy(null, 42, at, timeZone);

    expect(state.hourlyOccupancy[13]).toBe(42);
    expect(state.occupancyDate).toBe("2026-08-14");
  });

  it("keeps the busiest reading within an hour", () => {
    const at = new Date("2026-08-14T09:30:00Z");
    let state = sampleOccupancy(null, 40, at, timeZone);
    state = sampleOccupancy(state, 70, at, timeZone);
    state = sampleOccupancy(state, 55, at, timeZone);

    // "Busiest hour" means the peak, not the last value seen.
    expect(state.hourlyOccupancy[13]).toBe(70);
  });

  it("resets when the lot's local day rolls over", () => {
    const day1 = sampleOccupancy(
      null,
      80,
      new Date("2026-08-14T09:00:00Z"),
      timeZone,
    );
    const day2 = sampleOccupancy(
      day1,
      10,
      new Date("2026-08-15T09:00:00Z"),
      timeZone,
    );

    expect(day2.occupancyDate).toBe("2026-08-15");
    expect(day2.hourlyOccupancy[13]).toBe(10);
    // Yesterday's peak must not bleed into today's chart.
    expect(
      day2.hourlyOccupancy.filter((v) => v !== HOUR_NOT_RECORDED),
    ).toHaveLength(1);
  });

  it("starts with every hour unrecorded", () => {
    expect(emptyHourlyOccupancy()).toHaveLength(24);
    expect(emptyHourlyOccupancy().every((v) => v === HOUR_NOT_RECORDED)).toBe(
      true,
    );
  });
});

describe("withSlotStatus", () => {
  it("changes only the named slot", () => {
    const slots = [slot({ code: "A-01" }), slot({ code: "A-02" })];
    const next = withSlotStatus(slots, "A-02", "occupied");

    expect(next[0].status).toBe("available");
    expect(next[1].status).toBe("occupied");
  });

  it("does not mutate the input", () => {
    const slots = [slot({ code: "A-01", status: "available" })];
    withSlotStatus(slots, "A-01", "occupied");
    expect(slots[0].status).toBe("available");
  });
});

describe("toPublicSlot", () => {
  const base: Slot = {
    id: "a-01",
    code: "A-01",
    level: "Ground",
    zone: "Zone A",
    section: "A",
    vehicleType: "car",
    status: "available",
    currentSessionId: null,
    outOfServiceReason: null,
    sortOrder: 0,
  };

  it("leaks nothing beyond code, position, type and availability", () => {
    const projected = toPublicSlot({
      ...base,
      status: "occupied",
      currentSessionId: "session-with-a-plate-number",
    });

    expect(projected).toEqual({
      code: "A-01",
      level: "Ground",
      zone: "Zone A",
      section: "A",
      vehicleType: "car",
      status: "occupied",
    });
    expect(JSON.stringify(projected)).not.toContain("session");
  });

  it("treats only `available` as free", () => {
    const freeCount = (status: Slot["status"]) =>
      countSlots([toPublicSlot({ ...base, status })]).freeByType.car;

    expect(freeCount("available")).toBe(1);
    // An assigned slot is spoken for even though no car is in it yet (§4).
    expect(freeCount("assigned")).toBe(0);
    expect(freeCount("occupied")).toBe(0);
    expect(freeCount("out_of_service")).toBe(0);
  });

  it("reports every one of the four states in the capacity counts", () => {
    const { statusCounts } = countSlots([
      slot({ code: "A-01", status: "available" }),
      slot({ code: "A-02", status: "assigned" }),
      slot({ code: "A-03", status: "occupied" }),
      slot({ code: "A-04", status: "out_of_service" }),
    ]);

    expect(statusCounts).toEqual({
      available: 1,
      assigned: 1,
      occupied: 1,
      outOfService: 1,
      // Usable capacity excludes the closed space.
      total: 3,
    });
  });
});

describe("buildPublicView", () => {
  it("assembles counts, slots and an occupancy sample together", () => {
    const view = buildPublicView({
      lotId: "dubai-main",
      lotName: "Dubai Parking",
      timeZone: "Asia/Dubai",
      slots: [
        slot({ code: "A-01" }),
        slot({ code: "A-02", status: "occupied" }),
      ],
      previousOccupancy: null,
      at: new Date("2026-08-14T09:00:00Z"),
    });

    expect(view.freeByType.car).toBe(1);
    expect(view.totalByType.car).toBe(2);
    expect(view.hourlyOccupancy[13]).toBe(50);
  });
});
