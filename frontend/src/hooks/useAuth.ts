import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getProfileFromUser } from "../lib/authSession";
import { Profile } from "../lib/types";

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
};

const initialState: AuthState = {
  loading: true,
  session: null,
  profile: null
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let mounted = true;

    const handleSession = (session: Session | null) => {
      if (!mounted) return;
      if (!session) {
        setState({ loading: false, session: null, profile: null });
        return;
      }

      const profile = getProfileFromUser(session.user);
      setState({
        loading: false,
        session,
        profile: profile ?? {
          id: session.user.id,
          email: session.user.email ?? "",
          full_name: null,
          role: "user"
        }
      });
    };

    void supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      handleSession(session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
};
