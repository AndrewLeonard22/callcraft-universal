import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Upload, Settings, Pencil, ChevronDown, ChevronUp, ListChecks, GripVertical, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from "@/components/SortableItem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
  created_at: string;
}

interface ServiceDetailField {
  id: string;
  service_type_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  placeholder?: string;
  display_order: number;
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
  
  // Field management state
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [serviceFields, setServiceFields] = useState<Record<string, ServiceDetailField[]>>({});
  const [showFieldForm, setShowFieldForm] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<ServiceDetailField | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      
      // Load fields for all service types
      if (data) {
        data.forEach(st => loadServiceFields(st.id));
      }
    } catch (error) {
      console.error("Error loading service types:", error);
      toast.error("Failed to load service types");
    } finally {
      setLoading(false);
    }
  };

  const loadServiceFields = async (serviceTypeId: string) => {
    try {
      if (!userOrganizationId) return;

      const { data, error } = await supabase
        .from("service_detail_fields")
        .select("*")
        .eq("service_type_id", serviceTypeId)
        .eq("organization_id", userOrganizationId)
        .order("display_order");

      if (error) throw error;
      setServiceFields(prev => ({ ...prev, [serviceTypeId]: data || [] }));
    } catch (error) {
      console.error("Error loading service fields:", error);
    }
  };

  const handleDragEnd = (serviceTypeId: string) => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fields = serviceFields[serviceTypeId] || [];
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const newFields = arrayMove(fields, oldIndex, newIndex);
    
    setServiceFields(prev => ({ ...prev, [serviceTypeId]: newFields }));

    try {
      const updates = newFields.map((field, index) => 
        supabase
          .from("service_detail_fields")
          .update({ display_order: index })
          .eq("id", field.id)
      );
      await Promise.all(updates);
      toast.success("Field order updated");
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
      loadServiceFields(serviceTypeId);
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

      const { data: newServiceType, error } = await supabase.from("service_types").insert({
        name: serviceName,
        icon_url: iconUrl,
        organization_id: userOrganizationId,
      }).select().single();

      if (error) throw error;

      // Create default service detail fields
      const defaultFields = [
        { field_name: 'property_size', field_label: 'Property Size', field_type: 'text', placeholder: 'e.g., 2000 sq ft', display_order: 1 },
        { field_name: 'service_date', field_label: 'Preferred Service Date', field_type: 'text', placeholder: 'e.g., Next week', display_order: 2 },
        { field_name: 'budget', field_label: 'Budget Range', field_type: 'text', placeholder: 'e.g., $5,000 - $10,000', display_order: 3 },
        { field_name: 'timeline', field_label: 'Project Timeline', field_type: 'text', placeholder: 'e.g., 2-3 weeks', display_order: 4 },
        { field_name: 'special_requirements', field_label: 'Special Requirements', field_type: 'textarea', placeholder: 'Any specific needs or preferences', display_order: 5 },
        { field_name: 'contact_preference', field_label: 'Contact Preference', field_type: 'text', placeholder: 'e.g., Email, Phone', display_order: 6 },
        { field_name: 'location', field_label: 'Service Location', field_type: 'text', placeholder: 'Full address', display_order: 7 },
        { field_name: 'service_frequency', field_label: 'Service Frequency', field_type: 'text', placeholder: 'e.g., One-time, Monthly', display_order: 8 },
        { field_name: 'notes', field_label: 'Additional Notes', field_type: 'textarea', placeholder: 'Any other information', display_order: 9 },
      ];

      const fieldsToInsert = defaultFields.map(field => ({
        ...field,
        service_type_id: newServiceType.id,
        organization_id: userOrganizationId,
        is_required: false,
      }));

      const { error: fieldsError } = await supabase
        .from('service_detail_fields')
        .insert(fieldsToInsert);

      if (fieldsError) {
        console.error("Error creating default fields:", fieldsError);
        // Don't throw - service type was created successfully
      }

      toast.success("Service type created successfully with default fields!");
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

  const handleFieldSubmit = async (serviceTypeId: string) => {
    if (!fieldName || !fieldLabel) {
      toast.error("Field name and label are required");
      return;
    }

    try {
      if (editingField) {
        const { error } = await supabase
          .from("service_detail_fields")
          .update({
            field_name: fieldName,
            field_label: fieldLabel,
            field_type: fieldType,
            is_required: isRequired,
            placeholder: placeholder || null,
          })
          .eq("id", editingField.id);

        if (error) throw error;
        toast.success("Field updated successfully");
      } else {
        const fields = serviceFields[serviceTypeId] || [];
        const { error } = await supabase
          .from("service_detail_fields")
          .insert({
            service_type_id: serviceTypeId,
            organization_id: userOrganizationId,
            field_name: fieldName,
            field_label: fieldLabel,
            field_type: fieldType,
            is_required: isRequired,
            placeholder: placeholder || null,
            display_order: fields.length,
          });

        if (error) throw error;
        toast.success("Field created successfully");
      }

      handleFieldCancel();
      loadServiceFields(serviceTypeId);
    } catch (error) {
      console.error("Error saving field:", error);
      toast.error("Failed to save field");
    }
  };

  const handleEditField = (field: ServiceDetailField) => {
    setEditingField(field);
    setFieldName(field.field_name);
    setFieldLabel(field.field_label);
    setFieldType(field.field_type);
    setIsRequired(field.is_required);
    setPlaceholder(field.placeholder || "");
    setShowFieldForm(field.service_type_id);
  };

  const handleDeleteField = async (fieldId: string, serviceTypeId: string) => {
    try {
      const { error } = await supabase
        .from("service_detail_fields")
        .delete()
        .eq("id", fieldId);

      if (error) throw error;
      toast.success("Field deleted successfully");
      loadServiceFields(serviceTypeId);
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Failed to delete field");
    }
  };

  const handleFieldCancel = () => {
    setShowFieldForm(null);
    setEditingField(null);
    setFieldName("");
    setFieldLabel("");
    setFieldType("text");
    setIsRequired(false);
    setPlaceholder("");
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
          <div className="grid gap-4 grid-cols-1">
            {serviceTypes.map((serviceType) => {
              const fields = serviceFields[serviceType.id] || [];
              const isExpanded = expandedServiceId === serviceType.id;
              
              return (
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
                        <div className="flex-1">
                          <CardTitle className="text-base">{serviceType.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {fields.length} question{fields.length !== 1 ? 's' : ''} configured
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => setExpandedServiceId(isExpanded ? null : serviceType.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
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
                                This will permanently delete the "{serviceType.name}" service type and all its questions.
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
                  
                  <Collapsible open={isExpanded}>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b">
                          <div className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Service Questions</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setShowFieldForm(serviceType.id);
                              setEditingField(null);
                              setFieldName("");
                              setFieldLabel("");
                              setFieldType("text");
                              setIsRequired(false);
                              setPlaceholder("");
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Question
                          </Button>
                        </div>

                        {showFieldForm === serviceType.id && (
                          <Card className="border-2 border-primary/20 bg-muted/30">
                            <CardContent className="pt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Field Name (internal)</Label>
                                  <Input
                                    value={fieldName}
                                    onChange={(e) => setFieldName(e.target.value)}
                                    placeholder="e.g., project_min_price"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Field Label (displayed)</Label>
                                  <Input
                                    value={fieldLabel}
                                    onChange={(e) => setFieldLabel(e.target.value)}
                                    placeholder="e.g., Project Minimum Price"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Field Type</Label>
                                  <Select value={fieldType} onValueChange={setFieldType}>
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="textarea">Text Area</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="url">URL</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Placeholder</Label>
                                  <Input
                                    value={placeholder}
                                    onChange={(e) => setPlaceholder(e.target.value)}
                                    placeholder="Optional placeholder"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`required-${serviceType.id}`}
                                  checked={isRequired}
                                  onCheckedChange={setIsRequired}
                                />
                                <Label htmlFor={`required-${serviceType.id}`} className="text-xs">Required field</Label>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleFieldSubmit(serviceType.id)} size="sm">
                                  <Save className="h-3 w-3 mr-1" />
                                  {editingField ? "Update" : "Create"}
                                </Button>
                                <Button variant="outline" onClick={handleFieldCancel} size="sm">
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {fields.length === 0 ? (
                          <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-lg">
                            No questions configured yet
                          </div>
                        ) : (
                          <DndContext 
                            sensors={sensors} 
                            collisionDetection={closestCenter} 
                            onDragEnd={handleDragEnd(serviceType.id)}
                          >
                            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-2">
                                {fields.map((field) => (
                                  <SortableItem key={field.id} id={field.id}>
                                    <div className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{field.field_label}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {field.field_name} • {field.field_type}
                                          {field.is_required && <span className="text-destructive"> • Required</span>}
                                        </div>
                                      </div>
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => handleEditField(field)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive h-7 w-7">
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Question?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete "{field.field_label}". This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => handleDeleteField(field.id, serviceType.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  </SortableItem>
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
