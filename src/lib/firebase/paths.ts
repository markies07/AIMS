/**
 * Every collection is nested under a lot from day one. §11 plans additional
 * locations, and re-scoping a flat collection later means migrating live data
 * and rewriting every security rule — so the shape is paid for up front.
 */
export const paths = {
  lot: (lotId: string) => `lots/${lotId}`,

  slots: (lotId: string) => `lots/${lotId}/slots`,
  slot: (lotId: string, slotId: string) => `lots/${lotId}/slots/${slotId}`,

  sessions: (lotId: string) => `lots/${lotId}/sessions`,
  session: (lotId: string, sessionId: string) =>
    `lots/${lotId}/sessions/${sessionId}`,

  rates: (lotId: string) => `lots/${lotId}/rates`,
  rate: (lotId: string, rateId: string) => `lots/${lotId}/rates/${rateId}`,

  /** The single document anonymous visitors are allowed to read. */
  publicView: (lotId: string) => `lots/${lotId}/publicView/current`,

  turnaways: (lotId: string) => `lots/${lotId}/turnaways`,
  auditLog: (lotId: string) => `lots/${lotId}/auditLog`,
  receiptCounter: (lotId: string) => `lots/${lotId}/counters/receipt`,

  users: () => `users`,
  user: (uid: string) => `users/${uid}`,
} as const;
