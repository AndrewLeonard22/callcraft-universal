import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, Save, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from "@/components/SortableItem";
import { Switch } from "@/components/ui/switch";

interface ServiceType {
  id: string;
  name: string;
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

const ServiceDetailFields = () => {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [fields, setFields] = useState<ServiceDetailField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<ServiceDetailField | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>("");

  // Form state
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadOrganizationAndServiceTypes();
  }, []);

  useEffect(() => {
    if (selectedServiceType && organizationId) {
      loadFields();
    }
  }, [selectedServiceType, organizationId]);

  const loadOrganizationAndServiceTypes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (memberData) {
        setOrganizationId(memberData.organization_id);
        
        const { data: serviceTypesData } = await supabase
          .from("service_types")
          .select("*")
          .eq("organization_id", memberData.organization_id);

        if (serviceTypesData) {
          setServiceTypes(serviceTypesData);
          if (serviceTypesData.length > 0) {
            setSelectedServiceType(serviceTypesData[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load service types");
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async () => {
    try {
      const { data, error } = await supabase
        .from("service_detail_fields")
        .select("*")
        .eq("service_type_id", selectedServiceType)
        .eq("organization_id", organizationId)
        .order("display_order");

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error("Error loading fields:", error);
      toast.error("Failed to load fields");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const newFields = arrayMove(fields, oldIndex, newIndex);
    
    setFields(newFields);

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
      loadFields();
    }
  };

  const handleSubmit = async () => {
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
        const { error } = await supabase
          .from("service_detail_fields")
          .insert({
            service_type_id: selectedServiceType,
            organization_id: organizationId,
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

      handleCancel();
      loadFields();
    } catch (error) {
      console.error("Error saving field:", error);
      toast.error("Failed to save field");
    }
  };

  const handleEdit = (field: ServiceDetailField) => {
    setEditingField(field);
    setFieldName(field.field_name);
    setFieldLabel(field.field_label);
    setFieldType(field.field_type);
    setIsRequired(field.is_required);
    setPlaceholder(field.placeholder || "");
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteFieldId) return;

    try {
      const { error } = await supabase
        .from("service_detail_fields")
        .delete()
        .eq("id", deleteFieldId);

      if (error) throw error;
      toast.success("Field deleted successfully");
      loadFields();
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Failed to delete field");
    } finally {
      setDeleteFieldId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingField(null);
    setFieldName("");
    setFieldLabel("");
    setFieldType("text");
    setIsRequired(false);
    setPlaceholder("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/service-types")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Service Types
          </Button>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-lg shadow-sm p-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
            Service Detail Fields
          </h1>
          <p className="text-muted-foreground">
            Customize the questions asked for each service type
          </p>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Service Type</Label>
                <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showForm && (
              <Card className="mb-6 border-2 border-primary/20">
                <CardHeader>
                  <CardTitle>{editingField ? "Edit Field" : "New Field"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field Name (internal)</Label>
                      <Input
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        placeholder="e.g., project_min_price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Field Label (displayed)</Label>
                      <Input
                        value={fieldLabel}
                        onChange={(e) => setFieldLabel(e.target.value)}
                        placeholder="e.g., Project Minimum Price"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field Type</Label>
                      <Select value={fieldType} onValueChange={setFieldType}>
                        <SelectTrigger>
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
                    <div className="space-y-2">
                      <Label>Placeholder</Label>
                      <Input
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                        placeholder="Optional placeholder text"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="required"
                      checked={isRequired}
                      onCheckedChange={setIsRequired}
                    />
                    <Label htmlFor="required">Required field</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmit} className="gap-2">
                      <Save className="h-4 w-4" />
                      {editingField ? "Update" : "Create"}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {fields.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <p className="text-muted-foreground mb-4">No fields configured for this service type yet</p>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Field
                </Button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <SortableItem key={field.id} id={field.id}>
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                              <div className="flex-1">
                                <div className="font-medium">{field.field_label}</div>
                                <div className="text-sm text-muted-foreground">
                                  {field.field_name} • {field.field_type}
                                  {field.is_required && <span className="text-destructive"> • Required</span>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(field)}>
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeleteFieldId(field.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this field? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceDetailFields;
