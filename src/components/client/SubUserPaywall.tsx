import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Lock, 
  CheckCircle,
  IndianRupee,
  Calendar,
  CreditCard,
  Loader2,
  Plus,
  Minus,
  Gift,
  Clock,
  AlertTriangle,
  Zap
} from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { toast } from "sonner";

interface SubUserPaywallProps {
  currentSeats: number;
  maxFreeSeats?: number;
  onPurchaseComplete?: () => void;
  onTrialStart?: () => void;
}

const SEAT_PRICE = 300; // ₹300 per seat per month
const TRIAL_DAYS = 7;
const TRIAL_SEATS = 10;

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface SeatSubscription {
  id: string;
  client_id: string;
  seats_count: number;
  status: string;
  razorpay_subscription_id: string | null;
  next_billing_date: string | null;
  last_payment_date: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  is_trial: boolean | null;
  autopay_enabled: boolean | null;
  autopay_setup_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SeatPayment {
  id: string;
  client_id: string;
  seats_count: number;
  amount: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export function SubUserPaywall({ currentSeats, maxFreeSeats = 0, onPurchaseComplete, onTrialStart }: SubUserPaywallProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [seatsToBuy, setSeatsToBuy] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  // Fetch seat subscription data
  const { data: subscription, isLoading: loadingSubscription, refetch } = useQuery({
    queryKey: ["seat-subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_subscriptions" as any)
        .select("*")
        .eq("client_id", user!.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as unknown as SeatSubscription | null;
    },
  });

  // Fetch seat payment history
  const { data: paymentHistory } = useQuery({
    queryKey: ["seat-payments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_payments" as any)
        .select("*")
        .eq("client_id", user!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as unknown as SeatPayment[];
    },
  });

  // Compute trial status
  const isOnTrial = subscription?.is_trial === true;
  const hasUsedTrial = subscription?.trial_started_at !== null;
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const now = new Date();
  const trialExpired = trialEndsAt ? now >= trialEndsAt : false;
  const trialDaysRemaining = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, now)) : 0;
  const trialHoursRemaining = trialEndsAt ? Math.max(0, differenceInHours(trialEndsAt, now)) : 0;
  const autopayEnabled = subscription?.autopay_enabled === true;
  
  const paidSeats = subscription?.seats_count || 0;
  const effectiveSeats = isOnTrial && !trialExpired ? TRIAL_SEATS : (autopayEnabled ? paidSeats : 0);
  const canAddMore = currentSeats < effectiveSeats;

  // Check if client can create sub-users
  const canCreateSubUsers = () => {
    if (!subscription) return false; // No subscription = no trial started
    if (isOnTrial && !trialExpired) return true; // Active trial
    if (autopayEnabled && paidSeats > 0) return true; // Autopay enabled with paid seats
    return false;
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-seat-trial");
      
      if (error) throw error;
      
      if (data.success) {
        toast.success("🎉 7-day free trial started!", {
          description: `You can now add up to ${TRIAL_SEATS} team members. Trial expires on ${format(new Date(data.trialEndsAt), "MMM dd, yyyy")}.`
        });
        refetch();
        queryClient.invalidateQueries({ queryKey: ["seat-subscription"] });
        queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
        onTrialStart?.();
      } else if (data.error === "trial_expired") {
        toast.error("Trial has expired", {
          description: "Please set up autopay to continue using team features."
        });
      } else {
        throw new Error(data.message || "Failed to start trial");
      }
    } catch (error: any) {
      console.error("Trial start error:", error);
      toast.error(error.message || "Failed to start trial");
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleSetupAutopay = async () => {
    if (seatsToBuy < 1) {
      toast.error("Please select at least 1 seat");
      return;
    }

    setIsLoading(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please login to continue");
      }

      // Create autopay order
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        "setup-seat-autopay",
        {
          body: { seats: seatsToBuy },
        }
      );

      if (orderError || !orderData) {
        throw new Error(orderError?.message || "Failed to create order");
      }

      // Initialize Razorpay
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Aitel Team Seats - Autopay Setup",
        description: `${seatsToBuy} seat(s) × ₹${SEAT_PRICE}/month - Monthly autopay`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              "razorpay-verify-seat-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  seats: seatsToBuy,
                  isAutopaySetup: true,
                },
              }
            );

            if (verifyError) {
              throw new Error(verifyError.message);
            }

            toast.success(`✅ Autopay setup complete!`, {
              description: `${seatsToBuy} seat(s) activated. You can now create team members.`
            });
            refetch();
            queryClient.invalidateQueries({ queryKey: ["seat-subscription"] });
            queryClient.invalidateQueries({ queryKey: ["seat-payments"] });
            queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
            onPurchaseComplete?.();
            setSeatsToBuy(1);
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          email: session.user.email,
        },
        theme: {
          color: "#000000",
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingSubscription) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalAmount = seatsToBuy * SEAT_PRICE;

  // Show trial start card if no subscription
  if (!subscription) {
    return (
      <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Start Your Free Trial
          </CardTitle>
          <CardDescription>
            Try team features free for {TRIAL_DAYS} days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-background border-2 border-border text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{TRIAL_DAYS}</p>
              <p className="text-xs text-muted-foreground">Days Free</p>
            </div>
            <div className="p-3 bg-background border-2 border-border text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{TRIAL_SEATS}</p>
              <p className="text-xs text-muted-foreground">Team Members</p>
            </div>
            <div className="p-3 bg-background border-2 border-border text-center">
              <CreditCard className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-sm font-bold text-green-500">No Card</p>
              <p className="text-xs text-muted-foreground">Required</p>
            </div>
          </div>

          <div className="p-4 bg-primary/10 border-2 border-primary/30">
            <h4 className="font-semibold mb-2">What's included in trial:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Add up to {TRIAL_SEATS} team members</li>
              <li>• All roles: Telecaller, Lead Manager, Monitoring</li>
              <li>• Full access to team features</li>
              <li>• No credit card required to start</li>
            </ul>
          </div>

          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500/50 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                After trial, set up autopay (₹{SEAT_PRICE}/seat/month) to continue using team features.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleStartTrial} 
            className="w-full" 
            size="lg"
            disabled={isStartingTrial}
          >
            {isStartingTrial ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting Trial...
              </>
            ) : (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Start {TRIAL_DAYS}-Day Free Trial
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Show trial active / expired state
  if (isOnTrial || (hasUsedTrial && !autopayEnabled)) {
    const trialProgress = trialEndsAt 
      ? Math.max(0, Math.min(100, ((TRIAL_DAYS - trialDaysRemaining) / TRIAL_DAYS) * 100))
      : 0;

    return (
      <Card className={trialExpired ? "border-2 border-destructive/50 bg-destructive/5" : "border-2 border-primary/50"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {trialExpired ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Trial Expired
                  </>
                ) : (
                  <>
                    <Gift className="h-5 w-5 text-primary" />
                    Free Trial Active
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {trialExpired 
                  ? "Set up autopay to continue using team features"
                  : `${trialDaysRemaining} days remaining (${trialHoursRemaining}h)`
                }
              </CardDescription>
            </div>
            {!trialExpired && (
              <Badge variant="default" className="bg-primary">
                <Clock className="h-3 w-3 mr-1" />
                Trial
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trial Progress */}
          {!trialExpired && trialEndsAt && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Trial Progress</span>
                <span className="font-medium">{trialDaysRemaining} days left</span>
              </div>
              <Progress value={trialProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Expires on {format(trialEndsAt, "MMM dd, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          {/* Current usage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 border-2 border-border text-center">
              <p className="text-2xl font-bold">{currentSeats}</p>
              <p className="text-xs text-muted-foreground">Current Members</p>
            </div>
            <div className="p-3 bg-muted/50 border-2 border-border text-center">
              <p className="text-2xl font-bold">{trialExpired ? 0 : TRIAL_SEATS}</p>
              <p className="text-xs text-muted-foreground">Available Seats</p>
            </div>
          </div>

          {/* Expired warning */}
          {trialExpired && (
            <div className="p-4 bg-destructive/10 border-2 border-destructive/30">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">
                    Team Features Locked
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your {TRIAL_DAYS}-day trial has ended. Set up autopay to unlock team features and continue using your team members.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Autopay Setup Section */}
          <div className="p-4 bg-primary/5 border-2 border-primary/30 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {trialExpired ? "Set Up Autopay to Continue" : "Set Up Autopay Now"}
            </h4>
            
            <div className="flex items-center gap-4">
              <Label htmlFor="seats" className="whitespace-nowrap">Number of Seats:</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSeatsToBuy(Math.max(1, seatsToBuy - 1))}
                  disabled={seatsToBuy <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  max={100}
                  value={seatsToBuy}
                  onChange={(e) => setSeatsToBuy(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSeatsToBuy(seatsToBuy + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {seatsToBuy} seat(s) × ₹{SEAT_PRICE}/month
              </span>
              <span className="text-xl font-bold text-primary">₹{totalAmount}/month</span>
            </div>
          </div>

          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Billed monthly via Razorpay</li>
            <li>• All roles included (Telecaller, Lead Manager, Monitoring)</li>
            <li>• Cancel anytime</li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSetupAutopay} 
            className="w-full" 
            size="lg"
            disabled={isLoading}
            variant={trialExpired ? "destructive" : "default"}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Set Up Autopay - ₹{totalAmount}/month
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Show active paid subscription
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Seats
            </CardTitle>
            <CardDescription>
              Manage your team member subscriptions
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Autopay Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seat Usage */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-muted/50 border-2 border-border text-center">
            <p className="text-2xl font-bold">{currentSeats}</p>
            <p className="text-xs text-muted-foreground">Current Members</p>
          </div>
          <div className="p-3 bg-muted/50 border-2 border-border text-center">
            <p className="text-2xl font-bold">{paidSeats}</p>
            <p className="text-xs text-muted-foreground">Paid Seats</p>
          </div>
          <div className="p-3 bg-muted/50 border-2 border-border text-center">
            <p className="text-2xl font-bold text-primary">₹{paidSeats * SEAT_PRICE}</p>
            <p className="text-xs text-muted-foreground">Monthly Cost</p>
          </div>
        </div>

        {/* Subscription Info */}
        <div className="p-4 bg-green-500/10 border-2 border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Autopay Enabled</span>
            </div>
            <Badge variant="default" className="bg-green-500">Active</Badge>
          </div>
          {subscription.next_billing_date && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Next Billing</span>
              </div>
              <span className="text-sm font-medium">
                {format(new Date(subscription.next_billing_date), "MMM dd, yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Add more seats */}
        {!canAddMore && (
          <div className="p-4 bg-amber-100 dark:bg-amber-900/20 border-2 border-amber-500/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  Seat Limit Reached
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Purchase additional seats to add more team members.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Additional Seats */}
        <div className="p-4 bg-muted/50 border-2 border-border space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Purchase Additional Seats
          </h4>
          
          <div className="flex items-center gap-4">
            <Label htmlFor="seats" className="whitespace-nowrap">Number of Seats:</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSeatsToBuy(Math.max(1, seatsToBuy - 1))}
                disabled={seatsToBuy <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="seats"
                type="number"
                min={1}
                max={100}
                value={seatsToBuy}
                onChange={(e) => setSeatsToBuy(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSeatsToBuy(seatsToBuy + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {seatsToBuy} seat(s) × ₹{SEAT_PRICE}/month
            </span>
            <span className="text-xl font-bold text-primary">₹{totalAmount}</span>
          </div>
        </div>

        {/* Payment History */}
        {paymentHistory && paymentHistory.length > 0 && (
          <div className="p-4 bg-muted/50 border-2 border-border">
            <h4 className="font-semibold mb-2">Recent Payments</h4>
            <div className="space-y-2">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {payment.seats_count} seat(s) - {format(new Date(payment.created_at), "MMM dd, yyyy")}
                  </span>
                  <span className="font-medium">₹{payment.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSetupAutopay} 
          className="w-full" 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add {seatsToBuy} More Seat(s) - ₹{totalAmount}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export { SEAT_PRICE, TRIAL_DAYS, TRIAL_SEATS };
