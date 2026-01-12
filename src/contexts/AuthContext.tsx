import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/utils';

type UserRole = 'hospital_it' | 'provincial' | 'regional' | 'central_admin' | 'health_office' | 'supervisor';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  hospital_id: string | null;
  province_id: string | null;
  health_region_id: string | null;
  health_office_id: string | null;
  phone: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 12_000;
const PROFILE_TIMEOUT_MS = 12_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const profileReqIdRef = useRef(0);

  const clearLocalAuthState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const loadProfileOrSignOut = async (userId: string) => {
    const reqId = ++profileReqIdRef.current;
    setIsLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        PROFILE_TIMEOUT_MS,
        'PROFILE_TIMEOUT'
      );

      if (reqId !== profileReqIdRef.current) return;

      if (error || !data) {
        throw error ?? new Error('PROFILE_NOT_FOUND');
      }

      setProfile(data as Profile);
    } catch (err) {
      if (reqId !== profileReqIdRef.current) return;

      // สำคัญ: ถ้าโหลดโปรไฟล์ไม่ได้ ให้ logout ทันทีเพื่อไม่ให้หน้าเว็บค้าง (spinner ไม่จบ)
      try {
        await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS, 'SIGNOUT_TIMEOUT');
      } catch {
        // ignore
      } finally {
        clearLocalAuthState();
      }
    } finally {
      if (reqId === profileReqIdRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const handleSession = (nextSession: Session | null) => {
      if (cancelled) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        // invalidate any in-flight profile request
        profileReqIdRef.current++;
        setProfile(null);
        setIsLoading(false);
        return;
      }

      void loadProfileOrSignOut(nextSession.user.id);
    };

    // Rely on INITIAL_SESSION to avoid duplicate session/profile fetches.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    await loadProfileOrSignOut(user.id);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS,
        'SIGNIN_TIMEOUT'
      );

      if (error) return { error };

      // Check if user is approved (is_active)
      if (data.user) {
        const { data: profileData, error: profileError } = await withTimeout(
          supabase.from('profiles').select('is_active').eq('user_id', data.user.id).maybeSingle(),
          PROFILE_TIMEOUT_MS,
          'PROFILE_CHECK_TIMEOUT'
        );

        if (profileError) {
          await supabase.auth.signOut();
          return { error: new Error('ไม่สามารถตรวจสอบสถานะบัญชีได้') };
        }

        if (!profileData?.is_active) {
          await supabase.auth.signOut();
          return {
            error: new Error('บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ กรุณารอการอนุมัติ'),
          };
        }
      }

      return { error: null };
    } catch {
      // Timeout or unexpected error
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      return { error: new Error('ระบบตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName,
            },
          },
        }),
        AUTH_TIMEOUT_MS,
        'SIGNUP_TIMEOUT'
      );

      if (error || !data.user) {
        return { error };
      }

      // Ensure profiles row exists and mark as pending approval
      const { data: existingProfile, error: existingError } = await withTimeout(
        supabase.from('profiles').select('id').eq('user_id', data.user.id).maybeSingle(),
        PROFILE_TIMEOUT_MS,
        'PROFILE_LOOKUP_TIMEOUT'
      );

      if (existingError) {
        await supabase.auth.signOut();
        return { error: new Error('ไม่สามารถบันทึกข้อมูลผู้ใช้ได้') };
      }

      const profilePayload = {
        email,
        full_name: fullName,
        phone: phone || null,
        is_active: false,
      };

      const { error: writeError } = existingProfile
        ? await withTimeout(
            supabase.from('profiles').update(profilePayload).eq('user_id', data.user.id),
            PROFILE_TIMEOUT_MS,
            'PROFILE_WRITE_TIMEOUT'
          )
        : await withTimeout(
            supabase.from('profiles').insert({ user_id: data.user.id, ...profilePayload }),
            PROFILE_TIMEOUT_MS,
            'PROFILE_WRITE_TIMEOUT'
          );

      // Always force logout until approved (even if profile write fails)
      await supabase.auth.signOut();

      if (writeError) {
        return { error: new Error('ไม่สามารถบันทึกข้อมูลผู้ใช้ได้') };
      }

      return { error: null };
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      return { error: new Error('ระบบตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง') };
    }
  };

  const signOut = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS, 'SIGNOUT_TIMEOUT');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Always clear local state regardless of API response
      clearLocalAuthState();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

