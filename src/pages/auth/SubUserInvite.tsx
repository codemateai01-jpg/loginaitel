import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Eye, 
  Phone, 
  ClipboardList, 
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

const roleLabels: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  monitoring: { 
    label: "Monitoring Team", 
    icon: <Eye className="h-5 w-5" />, 
    description: "View call recordings, transcripts, and analytics"
  },
  telecaller: { 
    label: "Telecaller", 
    icon: <Phone className="h-5 w-5" />, 
    description: "Follow up on interested leads and make calls"
  },
  lead_manager: { 
    label: "Lead Manager", 
    icon: <ClipboardList className="h-5 w-5" />, 
    description: "Manage all leads, assignments, and pipeline"
  },
};

export default function SubUserInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: "",
    password: "",
    confirmPassword: "",
  });

  // Fetch invite details
  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sub_users")
        .select("id, email, full_name, role, status, invite_expires_at, client_id")
        .eq("invite_token", token)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Fetch client name
  const { data: client } = useQuery({
    queryKey: ["client-name", invite?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", invite!.client_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!invite?.client_id,
  });

  // Activate account mutation
  const activateAccount = useMutation({
    mutationFn: async (data: { password: string; fullName: string }) => {
      const { data: result, error } = await supabase.functions.invoke("activate-subuser", {
        body: {
          inviteToken: token,
          password: data.password,
          fullName: data.fullName,
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "Account activated!",
        description: "You can now log in with your credentials",
      });
      navigate("/login/client");
    },
    onError: (error: any) => {
      toast({
        title: "Activation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (invite?.full_name && !formData.fullName) {
      setFormData((prev) => ({ ...prev, fullName: invite.full_name || "" }));
    }
  }, [invite]);

  const isExpired = invite?.invite_expires_at && new Date(invite.invite_expires_at) < new Date();
  const isAlreadyActivated = invite?.status === "active";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    activateAccount.mutate({
      password: formData.password,
      fullName: formData.fullName,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/login/client")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please contact your administrator to send a new invite.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/login/client")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAlreadyActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <CardTitle>Already Activated</CardTitle>
            <CardDescription>
              This account has already been activated. You can log in with your credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/login/client")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleInfo = roleLabels[invite.role];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            <strong>{client?.full_name || client?.email || "Your organization"}</strong> has invited you to join their team on Aitel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role Info */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <Badge className="mb-2">
              <span className="flex items-center gap-1">
                {roleInfo?.icon}
                {roleInfo?.label}
              </span>
            </Badge>
            <p className="text-sm text-muted-foreground">
              {roleInfo?.description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invite.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={activateAccount.isPending}
            >
              {activateAccount.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Activate Account
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By activating your account, you agree to the terms of service and privacy policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
