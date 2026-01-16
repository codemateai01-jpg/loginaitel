import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "engineer" | "client";
type SubUserRole = "monitoring" | "telecaller" | "lead_manager" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  subUserRole: SubUserRole;
  isSubUser: boolean;
  clientId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [subUserRole, setSubUserRole] = useState<SubUserRole>(null);
  const [isSubUser, setIsSubUser] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRoles = async (userId: string) => {
    // Fetch main role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    setRole(roleData?.role as AppRole ?? null);

    // Check if user is a sub-user
    const { data: subUserData } = await supabase
      .from("client_sub_users")
      .select("role, client_id, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (subUserData) {
      setIsSubUser(true);
      setSubUserRole(subUserData.role as SubUserRole);
      setClientId(subUserData.client_id);
    } else {
      setIsSubUser(false);
      setSubUserRole(null);
      setClientId(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(() => fetchUserRoles(session.user.id), 0);
        } else {
          setRole(null);
          setSubUserRole(null);
          setIsSubUser(false);
          setClientId(null);
          setLoading(false);
        }
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setSubUserRole(null);
    setIsSubUser(false);
    setClientId(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, subUserRole, isSubUser, clientId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper to get redirect path based on sub-user role
export function getSubUserRedirectPath(subUserRole: SubUserRole): string {
  switch (subUserRole) {
    case "telecaller":
      return "/client/telecaller";
    case "lead_manager":
      return "/client/lead-manager";
    case "monitoring":
      return "/client/monitoring";
    default:
      return "/client";
  }
}
