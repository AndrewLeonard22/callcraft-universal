import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Upload, Settings, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
  created_at: string;
}

export default function ServiceTypes() {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [userOrganizationId, setUserOrganizationId] = useState<string | null>(null);

  const loadUserOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserOrganizationId(data?.organization_id || null);
    } catch (error) {
      console.error('Error loading user organization:', error);
    }
  };

  useEffect(() => {
    loadUserOrganization();
  }, []);

  useEffect(() => {
    if (!userOrganizationId) return;

    loadServiceTypes();

    // Set up real-time subscription
    const serviceTypesChannel = supabase
      .channel('service-types-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_types' }, () => {
        loadServiceTypes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(serviceTypesChannel);
    };
  }, [userOrganizationId]);

  const loadServiceTypes = async () => {
    try {
      if (!userOrganizationId) return;

      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .eq("organization_id", userOrganizationId)
        .order("name");

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error("Error loading service types:", error);
      toast.error("Failed to load service types");
    } finally {
      setLoading(false);
    }
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setIconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (!serviceName.trim()) {
      toast.error("Please enter a service name");
      return;
    }

    if (!userOrganizationId) {
      toast.error("Organization not found");
      return;
    }

    setSaving(true);
    try {
      let iconUrl = null;

      if (iconFile) {
        const fileExt = iconFile.name.split('.').pop();
        const fileName = `${Date.now()}-${serviceName.replace(/\s+/g, '-')}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('client-logos')
          .upload(fileName, iconFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('client-logos')
          .getPublicUrl(fileName);
        
        iconUrl = publicUrl;
      }

      const { error } = await supabase.from("service_types").insert({
        name: serviceName,
        icon_url: iconUrl,
        organization_id: userOrganizationId,
      });

      if (error) throw error;

      toast.success("Service type created successfully!");
      setServiceName("");
      setIconFile(null);
      setIconPreview(null);
      setShowCreateForm(false);
      loadServiceTypes();
    } catch (error: any) {
      console.error("Error creating service type:", error);
      toast.error(error.message || "Failed to create service type");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (serviceType: ServiceType) => {
    setEditingService(serviceType);
    setServiceName(serviceType.name);
    setIconPreview(serviceType.icon_url || null);
    setShowCreateForm(true);
  };

  const handleUpdate = async () => {
    if (!serviceName.trim() || !editingService) {
      toast.error("Please enter a service name");
      return;
    }

    setSaving(true);
    try {
      let iconUrl = editingService.icon_url;

      if (iconFile) {
        const fileExt = iconFile.name.split('.').pop();
        const fileName = `${Date.now()}-${serviceName.replace(/\s+/g, '-')}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('client-logos')
          .upload(fileName, iconFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('client-logos')
          .getPublicUrl(fileName);
        
        iconUrl = publicUrl;
      }

      const { error } = await supabase.from("service_types").update({
        name: serviceName,
        icon_url: iconUrl,
      }).eq("id", editingService.id);

      if (error) throw error;

      toast.success("Service type updated successfully!");
      setServiceName("");
      setIconFile(null);
      setIconPreview(null);
      setShowCreateForm(false);
      setEditingService(null);
      loadServiceTypes();
    } catch (error: any) {
      console.error("Error updating service type:", error);
      toast.error(error.message || "Failed to update service type");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceTypeId: string) => {
    try {
      const { error } = await supabase
        .from("service_types")
        .delete()
        .eq("id", serviceTypeId);

      if (error) throw error;

      toast.success("Service type deleted successfully!");
      loadServiceTypes();
    } catch (error: any) {
      console.error("Error deleting service type:", error);
      toast.error(error.message || "Failed to delete service type");
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingService(null);
    setServiceName("");
    setIconFile(null);
    setIconPreview(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Service Types</h1>
            <p className="text-sm text-muted-foreground">
              Manage service types and their icons
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => navigate("/")} className="flex-1 sm:flex-none">
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <Button onClick={() => {
              setEditingService(null);
              setServiceName("");
              setIconFile(null);
              setIconPreview(null);
              setShowCreateForm(!showCreateForm);
            }} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Service Type</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingService ? "Edit Service Type" : "Create New Service Type"}</CardTitle>
              <CardDescription>
                {editingService ? "Update the service type and icon" : "Add a new service type with an optional icon"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="service-name">Service Name</Label>
                <Input
                  id="service-name"
                  placeholder="e.g., Pools, Pavers, Pergola"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="service-icon">Service Icon</Label>
                <div className="flex items-center gap-4">
                  {iconPreview && (
                    <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
                      <img 
                        src={iconPreview} 
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="service-icon"
                      type="file"
                      accept="image/*"
                      onChange={handleIconChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload an icon for this service type (max 5MB)
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={editingService ? handleUpdate : handleCreate} disabled={saving}>
                  {saving ? (editingService ? "Updating..." : "Creating...") : (editingService ? "Update Service Type" : "Create Service Type")}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : serviceTypes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold mb-1">No service types yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Create your first service type
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Service Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {serviceTypes.map((serviceType) => (
              <Card key={serviceType.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {serviceType.icon_url ? (
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
                          <img 
                            src={serviceType.icon_url} 
                            alt={`${serviceType.name} icon`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <CardTitle className="text-base truncate">{serviceType.name}</CardTitle>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEdit(serviceType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Service Type?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the "{serviceType.name}" service type.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(serviceType.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
