/**
 * Kthimi pas hyrjes me Google (29 tetor): në Expo Go adresa exp://<IP>:8081 ndryshon me rrjetin dhe Supabase e
 * refuzonte, ndaj përdoruesi përfundonte te webi. Tani Expo Go kalon përmes faqes së webit, që e kthen te app-i;
 * build-et vazhdojnë drejt te bebix://auth/callback.
 */
import { WEB_AUTH_RETURN, authCallbackUrl, authRedirectTo } from "@/lib/auth/callbackUrl";

// jest.mock ngrihet mbi importet: moduli merr këto mock-e.
let mockEnv = "storeClient";
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockEnv;
    },
  },
  ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" },
}));
jest.mock("expo-linking", () => ({ createURL: (path: string) => `exp://192.168.1.5:8081/--/${path}` }));

describe("adresa e kthimit pas hyrjes", () => {
  it("Expo Go: Supabase kthehet te faqja e webit, e cila e çon te adresa e Expo Go-së", () => {
    mockEnv = "storeClient";
    expect(authCallbackUrl()).toBe("exp://192.168.1.5:8081/--/auth/callback");
    const redirect = authRedirectTo();
    expect(redirect.startsWith(`${WEB_AUTH_RETURN}?to=`)).toBe(true);
    expect(new URL(redirect).hostname).toBe("www.bebix.store"); // domain-i i Site URL: Supabase e pranon gjithmonë
    expect(new URL(redirect).searchParams.get("to")).toBe(authCallbackUrl());
  });

  it("build-et (zhvillim dhe dyqanet): drejt te bebix://auth/callback, pa kaluar nga webi", () => {
    for (const env of ["standalone", "bare"]) {
      mockEnv = env;
      expect(authCallbackUrl()).toBe("bebix://auth/callback");
      expect(authRedirectTo()).toBe("bebix://auth/callback");
    }
  });
});
