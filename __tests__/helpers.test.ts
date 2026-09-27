import { friendlyError, friendlyErrorKey } from "@/lib/errors/userMessage";
import { routeForNotification } from "@/lib/notifications/routing";
import { safeRedirect } from "@/lib/auth/redirect";
import { localDateKey, parseDobInput } from "@/lib/babyProfile";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const t = (key: string) => `[${key}]`;

describe("gabimet që sheh prindi", () => {
  it("njeh gabimet e shpeshta të Supabase-it dhe të rrjetit", () => {
    expect(friendlyErrorKey("Invalid login credentials")).toBe("err_invalid_login");
    expect(friendlyErrorKey("TypeError: Network request failed")).toBe("err_network");
    expect(friendlyErrorKey("User already registered")).toBe("err_already_registered");
    expect(friendlyErrorKey("For security purposes, you can only request this after 42 seconds.")).toBe("err_rate_limit");
    expect(friendlyErrorKey("new row violates row-level security policy for table \"orders\"")).toBe("err_forbidden");
  });

  it("mesazhet shqip të bazës kalojnë siç janë; teksti teknik i panjohur jo", () => {
    expect(friendlyError(new Error("Kodi nuk u gjet."), t as never, "err_generic")).toBe("Kodi nuk u gjet.");
    expect(friendlyError({ message: "unexpected token at position 3" }, t as never, "err_generic")).toBe("[err_generic]");
    expect(friendlyError(null, t as never, "fp_err")).toBe("[fp_err]");
  });
});

describe("prekja e njoftimit", () => {
  it("çon te postimi, porosia ose ekrani i kujtesës", () => {
    expect(routeForNotification({ postId: "0b9a9c2e-6a41-4b5e-9d3f-2f6f1b7c8d9e" })).toBe(
      "/(main)/community/post/0b9a9c2e-6a41-4b5e-9d3f-2f6f1b7c8d9e"
    );
    expect(routeForNotification({ orderId: "0b9a9c2e-6a41-4b5e-9d3f-2f6f1b7c8d9e" })).toBe("/(main)/shop/orders");
    expect(routeForNotification({ type: "feeding" })).toBe("/(main)/baby/feeding");
    expect(routeForNotification({ key: "shop_offers" })).toBe("/(main)/shop");
  });

  it("injoron të dhëna të panjohura ose të prishura", () => {
    expect(routeForNotification({ postId: "../../admin" })).toBeNull();
    expect(routeForNotification("x")).toBeNull();
    expect(routeForNotification(null)).toBeNull();
  });
});

describe("kthimi pas hyrjes", () => {
  it("pranon vetëm rrugë të brendshme", () => {
    expect(safeRedirect("/shop/checkout")).toBe("/shop/checkout");
    expect(safeRedirect("https://evil.example")).toBe("/(main)/baby");
    expect(safeRedirect("//evil.example")).toBe("/(main)/baby");
    expect(safeRedirect(undefined)).toBe("/(main)/baby");
  });
});

describe("data e lindjes", () => {
  const now = new Date(2026, 8, 28, 10, 0);

  it("pranon një datë të vlefshme", () => {
    expect(parseDobInput("15.03.2026", now)).toBe("2026-03-15");
  });

  it("refuzon datat e ardhshme, të pamundshme dhe tepër të vjetra", () => {
    expect(parseDobInput("01.10.2026", now)).toBeNull();
    expect(parseDobInput("31.02.2026", now)).toBeNull();
    expect(parseDobInput("01.01.1990", now)).toBeNull();
  });

  it("dita lokale nuk rrëshqet në ditën e mëparshme si te UTC", () => {
    // Mesnata e 15 marsit në orën lokale: toISOString() do ta jepte 14 mars në Kosovë.
    expect(localDateKey(new Date(2026, 2, 15, 0, 30))).toBe("2026-03-15");
  });
});
