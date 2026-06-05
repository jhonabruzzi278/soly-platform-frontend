import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Profile } from "./types";

export const getProfileFromUser = (user: User | null): Profile | null => {
  if (!user) return null;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: typeof meta?.full_name === "string" ? meta.full_name : null,
    role: meta?.role === "admin" ? "admin" : "user"
  };
};

export const signOutCurrentSession = async () => {
  await supabase.auth.signOut();
};
