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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Plus, 
  MapPin, 
  IndianRupee,
  Users,
  Edit,
  Trash2,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  description: string | null;
  property_type: string | null;
  location: string | null;
  price_range_min: number | null;
  price_range_max: number | null;
  amenities: string[] | null;
  status: string;
  created_at: string;
  lead_count?: number;
}

const propertyTypes = [
  "Flat",
  "Villa",
  "Plot",
  "Commercial",
  "Penthouse",
  "Duplex",
  "Farmhouse",
  "Other"
];

export default function REProjects() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    property_type: "",
    location: "",
    price_range_min: "",
    price_range_max: "",
    amenities: "",
  });

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch projects with lead count
      const { data: projectsData, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch lead counts for each project
      const projectsWithCounts = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { count } = await supabase
            .from("real_estate_leads")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);
          
          return { ...project, lead_count: count || 0 };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to fetch projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      property_type: "",
      location: "",
      price_range_min: "",
      price_range_max: "",
      amenities: "",
    });
    setEditingProject(null);
  };

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || "",
        property_type: project.property_type || "",
        location: project.location || "",
        price_range_min: project.price_range_min?.toString() || "",
        price_range_max: project.price_range_max?.toString() || "",
        amenities: project.amenities?.join(", ") || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const projectData = {
        client_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        property_type: formData.property_type || null,
        location: formData.location.trim() || null,
        price_range_min: formData.price_range_min ? parseFloat(formData.price_range_min) : null,
        price_range_max: formData.price_range_max ? parseFloat(formData.price_range_max) : null,
        amenities: formData.amenities ? formData.amenities.split(",").map(a => a.trim()).filter(Boolean) : null,
      };

      if (editingProject) {
        const { error } = await supabase
          .from("projects")
          .update(projectData)
          .eq("id", editingProject.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Project updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("projects")
          .insert(projectData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Project created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (error) {
      console.error("Error saving project:", error);
      toast({
        title: "Error",
        description: "Failed to save project",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? Leads will be unassigned.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      
      fetchProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: newStatus })
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project status updated",
      });
      
      fetchProjects();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (min: number | null, max: number | null) => {
    if (!min && !max) return "—";
    
    const formatNum = (n: number) => {
      if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
      return `₹${n.toLocaleString()}`;
    };

    if (min && max) {
      return `${formatNum(min)} - ${formatNum(max)}`;
    }
    if (min) return `From ${formatNum(min)}`;
    if (max) return `Up to ${formatNum(max)}`;
    return "—";
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your real estate projects
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first project to start managing leads
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    {project.property_type && (
                      <Badge variant="outline" className="mt-1">
                        {project.property_type}
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(project)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(project.id, project.status === "active" ? "inactive" : "active")}
                      >
                        {project.status === "active" ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(project.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    {project.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{project.location}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span>{formatPrice(project.price_range_min, project.price_range_max)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{project.lead_count} leads</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {format(new Date(project.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "New Project"}
            </DialogTitle>
            <DialogDescription>
              {editingProject 
                ? "Update your project details" 
                : "Create a new property project"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Green Valley Residency"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the property project..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="property_type">Property Type</Label>
                <Select
                  value={formData.property_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, property_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Whitefield, Bangalore"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price_min">Min Price (₹)</Label>
                <Input
                  id="price_min"
                  type="number"
                  value={formData.price_range_min}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_range_min: e.target.value }))}
                  placeholder="e.g., 5000000"
                />
              </div>

              <div>
                <Label htmlFor="price_max">Max Price (₹)</Label>
                <Input
                  id="price_max"
                  type="number"
                  value={formData.price_range_max}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_range_max: e.target.value }))}
                  placeholder="e.g., 15000000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="amenities">Amenities (comma-separated)</Label>
              <Input
                id="amenities"
                value={formData.amenities}
                onChange={(e) => setFormData(prev => ({ ...prev, amenities: e.target.value }))}
                placeholder="e.g., Swimming Pool, Gym, Club House"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingProject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
