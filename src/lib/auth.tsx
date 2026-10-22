import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Linking } from "react-native";

import {
  deleteSecureStoreValue,
  readSecureStoreValue,
  writeSecureStoreValue,
} from "./secureStore";
import { supabase, supabaseConfigured } from "./supabase";

export interface ClubProfile {
  id: string;
  name: string;
  pin: string;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  club: ClubProfile | null;
  clubs: ClubProfile[];
  loadingClub: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  createClub: (name: string, pin: string) => Promise<ClubProfile>;
  joinClub: (name: string, pin: string) => Promise<ClubProfile>;
  clearClub: () => Promise<void>;
}

const CLUBS_KEY = "pitchpro_clubs";
const ACTIVE_CLUB_KEY = "pitchpro_active_club";
const LEGACY_CLUBS_KEY = "pitchpro_fanclubs";
const LEGACY_ACTIVE_CLUB_KEY = "pitchpro_active_fanclub";

function normalizeClubName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function isValidClubPin(pin: string) {
  return /^\d{6}$/.test(pin.trim());
}

function isServerClubId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseClubResponse(data: unknown, pin: string): ClubProfile {
  if (typeof data !== "object" || data === null) {
    throw new Error("Club response was invalid. Try again.");
  }
  const response = data as {
    id?: unknown;
    name?: unknown;
    ok?: unknown;
    message?: unknown;
  };
  if (
    response.ok !== true ||
    typeof response.id !== "string" ||
    typeof response.name !== "string"
  ) {
    throw new Error(
      typeof response.message === "string"
        ? response.message
        : "Club details could not be verified.",
    );
  }
  return { id: response.id, name: response.name, pin };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<ClubProfile[]>([]);
  const [club, setClub] = useState<ClubProfile | null>(null);
  const [loadingClub, setLoadingClub] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    let deepLinkHandled = false;
    const handleAuthUrl = async (url: string) => {
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      try {
        const parsedUrl = new URL(url);
        const query = new URLSearchParams(parsedUrl.search);
        const fragment = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
        const accessToken =
          fragment.get("access_token") ?? query.get("access_token");
        const refreshToken =
          fragment.get("refresh_token") ?? query.get("refresh_token");
        const code = query.get("code");
        if (accessToken && refreshToken) {
          deepLinkHandled = true;
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && active) setSession(data.session);
        } else if (code) {
          deepLinkHandled = true;
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!error && active) setSession(data.session);
        }
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active && !deepLinkHandled) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    const urlSubscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthUrl(url);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (url) return handleAuthUrl(url);
        return undefined;
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateClubState = async () => {
      try {
        const [clubsValue, activeValue, legacyClubsValue, legacyActiveValue] =
          await Promise.all([
            readSecureStoreValue(SecureStore, CLUBS_KEY),
            readSecureStoreValue(SecureStore, ACTIVE_CLUB_KEY),
            readSecureStoreValue(SecureStore, LEGACY_CLUBS_KEY),
            readSecureStoreValue(SecureStore, LEGACY_ACTIVE_CLUB_KEY),
          ]);

        if (!active) return;

        const storedClubs = clubsValue ?? legacyClubsValue;
        const cachedClubs = storedClubs
          ? (JSON.parse(storedClubs) as ClubProfile[])
          : [];
        const storedActiveClub = activeValue ?? legacyActiveValue;
        const cachedActiveClub = storedActiveClub
          ? (JSON.parse(storedActiveClub) as ClubProfile)
          : null;
        const validActiveClub =
          cachedActiveClub?.name && isServerClubId(cachedActiveClub.id)
            ? cachedActiveClub
            : null;

        const safeClubs = Array.isArray(cachedClubs) ? cachedClubs : [];
        setClubs(safeClubs);
        setClub(validActiveClub);

        if (!clubsValue && legacyClubsValue) {
          await writeSecureStoreValue(SecureStore, CLUBS_KEY, legacyClubsValue);
        }
        if (!activeValue && validActiveClub) {
          await writeSecureStoreValue(
            SecureStore,
            ACTIVE_CLUB_KEY,
            JSON.stringify(validActiveClub),
          );
        }
        if (legacyClubsValue)
          await deleteSecureStoreValue(SecureStore, LEGACY_CLUBS_KEY);
        if (legacyActiveValue)
          await deleteSecureStoreValue(SecureStore, LEGACY_ACTIVE_CLUB_KEY);

        if (cachedActiveClub && !validActiveClub) {
          await deleteSecureStoreValue(SecureStore, ACTIVE_CLUB_KEY);
        }
      } catch {
        if (active) {
          setClubs([]);
          setClub(null);
        }
      } finally {
        if (active) setLoadingClub(false);
      }
    };

    void hydrateClubState();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const createClub = async (name: string, pin: string) => {
    const trimmedName = normalizeClubName(name);
    if (!trimmedName || trimmedName.length < 2) {
      throw new Error("Enter a Club name.");
    }
    if (!isValidClubPin(pin)) {
      throw new Error("Enter a 6-digit PIN.");
    }
    if (!supabase)
      throw new Error("Configure Supabase before creating a Club.");

    const { data, error } = await supabase.rpc("create_club", {
      p_name: trimmedName,
      p_pin: pin.trim(),
    });
    if (error?.code === "23505") {
      throw new Error(
        "A Club with this name already exists. Try another name or join it with its PIN.",
      );
    }
    if (error) throw error;

    const newClub = parseClubResponse(data, pin.trim());
    const nextClubs = [
      ...clubs.filter((item) => item.id !== newClub.id),
      newClub,
    ];
    setClubs(nextClubs);
    setClub(newClub);
    await Promise.all([
      writeSecureStoreValue(SecureStore, CLUBS_KEY, JSON.stringify(nextClubs)),
      writeSecureStoreValue(
        SecureStore,
        ACTIVE_CLUB_KEY,
        JSON.stringify(newClub),
      ),
    ]);
    return newClub;
  };

  const joinClub = async (name: string, pin: string) => {
    const trimmedName = normalizeClubName(name);
    if (!trimmedName || !isValidClubPin(pin)) {
      throw new Error("Enter the Club name and 6-digit PIN.");
    }
    if (!supabase) throw new Error("Configure Supabase before joining a Club.");

    const legacyOwnedClub = clubs.find(
      (item) =>
        item.id.startsWith(`${session?.user.id ?? ""}-`) &&
        item.name.toLowerCase() === trimmedName.toLowerCase() &&
        item.pin === pin.trim(),
    );
    if (legacyOwnedClub) {
      const migration = await supabase.rpc("create_club", {
        p_name: trimmedName,
        p_pin: pin.trim(),
      });
      if (!migration.error) {
        const migratedClub = parseClubResponse(migration.data, pin.trim());
        const nextClubs = [
          ...clubs.filter((item) => item.id !== migratedClub.id),
          migratedClub,
        ];
        setClubs(nextClubs);
        setClub(migratedClub);
        await Promise.all([
          writeSecureStoreValue(
            SecureStore,
            CLUBS_KEY,
            JSON.stringify(nextClubs),
          ),
          writeSecureStoreValue(
            SecureStore,
            ACTIVE_CLUB_KEY,
            JSON.stringify(migratedClub),
          ),
        ]);
        return migratedClub;
      }
      if (migration.error.code !== "23505") throw migration.error;
    }

    const { data, error } = await supabase.rpc("join_club", {
      p_name: trimmedName,
      p_pin: pin.trim(),
    });
    if (error) throw error;

    const joinedClub = parseClubResponse(data, pin.trim());
    const nextClubs = [
      ...clubs.filter((item) => item.id !== joinedClub.id),
      joinedClub,
    ];
    setClubs(nextClubs);
    setClub(joinedClub);
    await Promise.all([
      writeSecureStoreValue(SecureStore, CLUBS_KEY, JSON.stringify(nextClubs)),
      writeSecureStoreValue(
        SecureStore,
        ACTIVE_CLUB_KEY,
        JSON.stringify(joinedClub),
      ),
    ]);
    return joinedClub;
  };

  const clearClub = async () => {
    await deleteSecureStoreValue(SecureStore, ACTIVE_CLUB_KEY);
    setClub(null);
  };

  const value: AuthContextValue = {
    session,
    loading,
    club,
    clubs,
    loadingClub,
    signIn: async (email, password) => {
      if (!supabase) throw new Error("Configure Supabase before signing in.");
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    signUp: async (fullName, email, password) => {
      if (!supabase)
        throw new Error("Configure Supabase before creating an account.");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error(
          "Email confirmation is enabled in Supabase. Disable it to sign in immediately after creating an account.",
        );
      }
      setSession(data.session);
    },
    signOut: async () => {
      if (!supabase) return;
      await clearClub();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    createClub,
    joinClub,
    clearClub,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be rendered inside AuthProvider.");
  return value;
}
