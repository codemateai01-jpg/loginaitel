import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mic, ArrowLeft, Building2, Phone, AlertTriangle, Users, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { setRememberMe } from "@/hooks/useSessionTimeout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionConflict {
  device: string;
  lastActivity: string;
  loggedInAt: string;
  upgradeMessage: string;
}

export default function ClientLogin() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMeState] = useState(false);
  const [sessionConflict, setSessionConflict] = useState<SessionConflict | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const formatDisplayPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.slice(0, 10);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        throw new Error("Please enter a valid 10-digit phone number");
      }

      const response = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanPhone },
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
        description: `A 6-digit verification code has been sent to +91 ${phone}`,
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

  const handleVerifyOtp = async (e: React.FormEvent, forceLogin = false) => {
    e.preventDefault();
    setLoading(true);
    setShowConflictDialog(false);

    try {
      const deviceIdKey = "aitel_device_id";
      const existingDeviceId = localStorage.getItem(deviceIdKey);
      const deviceId =
        existingDeviceId ??
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `dev_${Math.random().toString(36).slice(2)}`);

      if (!existingDeviceId) {
        localStorage.setItem(deviceIdKey, deviceId);
      }

      const deviceLabel = `${navigator.platform} ${navigator.userAgent
        .split(" ")
        .slice(-2)
        .join(" ")}`.trim();
      const deviceInfo = `${deviceId}::${deviceLabel}`;
      const response = await supabase.functions.invoke("verify-otp", {
        body: {
          phone: phone.replace(/\D/g, ""),
          otp: otp,
          forceLogin,
          deviceInfo,
        },
      });

      // If the function returns a non-2xx, `invoke` returns { error, response } where
      // `response` is the real Response object (status + body).
      // We'll parse it so we can show the exact backend error to the user.
      let httpStatus: number | undefined;
      let errorBody: any = null;

      if (response.response) {
        try {
          const res = response.response;
          httpStatus = res.status;
          const text = await res.clone().text();
          try {
            errorBody = text ? JSON.parse(text) : null;
          } catch {
            errorBody = text ? { raw: text } : null;
          }
        } catch {
          // ignore parsing errors
        }
      }

      // Check for session conflict (409)
      const errorMessage = response.error?.message || "";
      const isSessionConflict =
        httpStatus === 409 ||
        errorBody?.error === "session_conflict" ||
        errorMessage.includes("session_conflict") ||
        response.data?.error === "session_conflict";

      if (isSessionConflict) {
        const conflictData = errorBody || response.data;

        const rawDevice = conflictData?.existingSession?.device;
        const deviceDisplay =
          typeof rawDevice === "string" ? rawDevice.split("::")[1] || rawDevice : "Unknown device";

        setSessionConflict({
          device: deviceDisplay,
          lastActivity: conflictData?.existingSession?.lastActivity || "Recently",
          loggedInAt: conflictData?.existingSession?.loggedInAt || "",
          upgradeMessage:
            conflictData?.upgradeMessage ||
            "Purchase team seats to enable multi-device access for your team.",
        });

        setShowConflictDialog(true);
        setLoading(false);
        return;
      }

      if (response.error) {
        const msgFromBody =
          errorBody?.error ||
          errorBody?.message ||
          (typeof errorBody?.raw === "string" ? errorBody.raw : "");

        const statusSuffix = httpStatus ? ` (status ${httpStatus})` : "";
        throw new Error(
          `${msgFromBody || response.error.message || "Failed to verify OTP"}${statusSuffix}`
        );
      }

      if (response.data?.error && response.data.error !== "session_conflict") {
        throw new Error(response.data.error);
      }

      const { isNewUser, isSubUser, subUserRole, session } = response.data;

      if (session) {
        // Set the session directly from the edge function response
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        // Set remember me preference
        setRememberMe(rememberMe);

        toast({
          title: isNewUser ? "Account Created!" : "Welcome back!",
          description: isNewUser 
            ? "Welcome to Aitel! Your account has been created."
            : "You have been logged in successfully.",
        });
        
        // Redirect based on sub-user role (from edge function response)
        if (isSubUser && subUserRole) {
          switch (subUserRole) {
            case "telecaller":
              navigate("/client/telecaller");
              break;
            case "lead_manager":
              navigate("/client/lead-manager");
              break;
            case "monitoring":
              navigate("/client/monitoring");
              break;
            default:
              navigate("/client");
          }
        } else {
          navigate("/client");
        }
      } else {
        throw new Error("Session not created. Please try again.");
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

  const handleForceLogin = (e: React.FormEvent) => {
    handleVerifyOtp(e, true);
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("send-otp", {
        body: { phone: phone.replace(/\D/g, "") },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || "Failed to resend OTP");
      }

      toast({
        title: "OTP Resent!",
        description: "A new verification code has been sent to your phone.",
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
      {/* Session Conflict Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Already Logged In
            </DialogTitle>
            <DialogDescription>
              You are currently logged in on another device. Single-device login is enforced for your account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 border-2 border-border space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Current Session:</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{sessionConflict?.device}</p>
              <p className="text-xs text-muted-foreground pl-6">Last active: {sessionConflict?.lastActivity}</p>
            </div>

            <div className="p-4 bg-primary/5 border-2 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Need Multi-Device Access?</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {sessionConflict?.upgradeMessage || "Purchase team seats to enable multi-device login for your team."}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/client/team")}
              className="w-full sm:w-auto"
            >
              <Users className="h-4 w-4 mr-2" />
              View Team Seats
            </Button>
            <Button
              onClick={handleForceLogin}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Signing in..." : "Sign Out Other Device & Login Here"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                {step === "phone" 
                  ? "Enter your phone number to receive a verification code" 
                  : "Enter the 6-digit code sent to your phone"}
              </p>
            </div>
          </div>

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(formatDisplayPhone(e.target.value))}
                    required
                    className="border-2 pl-20"
                    maxLength={10}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send a 6-digit verification code via SMS
                </p>
              </div>

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

              <Button
                type="submit"
                className="w-full shadow-sm"
                disabled={loading || phone.length !== 10}
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
                  OTP sent to +91 {phone}
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
                    setStep("phone");
                    setOtp("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change phone number
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
            Clients and team members can login using their registered phone number.
          </p>
        </div>
      </main>
    </div>
  );
}
