import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

const ONBOARDING_KEY = "bebix_onboarding_seen";
const GUEST_MODE_KEY = "bebix_guest_mode";

type OnboardingStatus = {
  loading: boolean;
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
};

/**
 * Logjika e hyrjes:
 *   instalim i ri, pa session, pa zgjedhje    -> Welcome (2 opsione)
 *   zgjodhi "Vazhdo pa Login"                  -> Store (guest)
 *   ka kalu welcome-in, pa session, jo guest   -> Login
 *   session aktiv i Supabase                   -> Home (personalizuar)
 */
export function useOnboardingStatus(): OnboardingStatus {
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      const [seen, guest] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem(GUEST_MODE_KEY),
      ]);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setHasSeenOnboarding(seen === "true");
      setIsGuest(guest === "true");
      setIsAuthenticated(!!session);
      setLoading(false);
    }

    check();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session);
      // Sapo dikush ka session aktiv (u regjistrua ose hyri), s'është më guest.
      if (session) {
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_MODE_KEY);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { loading, hasSeenOnboarding, isAuthenticated, isGuest };
}

export async function markOnboardingSeen() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

/** Thirret kur përdoruesi zgjedh "Vazhdo te Dyqani pa Login". */
export async function markGuestMode() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  await AsyncStorage.setItem(GUEST_MODE_KEY, "true");
}