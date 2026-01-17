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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Phone,
  Eye,
  ClipboardList,
  Plus,
  Minus,
  CreditCard,
  Gift,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

interface AddSubUserWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface SubUserSlot {
  full_name: string;
  phone: string;
  department: string;
  role: "monitoring" | "telecaller" | "lead_manager";
}

const SEAT_PRICE = 300;
const TRIAL_DAYS = 7;

const roleConfig = {
  monitoring: {
    label: "Monitoring Team",
    icon: <Eye className="h-5 w-5" />,
    description: "Can view call recordings, transcripts, and analytics",
    color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  telecaller: {
    label: "Telecaller",
    icon: <Phone className="h-5 w-5" />,
    description: "Can follow up on interested leads and make calls",
    color: "border-green-500 bg-green-50 dark:bg-green-950/30",
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  lead_manager: {
    label: "Lead Manager",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "Can manage all leads, assignments, and pipeline",
    color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  },
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function AddSubUserWizard({ open, onOpenChange, onComplete }: AddSubUserWizardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Steps: 1 = Choose Role, 2 = Choose Quantity, 3 = Payment/Trial, 4 = Fill Details
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<"monitoring" | "telecaller" | "lead_manager" | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentType, setPaymentType] = useState<"trial" | "pay" | null>(null);
  const [userSlots, setUserSlots] = useState<SubUserSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const totalAmount = quantity * SEAT_PRICE;

  const resetWizard = () => {
    setStep(1);
    setSelectedRole(null);
    setQuantity(1);
    setPaymentType(null);
    setUserSlots([]);
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  const formatDisplayPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.slice(0, 10);
  };

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("91") && cleaned.length === 10) {
      cleaned = "91" + cleaned;
    }
    return "+" + cleaned;
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
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-seat-trial", {
        body: { seats: quantity },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("🎉 Free trial started!", {
          description: `${TRIAL_DAYS} days free for ${quantity} seat(s)`,
        });
        initializeUserSlots();
        setStep(4);
      } else if (data.error === "trial_expired" || data.error === "trial_exists") {
        toast.error("Trial already used. Please proceed with payment.");
        setPaymentType("pay");
      } else {
        throw new Error(data.message || "Failed to start trial");
      }
    } catch (error: any) {
      console.error("Trial start error:", error);
      toast.error(error.message || "Failed to start trial");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Failed to load payment gateway");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please login to continue");

      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        "setup-seat-autopay",
        { body: { seats: quantity } }
      );

      if (orderError || !orderData) throw new Error(orderError?.message || "Failed to create order");

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Aitel Team Seats",
        description: `${quantity} ${selectedRole ? roleConfig[selectedRole].label : "seat"}(s) × ₹${SEAT_PRICE}/month`,
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
                  seats: quantity,
                  isAutopaySetup: true,
                },
              }
            );

            if (verifyError) throw new Error(verifyError.message);

            toast.success("Payment successful!", {
              description: `${quantity} seat(s) ready. Now add team member details.`,
            });
            queryClient.invalidateQueries({ queryKey: ["seat-subscription"] });
            initializeUserSlots();
            setStep(4);
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            toast.error("Payment verification failed. Contact support.");
          }
        },
        prefill: { email: session.user.email },
        theme: { color: "#000000" },
        modal: { ondismiss: () => setIsLoading(false) },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
      setIsLoading(false);
    }
  };

  const initializeUserSlots = () => {
    const slots: SubUserSlot[] = [];
    for (let i = 0; i < quantity; i++) {
      slots.push({
        full_name: "",
        phone: "",
        department: "",
        role: selectedRole || "telecaller",
      });
    }
    setUserSlots(slots);
  };

  const updateSlot = (index: number, field: keyof SubUserSlot, value: string) => {
    setUserSlots((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCreateUsers = async () => {
    // Validate all slots
    for (let i = 0; i < userSlots.length; i++) {
      const slot = userSlots[i];
      if (!slot.full_name.trim()) {
        toast.error(`Please enter name for user ${i + 1}`);
        return;
      }
      if (slot.phone.length !== 10) {
        toast.error(`Please enter valid phone for user ${i + 1}`);
        return;
      }
    }

    setIsLoading(true);
    try {
      for (const slot of userSlots) {
        const formattedPhone = formatPhoneNumber(slot.phone);

        const insertData = {
          client_id: user!.id,
          phone: formattedPhone,
          full_name: slot.full_name,
          role: slot.role,
          status: "pending",
          invited_at: new Date().toISOString(),
          email: null,
        };

        const { error } = await supabase
          .from("client_sub_users")
          .insert(insertData as any);

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique")) {
            toast.error(`Phone ${slot.phone} already exists`);
            continue;
          }
          throw error;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
      queryClient.invalidateQueries({ queryKey: ["seat-subscription"] });
      toast.success(`${userSlots.length} team member(s) added!`);
      handleClose();
      onComplete?.();
    } catch (error: any) {
      console.error("Create users error:", error);
      toast.error(error.message || "Failed to create users");
    } finally {
      setIsLoading(false);
    }
  };

  const canProceedStep1 = selectedRole !== null;
  const canProceedStep2 = quantity >= 1;
  const canProceedStep3 = paymentType !== null;

  const progressValue = (step / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Team Members
            </DialogTitle>
            <Badge variant="outline">Step {step} of 4</Badge>
          </div>
          <Progress value={progressValue} className="h-2 mt-4" />
        </DialogHeader>

        {/* Step 1: Choose Role */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <DialogDescription className="text-base font-medium">
              What type of team member do you want to add?
            </DialogDescription>
            <div className="grid gap-3">
              {(Object.entries(roleConfig) as [keyof typeof roleConfig, typeof roleConfig.monitoring][]).map(
                ([key, config]) => (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all ${
                      selectedRole === key
                        ? `border-2 ${config.color}`
                        : "border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedRole(key)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={`p-3 rounded-lg ${selectedRole === key ? config.badgeColor : "bg-muted"}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{config.label}</h4>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                      {selectedRole === key && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>
        )}

        {/* Step 2: Choose Quantity */}
        {step === 2 && (
          <div className="space-y-6 py-4">
            <DialogDescription className="text-base font-medium">
              How many {selectedRole ? roleConfig[selectedRole].label : "team members"} do you need?
            </DialogDescription>
            <Card className="p-6">
              <div className="flex items-center justify-center gap-6">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <div className="text-center">
                  <div className="text-5xl font-bold">{quantity}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {quantity === 1 ? "user" : "users"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </Card>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Monthly cost</span>
              <span className="text-2xl font-bold">₹{totalAmount}</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              ₹{SEAT_PRICE} per user per month
            </p>
          </div>
        )}

        {/* Step 3: Payment or Trial */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            <DialogDescription className="text-base font-medium">
              Choose how you want to proceed
            </DialogDescription>
            <div className="grid gap-3">
              {/* Free Trial Option */}
              <Card
                className={`cursor-pointer transition-all ${
                  paymentType === "trial"
                    ? "border-2 border-primary bg-primary/5"
                    : "border hover:border-primary/50"
                }`}
                onClick={() => setPaymentType("trial")}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`p-3 rounded-lg ${paymentType === "trial" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Start {TRIAL_DAYS}-Day Free Trial</h4>
                    <p className="text-sm text-muted-foreground">
                      Try free for {TRIAL_DAYS} days, then ₹{totalAmount}/month
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Free
                  </Badge>
                </CardContent>
              </Card>

              {/* Pay Now Option */}
              <Card
                className={`cursor-pointer transition-all ${
                  paymentType === "pay"
                    ? "border-2 border-primary bg-primary/5"
                    : "border hover:border-primary/50"
                }`}
                onClick={() => setPaymentType("pay")}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`p-3 rounded-lg ${paymentType === "pay" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Pay Now with Autopay</h4>
                    <p className="text-sm text-muted-foreground">
                      Set up monthly autopay via Razorpay
                    </p>
                  </div>
                  <Badge>₹{totalAmount}/mo</Badge>
                </CardContent>
              </Card>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <Users className="h-4 w-4 inline mr-2" />
              {quantity} × {selectedRole ? roleConfig[selectedRole].label : "team members"} = ₹{totalAmount}/month after trial
            </div>
          </div>
        )}

        {/* Step 4: Fill User Details */}
        {step === 4 && (
          <div className="space-y-4 py-4">
            <DialogDescription className="text-base font-medium">
              Enter details for your team members
            </DialogDescription>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {userSlots.map((slot, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      User {index + 1}
                    </h4>
                    <Badge className={roleConfig[slot.role].badgeColor}>
                      {roleConfig[slot.role].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        placeholder="John Doe"
                        value={slot.full_name}
                        onChange={(e) => updateSlot(index, "full_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          +91
                        </span>
                        <Input
                          placeholder="9876543210"
                          value={slot.phone}
                          onChange={(e) => updateSlot(index, "phone", formatDisplayPhone(e.target.value))}
                          className="pl-12"
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        placeholder="Sales"
                        value={slot.department}
                        onChange={(e) => updateSlot(index, "department", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={slot.role}
                        onValueChange={(value: "monitoring" | "telecaller" | "lead_manager") =>
                          updateSlot(index, "role", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                {config.icon}
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isLoading}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div className="flex-1" />

          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={paymentType === "trial" ? handleStartTrial : handlePayment}
              disabled={!canProceedStep3 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : paymentType === "trial" ? (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Start Free Trial
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ₹{totalAmount}
                </>
              )}
            </Button>
          )}

          {step === 4 && (
            <Button onClick={handleCreateUsers} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create {userSlots.length} User(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
