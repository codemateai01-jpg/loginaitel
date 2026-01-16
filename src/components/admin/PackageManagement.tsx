import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Package, Phone, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PricingPackage {
  id: string;
  name: string;
  slug: string;
  calls_included: number;
  concurrency_level: number;
  includes_inbound: boolean;
  description: string | null;
  features: string[];
  is_enterprise: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function PackageManagement() {
  const queryClient = useQueryClient();
  const [editingPackage, setEditingPackage] = useState<PricingPackage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    calls_included: 5000,
    concurrency_level: 10,
    includes_inbound: false,
    description: "",
    features: "",
    is_enterprise: false,
    is_active: true,
    display_order: 0,
  });

  const { data: packages, isLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_packages")
        .select("*")
        .order("display_order");
      
      if (error) throw error;
      return data as PricingPackage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const features = data.features.split("\n").filter(f => f.trim());
      const { error } = await supabase.from("pricing_packages").insert({
        name: data.name,
        slug: data.slug,
        calls_included: data.calls_included,
        concurrency_level: data.concurrency_level,
        includes_inbound: data.includes_inbound,
        description: data.description,
        features: features,
        is_enterprise: data.is_enterprise,
        is_active: data.is_active,
        display_order: data.display_order,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast.success("Package created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const features = data.features.split("\n").filter(f => f.trim());
      const { error } = await supabase
        .from("pricing_packages")
        .update({
          name: data.name,
          slug: data.slug,
          calls_included: data.calls_included,
          concurrency_level: data.concurrency_level,
          includes_inbound: data.includes_inbound,
          description: data.description,
          features: features,
          is_enterprise: data.is_enterprise,
          is_active: data.is_active,
          display_order: data.display_order,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast.success("Package updated successfully");
      setIsDialogOpen(false);
      setEditingPackage(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      calls_included: 5000,
      concurrency_level: 10,
      includes_inbound: false,
      description: "",
      features: "",
      is_enterprise: false,
      is_active: true,
      display_order: 0,
    });
  };

  const handleEdit = (pkg: PricingPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      slug: pkg.slug,
      calls_included: pkg.calls_included,
      concurrency_level: pkg.concurrency_level,
      includes_inbound: pkg.includes_inbound,
      description: pkg.description || "",
      features: Array.isArray(pkg.features) ? pkg.features.join("\n") : "",
      is_enterprise: pkg.is_enterprise,
      is_active: pkg.is_active,
      display_order: pkg.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Pricing Packages</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingPackage(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPackage ? "Edit Package" : "Create New Package"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Package Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Trust Building Pack"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="trust-building"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calls">Calls Included</Label>
                  <Input
                    id="calls"
                    type="number"
                    value={formData.calls_included}
                    onChange={(e) => setFormData({ ...formData, calls_included: parseInt(e.target.value) })}
                    min={0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concurrency">Concurrency Level</Label>
                  <Input
                    id="concurrency"
                    type="number"
                    value={formData.concurrency_level}
                    onChange={(e) => setFormData({ ...formData, concurrency_level: parseInt(e.target.value) })}
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Package description..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Features (one per line)</Label>
                <Textarea
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="5,000 connected calls&#10;10 concurrent calls&#10;Basic analytics"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order">Display Order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="inbound"
                    checked={formData.includes_inbound}
                    onCheckedChange={(checked) => setFormData({ ...formData, includes_inbound: checked })}
                  />
                  <Label htmlFor="inbound">Includes Inbound Calls</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enterprise"
                    checked={formData.is_enterprise}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_enterprise: checked })}
                  />
                  <Label htmlFor="enterprise">Enterprise Package</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingPackage ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Concurrency</TableHead>
                <TableHead>Inbound</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages?.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">{pkg.name}</p>
                        <p className="text-xs text-muted-foreground">{pkg.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {pkg.calls_included.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {pkg.concurrency_level}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pkg.includes_inbound ? (
                      <Badge variant="default">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {pkg.is_enterprise && (
                      <Badge variant="outline" className="ml-1">Enterprise</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(pkg)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
