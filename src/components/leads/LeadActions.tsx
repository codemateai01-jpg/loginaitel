import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Phone,
  CheckCircle,
  Clock,
  XCircle,
  PhoneOff,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type LeadStatus = "pending" | "interested" | "callback" | "not_interested" | "no_answer" | "completed";

interface LeadActionsProps {
  leadId: string;
  currentStatus: string;
  onTriggerCall: () => void;
  onRefresh: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; icon: React.ElementType }[] = [
  { value: "pending", label: "Pending", icon: Clock },
  { value: "interested", label: "Interested", icon: CheckCircle },
  { value: "callback", label: "Callback", icon: Clock },
  { value: "not_interested", label: "Not Interested", icon: XCircle },
  { value: "no_answer", label: "No Answer", icon: PhoneOff },
  { value: "completed", label: "Completed", icon: CheckCircle },
];

export function LeadActions({ leadId, currentStatus, onTriggerCall, onRefresh }: LeadActionsProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (newStatus === currentStatus) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Lead status changed to ${newStatus.replace("_", " ")}`,
      });

      onRefresh();
    } catch (err) {
      console.error("Status update error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update lead status",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead Deleted",
        description: "The lead has been removed.",
      });

      onRefresh();
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete lead",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isUpdating}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onTriggerCall}>
          <Phone className="h-4 w-4 mr-2" />
          Trigger Call
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
          Update Status
        </p>
        {STATUS_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={currentStatus === option.value ? "bg-accent" : ""}
            >
              <Icon className="h-4 w-4 mr-2" />
              {option.label}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Lead
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
