import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Loader2, Check, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricePerCredit: number;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Credit packages with bulk discounts
const CREDIT_PACKAGES = [
  { credits: 100, discount: 0, popular: false },
  { credits: 500, discount: 5, popular: true },     // 5% off
  { credits: 1000, discount: 10, popular: false },  // 10% off
  { credits: 2500, discount: 15, popular: false },  // 15% off
  { credits: 5000, discount: 20, popular: false },  // 20% off
];

// Calculate discount based on custom amount
const getCustomDiscount = (credits: number): number => {
  if (credits >= 5000) return 20;
  if (credits >= 2500) return 15;
  if (credits >= 1000) return 10;
  if (credits >= 500) return 5;
  return 0;
};

export function BuyCreditsDialog({ 
  open, 
  onOpenChange, 
  pricePerCredit,
  onSuccess 
}: BuyCreditsDialogProps) {
  const [selectedCredits, setSelectedCredits] = useState(500);
  const [customCredits, setCustomCredits] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const credits = customCredits ? parseInt(customCredits) || 0 : selectedCredits;
  
  // Calculate discount
  const getDiscountPercent = () => {
    if (customCredits) {
      return getCustomDiscount(credits);
    }
    const pkg = CREDIT_PACKAGES.find(p => p.credits === selectedCredits);
    return pkg?.discount || 0;
  };
  
  const discountPercent = getDiscountPercent();
  const baseAmount = credits * pricePerCredit;
  const discountAmount = baseAmount * (discountPercent / 100);
  const amount = Math.round(baseAmount - discountAmount);

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

  const handlePayment = async () => {
    if (credits < 10) {
      toast.error("Minimum purchase is 10 credits");
      return;
    }

    setIsLoading(true);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway");
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please login to continue");
      }

      // Create order
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        "razorpay-create-order",
        {
          body: { amount, credits },
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
        name: "Aitel Credits",
        description: `Purchase ${credits} credits`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              "razorpay-verify-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  credits,
                  amount,
                },
              }
            );

            if (verifyError) {
              throw new Error(verifyError.message);
            }

            toast.success(`Successfully purchased ${credits} credits!`);
            onSuccess();
            onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            Purchase credits to make calls. Rate: ₹{pricePerCredit.toFixed(2)}/credit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Package Selection with Discounts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CREDIT_PACKAGES.map((pkg) => {
              const pkgBasePrice = pkg.credits * pricePerCredit;
              const pkgDiscount = pkgBasePrice * (pkg.discount / 100);
              const pkgFinalPrice = pkgBasePrice - pkgDiscount;
              
              return (
                <Card
                  key={pkg.credits}
                  className={`cursor-pointer transition-all hover:border-primary relative ${
                    selectedCredits === pkg.credits && !customCredits
                      ? "border-primary bg-primary/5"
                      : ""
                  } ${pkg.popular ? "ring-2 ring-primary/20" : ""}`}
                  onClick={() => {
                    setSelectedCredits(pkg.credits);
                    setCustomCredits("");
                  }}
                >
                  <CardContent className="p-3 text-center">
                    {pkg.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5">
                        Popular
                      </span>
                    )}
                    {pkg.discount > 0 && (
                      <span className="absolute -top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5">
                        {pkg.discount}% OFF
                      </span>
                    )}
                    <p className="text-xl font-bold">{pkg.credits.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">credits</p>
                    {pkg.discount > 0 ? (
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground line-through">
                          ₹{pkgBasePrice.toLocaleString()}
                        </p>
                        <p className="text-sm font-bold text-green-600">
                          ₹{Math.round(pkgFinalPrice).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-medium mt-1">
                        ₹{pkgBasePrice.toLocaleString()}
                      </p>
                    )}
                    {selectedCredits === pkg.credits && !customCredits && (
                      <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="custom-credits">Or enter custom amount</Label>
            <Input
              id="custom-credits"
              type="number"
              placeholder="Enter credits (min 10)"
              value={customCredits}
              onChange={(e) => setCustomCredits(e.target.value)}
              min={10}
            />
          </div>

          {/* Summary with Discount */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Credits to purchase</span>
                </div>
                <span className="font-bold">{credits.toLocaleString()}</span>
              </div>
              {discountPercent > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-muted-foreground line-through">₹{baseAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-green-600">
                    <span>Bulk Discount ({discountPercent}%)</span>
                    <span>-₹{Math.round(discountAmount).toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="font-medium">Total Amount</span>
                <span className="text-xl font-bold">₹{amount.toLocaleString()}</span>
              </div>
              {discountPercent > 0 && (
                <p className="text-xs text-green-600 text-center">
                  You save ₹{Math.round(discountAmount).toLocaleString()}!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pay Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePayment}
            disabled={isLoading || credits < 10}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay ₹{amount.toLocaleString()}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secured by Razorpay. Your payment information is encrypted.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
