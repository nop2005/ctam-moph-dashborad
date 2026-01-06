import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    console.log('Fetching profile for user:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    console.log('Profile fetched:', data);
    return data as Profile | null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then(setProfile);
          }, 0);
        } else {
          setProfile(null);
        }

        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    // Check if user is approved (is_active)
    if (data.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        return { error: new Error('ไม่สามารถตรวจสอบสถานะบัญชีได้') };
      }

      // If no profile row OR not active -> block login until approved
      if (!profileData?.is_active) {
        await supabase.auth.signOut();
        return { error: new Error('บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ กรุณารอการอนุมัติ') };
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error || !data.user) {
      return { error };
    }

    // Ensure profiles row exists and mark as pending approval
    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle();

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
      ? await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('user_id', data.user.id)
      : await supabase
          .from('profiles')
          .insert({ user_id: data.user.id, ...profilePayload });

    // Always force logout until approved (even if profile write fails)
    await supabase.auth.signOut();

    if (writeError) {
      return { error: new Error('ไม่สามารถบันทึกข้อมูลผู้ใช้ได้') };
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Always clear local state regardless of API response
      setUser(null);
      setSession(null);
      setProfile(null);
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
