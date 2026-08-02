import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

const ONBOARDING_KEY = "bebix_onboarding_seen";

type OnboardingStatus = {
  loading: boolean;
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
};

/**
 * Same first-launch logic as the web version:
 *   fresh install, no session      -> Welcome carousel
 *   onboarding seen, no session     -> Login
 *   valid Supabase session          -> Home
 */
export function useOnboardingStatus(): OnboardingStatus {
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      const seen = (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setHasSeenOnboarding(seen);
      setIsAuthenticated(!!session);
      setLoading(false);
    }

    check();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setIsAuthenticated(!!session);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { loading, hasSeenOnboarding, isAuthenticated };
}

export async function markOnboardingSeen() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}
