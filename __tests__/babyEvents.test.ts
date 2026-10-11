import {
  daysSince, delayMinutes, disabledNotificationCount, FORBIDDEN_KEYS, isNewSession, localHour, queueSource, safeProps, SESSION_GAP_MS,
  trackHouseholdInvite, trackNotificationPrefs, trackRecordLogged, trackRecordUndone,
} from "@/lib/analytics/babyEvents";
import { track } from "@/lib/analytics/posthog";
import { initialNotificationPrefs } from "@/lib/notifications/catalog";
import { pushAction, loadQueue } from "@/lib/widgets/store";

const mockMem = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockMem.set(k, v);
  }),
  removeItem: jest.fn(async (k: string) => {
    mockMem.delete(k);
  }),
}));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { fetch: jest.fn(async () => ({ isConnected: false })) } }));
jest.mock("@/lib/analytics/posthog", () => ({ track: jest.fn() }));

const flush = () => new Promise((r) => setTimeout(r, 0));
const sent = () => (track as jest.Mock).mock.calls.map(([event, props]) => ({ event, props }));

describe("analitika e faqes së bebit", () => {
  beforeEach(() => {
    (track as jest.Mock).mockClear();
    mockMem.clear();
  });

  it("ora lokale dhe ditët që nga hapja e parë", () => {
    expect(localHour(new Date(2026, 9, 11, 3, 15))).toBe(3);
    expect(daysSince(new Date(2026, 9, 1, 22).toISOString(), new Date(2026, 9, 11, 8))).toBe(10);
    expect(daysSince(new Date(2026, 9, 11, 8).toISOString(), new Date(2026, 9, 11, 23))).toBe(0);
    expect(daysSince("jo-datë")).toBe(0);
  });

  it("vonesa e widget-it dhe burimi i radhës", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    expect(delayMinutes("2026-10-11T11:20:00Z", now)).toBe(40);
    expect(delayMinutes("2026-10-11T12:30:00Z", now)).toBe(0);
    expect(queueSource("deep_link")).toBe("deep_link");
    expect(queueSource(undefined)).toBe("widget"); // veprimet e vjetra pa burim
  });

  it("seanca: e para, pastaj vetëm pas 30 minutash", () => {
    expect(isNewSession(0, 1_000)).toBe(true);
    expect(isNewSession(1_000, 1_000 + SESSION_GAP_MS - 1)).toBe(false);
    expect(isNewSession(1_000, 1_000 + SESSION_GAP_MS)).toBe(true);
  });

  it("safeProps heq çdo çelës personal", () => {
    const props = safeProps({ kind: "feeding", babyName: "Ana", dob: "2026-01-01", note: "x", email: "a@b", phone: "044", amount_ml: 90, hour: 3 });
    expect(props).toEqual({ kind: "feeding", hour: 3 });
  });

  it("record_logged: vetëm llojet dhe numrat (asnjë çelës i ndaluar)", async () => {
    trackRecordLogged({ kind: "diaper", source: "widget", at: new Date(2026, 9, 11, 2, 0).toISOString(), queuedAt: new Date(Date.now() - 5 * 60_000).toISOString() });
    trackRecordUndone("feeding", "delete");
    trackHouseholdInvite("viewer");
    trackNotificationPrefs({ ...initialNotificationPrefs, keys: { baby_feeding: false, shop_offers: false } });
    await flush();
    const events = sent();
    const logged = events.find((e) => e.event === "record_logged")!;
    expect(logged.props).toEqual({ kind: "diaper", source: "widget", hour: 2, delay_minutes: 5, offline: true });
    for (const e of events) {
      for (const key of Object.keys(e.props ?? {})) {
        expect(FORBIDDEN_KEYS.some((f) => key.toLowerCase().includes(f))).toBe(false);
      }
    }
    expect(events.map((e) => e.event)).toEqual(expect.arrayContaining(["record_undone", "household_invite_created", "notification_prefs_changed"]));
  });

  it("njoftimet: numri i llojeve të fikura, jo cilat", () => {
    // shop_offers nis i fikur si parazgjedhje
    expect(disabledNotificationCount(initialNotificationPrefs)).toBe(1);
    expect(disabledNotificationCount({ ...initialNotificationPrefs, keys: { baby_feeding: false } })).toBe(2);
    // master-i i fikur = të gjitha
    expect(disabledNotificationCount({ ...initialNotificationPrefs, keys: { push: false } })).toBeGreaterThan(10);
  });

  it("radha e widget-it ruan burimin (widget / lidhje bebix://)", async () => {
    await pushAction({ kind: "diaper", type: "wet" }, new Date("2026-10-11T10:00:00Z"));
    await pushAction({ kind: "diaper", type: "dirty" }, new Date("2026-10-11T10:00:10Z"), "deep_link");
    expect((await loadQueue()).map((a) => a.source)).toEqual(["widget", "deep_link"]);
  });
});
