import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, ArrowLeft, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function ClientLogin() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate OTP send - will be replaced with actual auth
    setTimeout(() => {
      toast({
        title: "OTP Sent!",
        description: "Please check your phone for the verification code.",
      });
      setOtpSent(true);
      setLoading(false);
    }, 1000);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate OTP verification - will be replaced with actual auth
    setTimeout(() => {
      toast({
        title: "Welcome!",
        description: "You have been logged in successfully.",
      });
      navigate("/client");
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 border-b-2 border-border">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <Mic className="h-8 w-8" />
          <span className="font-bold text-xl">VoiceAI</span>
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
                OTP-based secure access
              </p>
            </div>
          </div>

          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="border-2"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send you a one-time verification code
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
              <div className="space-y-2">
                <Label>Enter OTP</Label>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="border-2 border-border" />
                    <InputOTPSlot index={1} className="border-2 border-border" />
                    <InputOTPSlot index={2} className="border-2 border-border" />
                    <InputOTPSlot index={3} className="border-2 border-border" />
                    <InputOTPSlot index={4} className="border-2 border-border" />
                    <InputOTPSlot index={5} className="border-2 border-border" />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-muted-foreground">
                  Sent to {phone}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full shadow-sm"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setOtpSent(false)}
              >
                Change Phone Number
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
