import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Lead { id: string; name: string | null; phone_number: string; email: string | null; source: string | null; stage: string; interest_score: number | null; last_call_at: string | null; last_call_summary: string | null; created_at: string; projects?: { name: string } | null; }
interface Props { open: boolean; onOpenChange: (open: boolean) => void; lead: Lead; onUpdate: () => void; }

const stageColors: Record<string, string> = { new: "bg-gray-500", contacted: "bg-blue-500", interested: "bg-green-500", site_visit_done: "bg-purple-500", negotiation: "bg-orange-500", token_paid: "bg-yellow-500", closed: "bg-emerald-600", lost: "bg-red-500" };

export function RELeadDetailsDialog({ open, onOpenChange, lead }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{lead.name || "Lead Details"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-mono">{lead.phone_number}</p></div>
            <div><p className="text-sm text-muted-foreground">Email</p><p>{lead.email || "—"}</p></div>
            <div><p className="text-sm text-muted-foreground">Source</p><Badge variant="outline">{lead.source || "Unknown"}</Badge></div>
            <div><p className="text-sm text-muted-foreground">Stage</p><Badge className={stageColors[lead.stage] || "bg-gray-500"}>{lead.stage.replace("_", " ")}</Badge></div>
            <div><p className="text-sm text-muted-foreground">Project</p><p>{lead.projects?.name || "—"}</p></div>
            <div><p className="text-sm text-muted-foreground">Interest Score</p><p>{lead.interest_score !== null ? `${lead.interest_score}%` : "—"}</p></div>
          </div>
          {lead.last_call_summary && <div className="p-3 border rounded-lg"><p className="text-sm text-muted-foreground mb-1">Last Call Summary</p><p className="text-sm">{lead.last_call_summary}</p>{lead.last_call_at && <p className="text-xs text-muted-foreground mt-2">{format(new Date(lead.last_call_at), "PPP 'at' p")}</p>}</div>}
          <p className="text-xs text-muted-foreground">Created: {format(new Date(lead.created_at), "PPP")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
