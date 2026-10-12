/**
 * Lejet e Android-it që s'duhen bllokuar, sepse një modul native i përdor sapo
 * hapet app-i. Build-i i 12 tetorit 2026 rrëzohej në hapje në Android 14+:
 * DETECT_SCREEN_CAPTURE ishte te blockedPermissions, ndërsa expo-screen-capture
 * thërret registerScreenCaptureCallback (që e kërkon) që në OnCreate.
 */
import appJson from "../app.json";
import pkg from "../package.json";

const deps = { ...(pkg as { dependencies?: Record<string, string> }).dependencies };
const blocked: string[] = (appJson as { expo: { android?: { blockedPermissions?: string[] } } }).expo.android?.blockedPermissions ?? [];

/** Moduli → lejet që ai i kërkon në hapje (bllokimi i tyre e rrëzon app-in). */
const REQUIRED_AT_STARTUP: Record<string, string[]> = {
  "expo-screen-capture": ["android.permission.DETECT_SCREEN_CAPTURE"],
};

describe("lejet e Android-it", () => {
  it("s'bllokohet asnjë leje që kërkohet në hapje nga një modul i instaluar", () => {
    for (const [mod, perms] of Object.entries(REQUIRED_AT_STARTUP)) {
      if (!deps[mod]) continue;
      for (const p of perms) expect(blocked).not.toContain(p);
    }
  });
});
