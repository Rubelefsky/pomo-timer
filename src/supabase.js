import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the build was given Supabase credentials (see .env.example). */
export const configured = Boolean(url && anonKey);

// On iOS/Android keep the auth session in native app storage rather than
// WebView localStorage, which the OS may evict under storage pressure.
const nativeStorage = {
  getItem: async key => (await Preferences.get({ key })).value,
  setItem: async (key, value) => { await Preferences.set({ key, value }); },
  removeItem: async key => { await Preferences.remove({ key }); },
};

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        storage: Capacitor.isNativePlatform() ? nativeStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
