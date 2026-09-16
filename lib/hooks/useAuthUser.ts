import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type AuthUserInfo = {
  loading: boolean;
  email: string | null;
  /** "google" | "apple" | "email" — nga cila metodë u krijua llogaria. */
  provider: string | null;
};

const EMPTY: AuthUserInfo = { loading: false, email: null, provider: null };

function fromUser(user: User | null): AuthUserInfo {
  if (!user) return EMPTY;
  return {
    loading: false,
    email: user.email ?? null,
    provider: (user.app_metadata?.provider as string | undefined) ?? null,
  };
}

/**
 * Email-i dhe metoda e kyçjes së përdoruesit aktual. Përditësohet vetë kur
 * sesioni ndryshon (kyçje, dalje, rifreskim tokeni).
 */
export function useAuthUser(): AuthUserInfo {
  const [info, setInfo] = useState<AuthUserInfo>({ ...EMPTY, loading: true });

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) setInfo(fromUser(data.user));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setInfo(fromUser(session?.user ?? null));
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return info;
}
