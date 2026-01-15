import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  UserPlus, 
  Phone, 
  Mail,
  Edit,
  Trash2,
  Users
} from "lucide-react";

interface SalesExecutive {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  is_active: boolean;
  created_at: string;
  lead_count?: number;
  visit_count?: number;
}

export default function RESalesTeam() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [executives, setExecutives] = useState<SalesExecutive[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExecutive, setEditingExecutive] = useState<SalesExecutive | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    is_active: true,
  });

  const fetchExecutives = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("sales_executives")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch stats for each executive
      const executivesWithStats = await Promise.all(
        (data || []).map(async (exec) => {
          const [leadCount, visitCount] = await Promise.all([
            supabase
              .from("real_estate_leads")
              .select("*", { count: "exact", head: true })
              .eq("assigned_executive_id", exec.id),
            supabase
              .from("site_visits")
              .select("*", { count: "exact", head: true })
              .eq("assigned_executive_id", exec.id),
          ]);
          
          return {
            ...exec,
            lead_count: leadCount.count || 0,
            visit_count: visitCount.count || 0,
          };
        })
      );

      setExecutives(executivesWithStats);
    } catch (error) {
      console.error("Error fetching executives:", error);
      toast({
        title: "Error",
        description: "Failed to fetch sales team",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchExecutives();
  }, [fetchExecutives]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      is_active: true,
    });
    setEditingExecutive(null);
  };

  const handleOpenDialog = (executive?: SalesExecutive) => {
    if (executive) {
      setEditingExecutive(executive);
      setFormData({
        name: executive.name,
        email: executive.email || "",
        phone: executive.phone,
        is_active: executive.is_active,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "Error",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const executiveData = {
        client_id: user.id,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim(),
        is_active: formData.is_active,
      };

      if (editingExecutive) {
        const { error } = await supabase
          .from("sales_executives")
          .update(executiveData)
          .eq("id", editingExecutive.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Executive updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("sales_executives")
          .insert(executiveData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Executive added successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchExecutives();
    } catch (error) {
      console.error("Error saving executive:", error);
      toast({
        title: "Error",
        description: "Failed to save executive",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (executiveId: string) => {
    if (!confirm("Are you sure you want to remove this executive? They will be unassigned from leads and visits.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("sales_executives")
        .delete()
        .eq("id", executiveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Executive removed successfully",
      });
      
      fetchExecutives();
    } catch (error) {
      console.error("Error deleting executive:", error);
      toast({
        title: "Error",
        description: "Failed to remove executive",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (executive: SalesExecutive) => {
    try {
      const { error } = await supabase
        .from("sales_executives")
        .update({ is_active: !executive.is_active })
        .eq("id", executive.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Executive ${!executive.is_active ? "activated" : "deactivated"}`,
      });
      
      fetchExecutives();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sales Team</h1>
            <p className="text-muted-foreground">
              Manage your sales executives
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Executive
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{executives.length}</p>
                  <p className="text-xs text-muted-foreground">Total Executives</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {executives.filter(e => e.is_active).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {executives.reduce((sum, e) => sum + (e.lead_count || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Leads Assigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executives Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : executives.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No sales executives yet. Add your first team member.
                    </TableCell>
                  </TableRow>
                ) : (
                  executives.map((executive) => (
                    <TableRow key={executive.id}>
                      <TableCell className="font-medium">{executive.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {executive.phone}
                          </div>
                          {executive.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {executive.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{executive.lead_count}</TableCell>
                      <TableCell>{executive.visit_count}</TableCell>
                      <TableCell>
                        <Badge variant={executive.is_active ? "default" : "secondary"}>
                          {executive.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(executive)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(executive.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExecutive ? "Edit Executive" : "Add Sales Executive"}
            </DialogTitle>
            <DialogDescription>
              {editingExecutive 
                ? "Update the executive details" 
                : "Add a new member to your sales team"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Rahul Sharma"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g., +91 98765 43210"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="e.g., rahul@company.com"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingExecutive ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
