import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Lead { id: string; name: string | null; project_id: string | null; }
interface Props { open: boolean; onOpenChange: (open: boolean) => void; lead: Lead; onSuccess: () => void; }

export function REScheduleVisitDialog({ open, onOpenChange, lead, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [executives, setExecutives] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", executiveId: "", projectId: lead.project_id || "" });

  useEffect(() => {
    if (!user || !open) return;
    supabase.from("sales_executives").select("id, name").eq("client_id", user.id).eq("is_active", true).then(({ data }) => setExecutives(data || []));
    supabase.from("projects").select("id, name").eq("client_id", user.id).eq("status", "active").then(({ data }) => setProjects(data || []));
    setForm(f => ({ ...f, projectId: lead.project_id || "" }));
  }, [user, open, lead.project_id]);

  const handleSave = async () => {
    if (!user || !form.date || !form.time) { toast({ title: "Error", description: "Date and time required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      const { error } = await supabase.from("site_visits").insert({
        client_id: user.id, lead_id: lead.id, scheduled_at: scheduledAt,
        project_id: form.projectId || null, assigned_executive_id: form.executiveId || null, outcome: "pending",
      });
      if (error) throw error;
      toast({ title: "Success", description: "Site visit scheduled" });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule Site Visit</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Lead: {lead.name || "Unknown"}</p>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div><Label>Time *</Label><Input type="time" value={form.time} onChange={(e) => setForm(p => ({ ...p, time: e.target.value }))} /></div>
          </div>
          <div><Label>Project</Label><Select value={form.projectId} onValueChange={(v) => setForm(p => ({ ...p, projectId: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Assign Executive</Label><Select value={form.executiveId} onValueChange={(v) => setForm(p => ({ ...p, executiveId: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{executives.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Schedule"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
