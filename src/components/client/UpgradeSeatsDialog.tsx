import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Minus,
  TrendingUp,
  Calculator,
  CheckCircle,
  Calendar,
  Loader2,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface UpgradeSeatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSeats: number;
  nextBillingDate: string | null;
  onComplete?: () => void;
}

const SEAT_PRICE = 300;

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function UpgradeSeatsDialog({
  open,
  onOpenChange,
  currentSeats,
  nextBillingDate,
  onComplete,
}: UpgradeSeatsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [additionalSeats, setAdditionalSeats] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [proratedInfo, setProratedInfo] = useState<{
    proratedAmount: number;
    fullMonthlyPrice: number;
    savingsAmount: number;
    daysRemaining: number;
    totalDays: number;
  } | null>(null);

  const newTotalSeats = currentSeats + additionalSeats;
  const fullPrice = additionalSeats * SEAT_PRICE;

  // Calculate estimated proration locally (server will confirm)
  const calculateEstimatedProration = () => {
    if (!nextBillingDate) {
      return { proratedAmount: fullPrice, daysRemaining: 30, totalDays: 30 };
    }
    
    const now = new Date();
    const billing = new Date(nextBillingDate);
    const daysRemaining = Math.max(1, Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = 30;
    const proratedAmount = Math.ceil((SEAT_PRICE / totalDays) * daysRemaining * additionalSeats);
    
    return { proratedAmount, daysRemaining, totalDays };
  };

  const estimated = calculateEstimatedProration();

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

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Failed to load payment gateway");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please login to continue");

      // Create upgrade order
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        "upgrade-seats",
        { body: { additionalSeats } }
      );

      if (orderError || !orderData) {
        throw new Error(orderError?.message || orderData?.error || "Failed to create order");
      }

      // Store prorated info from server
      setProratedInfo({
        proratedAmount: orderData.proratedAmount,
        fullMonthlyPrice: orderData.fullMonthlyPrice,
        savingsAmount: orderData.savingsAmount,
        daysRemaining: orderData.daysRemaining,
        totalDays: orderData.totalDays,
      });

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Aitel Seat Upgrade",
        description: `+${additionalSeats} seats (prorated)`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke(
              "razorpay-verify-seat-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  seats: additionalSeats,
                  isAutopaySetup: false, // This is an upgrade, not autopay setup
                },
              }
            );

            if (verifyError) throw new Error(verifyError.message);

            toast.success("🎉 Upgrade successful!", {
              description: `Added ${additionalSeats} seat(s). Total: ${newTotalSeats} seats`,
            });
            queryClient.invalidateQueries({ queryKey: ["seat-subscription"] });
            queryClient.invalidateQueries({ queryKey: ["seat-subscription-team"] });
            queryClient.invalidateQueries({ queryKey: ["seat-subscription-history"] });
            queryClient.invalidateQueries({ queryKey: ["seat-payments-history"] });
            queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
            onOpenChange(false);
            onComplete?.();
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            toast.error("Payment verification failed. Contact support.");
          } finally {
            setIsLoading(false);
          }
        },
        prefill: { email: session.user.email },
        theme: { color: "#000000" },
        modal: {
          ondismiss: () => setIsLoading(false),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error(error.message || "Failed to process upgrade");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Upgrade Team Seats
          </DialogTitle>
          <DialogDescription>
            Add more seats to your subscription with prorated billing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Subscription */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Seats</span>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {currentSeats} seats
                </Badge>
              </div>
              {nextBillingDate && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Next Billing</span>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(nextBillingDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seat Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Additional Seats</label>
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setAdditionalSeats(Math.max(1, additionalSeats - 1))}
                disabled={additionalSeats <= 1}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <div className="text-4xl font-bold">+{additionalSeats}</div>
                <div className="text-sm text-muted-foreground">
                  seat{additionalSeats !== 1 ? "s" : ""}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setAdditionalSeats(additionalSeats + 1)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* New Total */}
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">New Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{currentSeats}</span>
                  <span className="text-primary">→</span>
                  <Badge className="text-lg px-3 py-1">
                    {newTotalSeats} seats
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Pricing Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4" />
              Prorated Pricing
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Full monthly price ({additionalSeats} × ₹{SEAT_PRICE})</span>
                <span className="line-through">₹{fullPrice}</span>
              </div>
              
              <div className="flex justify-between text-muted-foreground">
                <span>Remaining days in period</span>
                <span>~{estimated.daysRemaining} days</span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="flex justify-between font-semibold text-base">
                <span>Pay today (prorated)</span>
                <span className="text-primary">~₹{estimated.proratedAmount}</span>
              </div>

              {estimated.proratedAmount < fullPrice && (
                <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg p-2 mt-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    You save ₹{fullPrice - estimated.proratedAmount} with prorated billing!
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              * Starting next billing cycle, you'll be charged ₹{newTotalSeats * SEAT_PRICE}/month for {newTotalSeats} seats
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay ~₹{estimated.proratedAmount}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
