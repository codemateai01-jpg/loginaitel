import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Mail, Phone, Building2, Save, Loader2, Shield, LogOut, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ClientSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    full_name: "",
  });

  // Phone update state
  const [newPhone, setNewPhone] = useState("");
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"input" | "verify">("input");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [signOutAllLoading, setSignOutAllLoading] = useState(false);
  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["client-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      
      setFormData({
        full_name: data.full_name || "",
      });
      
      return data;
    },
  });

  // Update profile mutation (for name only)
  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
        })
        .eq("user_id", user!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate();
  };

  const formatPhoneInput = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 10);
  };

  const extractPhoneDigits = (phone: string | null) => {
    if (!phone) return "";
    // Extract last 10 digits from the stored phone number
    const digits = phone.replace(/\D/g, "");
    return digits.slice(-10);
  };

  const handleSendPhoneOtp = async () => {
    if (newPhone.length !== 10) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number",
      });
      return;
    }

    setPhoneLoading(true);
    try {
      const response = await supabase.functions.invoke("send-otp", {
        body: { phone: newPhone },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || "Failed to send OTP");
      }

      setPhoneStep("verify");
      toast({
        title: "OTP Sent!",
        description: `Verification code sent to +91 ${newPhone}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error.message,
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyAndUpdatePhone = async () => {
    if (otp.length !== 6) return;

    setPhoneLoading(true);
    try {
      // Verify OTP
      const response = await supabase.functions.invoke("verify-phone-update", {
        body: { 
          phone: newPhone,
          otp: otp,
          userId: user?.id,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || "Failed to verify OTP");
      }

      toast({
        title: "Phone Number Updated!",
        description: "Your phone number has been verified and updated.",
      });

      setShowPhoneDialog(false);
      setPhoneStep("input");
      setNewPhone("");
      setOtp("");
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message,
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleOpenPhoneDialog = () => {
    setNewPhone(extractPhoneDigits(profile?.phone));
    setPhoneStep("input");
    setOtp("");
    setShowPhoneDialog(true);
  };

  const handleSignOutAllDevices = async () => {
    if (!user?.id) return;
    setSignOutAllLoading(true);

    try {
      // Clear all active sessions for this client
      const { error } = await supabase
        .from("client_active_sessions")
        .update({ is_active: false })
        .eq("client_id", user.id);

      if (error) throw error;

      toast({
        title: "All Devices Signed Out",
        description:
          "All other devices have been signed out. You will need to log in again on those devices.",
      });

      // Sign out the current user as well so they re-authenticate fresh
      await supabase.auth.signOut();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to sign out devices",
        description: err.message || "Something went wrong",
      });
    } finally {
      setSignOutAllLoading(false);
    }
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your company and contact information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profile?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    System-generated email for your account
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Company / Full Name</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Your company name"
                    />
                  </div>
                </div>

                <Separator />

                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Phone Number Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Number
            </CardTitle>
            <CardDescription>
              Your verified phone number for login and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border-2 border-border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent border border-border rounded">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">
                    {profile?.phone ? (
                      <>+91 {extractPhoneDigits(profile.phone)}</>
                    ) : (
                      <span className="text-muted-foreground">No phone number set</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.phone ? "Verified phone number" : "Add a phone number for secure access"}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleOpenPhoneDialog}>
                {profile?.phone ? "Change" : "Add"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Changing your phone number requires OTP verification
            </p>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account ID</p>
                <p className="font-mono text-sm">{user?.id?.slice(0, 12)}...</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Type</p>
                <p className="text-sm">Client</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-sm">
                  {profile?.created_at 
                    ? new Date(profile.created_at).toLocaleDateString() 
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-sm">
                  {profile?.updated_at 
                    ? new Date(profile.updated_at).toLocaleDateString() 
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security / Sessions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage your active login sessions across devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border-2 border-destructive/30 rounded-lg bg-destructive/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                  <LogOut className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Sign out all devices</p>
                  <p className="text-xs text-muted-foreground">
                    This will log you out everywhere, including this device
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={signOutAllLoading}>
                    {signOutAllLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sign out all"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out all devices?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will terminate all active sessions, including the current one. You'll
                      need to log in again on every device.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOutAllDevices}>
                      Yes, sign out everywhere
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phone Update Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {phoneStep === "input" ? "Update Phone Number" : "Verify OTP"}
            </DialogTitle>
            <DialogDescription>
              {phoneStep === "input" 
                ? "Enter your new phone number. We'll send an OTP for verification."
                : `Enter the 6-digit code sent to +91 ${newPhone}`
              }
            </DialogDescription>
          </DialogHeader>

          {phoneStep === "input" ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Phone Number</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">+91</span>
                  </div>
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(formatPhoneInput(e.target.value))}
                    className="pl-20"
                    maxLength={10}
                  />
                </div>
              </div>
              <Button 
                onClick={handleSendPhoneOtp} 
                disabled={phoneLoading || newPhone.length !== 10}
                className="w-full"
              >
                {phoneLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Send OTP
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
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
              </div>
              <Button 
                onClick={handleVerifyAndUpdatePhone} 
                disabled={phoneLoading || otp.length !== 6}
                className="w-full"
              >
                {phoneLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Verify & Update
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep("input");
                    setOtp("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={phoneLoading}
                  className="text-primary hover:underline"
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
