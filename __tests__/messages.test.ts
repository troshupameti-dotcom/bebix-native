import { canMessage, cleanMessage, dayKey, isMissing, MESSAGE_MAX, messageErrorKey } from "@/lib/community/messages";
import { routeForNotification } from "@/lib/notifications/routing";
import { NOTIFICATION_CATALOG } from "@/lib/notifications/catalog";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

describe("mesazhet private", () => {
  it("mjafton që njëri të ndjekë tjetrin; bllokimi e ndalon gjithmonë", () => {
    expect(canMessage(true, false, false)).toBe(true);
    expect(canMessage(false, true, false)).toBe(true);
    expect(canMessage(false, false, false)).toBe(false);
    expect(canMessage(true, true, true)).toBe(false);
  });

  it("mesazhi: 1–2000 shkronja pas pastrimit", () => {
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage("  Përshëndetje!  ")).toBe("Përshëndetje!");
    expect(cleanMessage("a".repeat(MESSAGE_MAX))).toHaveLength(MESSAGE_MAX);
    expect(cleanMessage("a".repeat(MESSAGE_MAX + 1))).toBeNull();
  });

  it("ndarësi i ditës sipas orës lokale", () => {
    expect(dayKey(new Date(2026, 9, 12, 0, 5).toISOString())).toBe("2026-10-12");
    expect(dayKey(new Date(2026, 9, 12, 23, 59).toISOString())).toBe("2026-10-12");
  });

  it("gabimet e bazës → tekste të qarta; migrimi që mungon njihet", () => {
    expect(messageErrorKey(new Error("dm_rate_limit"))).toBe("dm_err_rate");
    expect(messageErrorKey(new Error("dm_not_allowed"))).toBe("dm_err_not_allowed");
    expect(messageErrorKey(new Error('new row violates row-level security policy for table "dm_messages"'))).toBe("dm_err_not_allowed");
    expect(messageErrorKey(new Error("rrjeti"))).toBe("dm_err_generic");
    expect(isMissing({ code: "PGRST202" })).toBe(true);
    expect(isMissing({ code: "PGRST205" })).toBe(true);
    expect(isMissing({ code: "42501" })).toBe(false);
  });

  it("njoftimi i mesazhit hap bisedën dhe ka cilësimin e vet", () => {
    const id = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    expect(routeForNotification({ type: "message", conversationId: id })).toBe(`/(main)/community/chat/${id}`);
    expect(routeForNotification({ type: "message", conversationId: "jo-uuid" })).toBeNull();
    expect(NOTIFICATION_CATALOG.some((e) => e.key === "community_message")).toBe(true);
  });
});
