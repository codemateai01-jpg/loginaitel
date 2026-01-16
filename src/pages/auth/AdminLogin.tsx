import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mic, ArrowLeft, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe } from "@/hooks/useSessionTimeout";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMeState] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              role: "admin",
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Account created!",
          description: "You can now log in with your credentials.",
        });
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Check if user has admin role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleData?.role !== "admin") {
          await supabase.auth.signOut();
          throw new Error("You don't have admin access. Please use the correct login portal.");
        }

        // Set remember me preference
        setRememberMe(rememberMe);

        toast({
          title: "Welcome back, Admin!",
          description: "You have been logged in successfully.",
        });
        navigate("/admin");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 border-b-2 border-border">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <Mic className="h-8 w-8" />
          <span className="font-bold text-xl">Aitel</span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Role Selection
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-accent border-2 border-border">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isSignUp ? "Create Admin Account" : "Admin Login"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Platform administration access
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="border-2"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-2"
              />
            </div>

            {!isSignUp && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMeState(checked === true)}
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                  Remember me for 7 days
                </Label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full shadow-sm"
              disabled={loading}
            >
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Login"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="underline hover:text-foreground"
                >
                  Login
                </button>
              </>
            ) : (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="underline hover:text-foreground"
                >
                  Create one
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
