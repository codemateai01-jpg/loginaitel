import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, ArrowLeft, Building2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function ClientLogin() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      const response = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim().toLowerCase() },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to send OTP");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setStep("otp");
      toast({
        title: "OTP Sent!",
        description: `A 6-digit verification code has been sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("verify-otp", {
        body: { 
          email: email.trim().toLowerCase(),
          otp: otp,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to verify OTP");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const { isNewUser, tokenHash } = response.data;

      // Use the token to sign in
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: tokenHash,
          type: "email",
        });

        if (verifyError) {
          // Try magic link approach
          const { error: signInError } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: {
              shouldCreateUser: false,
            },
          });

          if (signInError) {
            console.log("Fallback sign in attempted");
          }
        }
      }

      // Check if we're now signed in
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData.session) {
        toast({
          title: isNewUser ? "Account Created!" : "Welcome back!",
          description: isNewUser 
            ? "Welcome to Aitel! Your client account has been created."
            : "You have been logged in successfully.",
        });
        navigate("/client");
      } else {
        // If session not established, try refreshing
        await supabase.auth.refreshSession();
        const { data: refreshedSession } = await supabase.auth.getSession();
        
        if (refreshedSession.session) {
          toast({
            title: isNewUser ? "Account Created!" : "Welcome back!",
            description: isNewUser 
              ? "Welcome to Aitel! Your client account has been created."
              : "You have been logged in successfully.",
          });
          navigate("/client");
        } else {
          // Manual sign in as last resort
          toast({
            title: "Verification Successful!",
            description: "Please check your email for the login link.",
          });
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim().toLowerCase() },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || "Failed to resend OTP");
      }

      toast({
        title: "OTP Resent!",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to resend OTP",
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
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Client Login</h1>
              <p className="text-sm text-muted-foreground">
                {step === "email" 
                  ? "Enter your email to receive a verification code" 
                  : "Enter the 6-digit code sent to your email"}
              </p>
            </div>
          </div>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-2 pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send a 6-digit verification code to your email
                </p>
              </div>

              <Button
                type="submit"
                className="w-full shadow-sm"
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-4">
                <Label>Enter Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="border-2" />
                      <InputOTPSlot index={1} className="border-2" />
                      <InputOTPSlot index={2} className="border-2" />
                      <InputOTPSlot index={3} className="border-2" />
                      <InputOTPSlot index={4} className="border-2" />
                      <InputOTPSlot index={5} className="border-2" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  OTP sent to {email}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full shadow-sm"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-primary hover:underline"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          <p className="text-sm text-muted-foreground text-center mt-6">
            New users will be automatically registered as clients.
          </p>
        </div>
      </main>
    </div>
  );
}
