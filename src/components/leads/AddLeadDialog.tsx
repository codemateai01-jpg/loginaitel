import { useState } from "react";
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
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId?: string; // Optional - if not provided, uses user.id
}

export function AddLeadDialog({ open, onOpenChange, onSuccess, clientId }: AddLeadDialogProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // For admin/engineer, we need a client to be specified
  const effectiveClientId = clientId || (role === "client" ? user?.id : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.phone || formData.phone.length < 10) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a valid phone number",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Format phone number
      const phone = formData.phone.startsWith("+")
        ? formData.phone
        : `+91${formData.phone.replace(/\D/g, "")}`;

      // Use effectiveClientId - for clients it's their ID, for admin/engineer it must be provided
      const targetClientId = effectiveClientId || user.id;

      const { error } = await supabase.from("leads").insert([{
        name: formData.name || null,
        phone_number: phone,
        email: formData.email || null,
        client_id: targetClientId,
        uploaded_by: user.id,
        status: "pending",
      }]);

      if (error) throw error;

      toast({
        title: "Lead Added!",
        description: "The lead has been added successfully.",
      });

      onSuccess();
      onOpenChange(false);
      setFormData({ name: "", phone: "", email: "" });
    } catch (err) {
      console.error("Add lead error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add lead",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", phone: "", email: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Lead
          </DialogTitle>
          <DialogDescription>
            Manually add a new lead to your campaign.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="border-2"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="border-2"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +91 for India)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="border-2"
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.phone}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
