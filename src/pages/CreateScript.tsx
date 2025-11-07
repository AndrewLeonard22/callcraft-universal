import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface Client {
  id: string;
  name: string;
  service_type: string;
  city: string;
}

interface Template {
  id: string;
  service_name: string;
  script_content: string;
  image_url?: string;
  service_type_id?: string;
}

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface ServiceDetailField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  placeholder?: string;
  display_order: number;
}

export default function CreateScript() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [serviceDetailFields, setServiceDetailFields] = useState<ServiceDetailField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadClient();
    loadTemplates();
    loadServiceTypes();

    // Set up real-time subscription for templates to ensure fresh data
    const templatesSubscription = supabase
      .channel('templates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scripts',
          filter: 'is_template=eq.true'
        },
        () => {
          console.log('Templates changed, reloading...');
          loadTemplates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(templatesSubscription);
    };
  }, [clientId]);

  useEffect(() => {
    if (selectedServiceTypeId) {
      loadServiceDetailFields();
    }
  }, [selectedServiceTypeId]);

  const loadClient = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load client data");
    }
  };

  const loadTemplates = async () => {
    try {
      // Get user's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!orgMember?.organization_id) return;

      const { data, error } = await supabase
        .from("scripts")
        .select("id, service_name, script_content, image_url, service_type_id")
        .eq("is_template", true)
        .eq("organization_id", orgMember.organization_id)
        .order("service_name", { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    }
  };

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .order("name");

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error("Error loading service types:", error);
      toast.error("Failed to load service types");
    }
  };

  const loadServiceDetailFields = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!orgMember?.organization_id) return;

      const { data, error } = await supabase
        .from("service_detail_fields")
        .select("*")
        .eq("service_type_id", selectedServiceTypeId)
        .eq("organization_id", orgMember.organization_id)
        .order("display_order");

      if (error) throw error;
      setServiceDetailFields(data || []);
      
      // Initialize field values
      const initialValues: Record<string, string> = {};
      (data || []).forEach(field => {
        initialValues[field.field_name] = "";
      });
      setFieldValues(initialValues);
    } catch (error) {
      console.error("Error loading service detail fields:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  // Filter templates by selected service type
  const filteredTemplates = selectedServiceTypeId
    ? templates.filter(t => t.service_type_id === selectedServiceTypeId)
    : [];

  const handleGenerate = async () => {
    if (!selectedServiceTypeId) {
      toast.error("Please select a service type");
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    setLoading(true);
    try {
      // CRITICAL: Always fetch the absolute LATEST template directly from database
      // This ensures zero caching - we get the current version with all recent edits
      toast.info("Fetching latest template version...");
      
      const { data: freshTemplate, error: templateError } = await supabase
        .from("scripts")
        .select("id, service_name, script_content, image_url")
        .eq("id", selectedTemplateId)
        .eq("is_template", true)
        .single();

      if (templateError || !freshTemplate) {
        toast.error("Failed to load template. Please try again.");
        console.error("Template fetch error:", templateError);
        setLoading(false);
        return;
      }

      // Verify we have actual content
      if (!freshTemplate.script_content || freshTemplate.script_content.trim().length === 0) {
        toast.error("Template is empty. Please edit the template first.");
        setLoading(false);
        return;
      }

      const selectedServiceType = serviceTypes.find(t => t.id === selectedServiceTypeId);
      if (!selectedServiceType) {
        toast.error("Invalid service type selected");
        setLoading(false);
        return;
      }

      console.log("✓ Using LATEST template (no cache):", {
        id: freshTemplate.id,
        name: freshTemplate.service_name,
        contentLength: freshTemplate.script_content.length,
        contentPreview: freshTemplate.script_content.substring(0, 100)
      });

      toast.success("Using latest template version");

      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: {
          client_id: clientId,
          service_name: selectedServiceType.name,
          service_type_id: selectedServiceTypeId,
          use_template: true,
          template_script: freshTemplate.script_content,
          service_type_icon_url: selectedServiceType.icon_url,
          template_id: freshTemplate.id,
          service_details: fieldValues
        },
      });

      if (error) throw error;

      // Try to get the newly created script id
      const { data: newScript, error: fetchErr } = await supabase
        .from("scripts")
        .select("id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      const newScriptId = newScript?.id;

      if (newScriptId) {
        const prefix = `script_${newScriptId}_`;
        const detailsArray = Object.entries(fieldValues)
          .filter(([_, value]) => value.trim())
          .map(([key, value]) => ({
            client_id: clientId as string,
            field_name: `${prefix}${key}`,
            field_value: value,
          }));

        if (detailsArray.length > 0) {
          const { error: insertErr } = await supabase
            .from("client_details")
            .insert(detailsArray);
          if (insertErr) throw insertErr;
        }
      }

      toast.success("Script generated successfully!");
      navigate(`/client/${clientId}`);
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setLoading(false);
    }
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link to={`/client/${clientId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {client.name}
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Add New Script</h1>
          <p className="text-muted-foreground">
            For {client.name} - {client.service_type}
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Service Type</CardTitle>
                  <CardDescription>
                    What service is this script for?
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/service-types")}
                >
                  Manage Services
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={selectedServiceTypeId} onValueChange={setSelectedServiceTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service type..." />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {serviceTypes.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No service types available. Create one first.
                    </div>
                  ) : (
                    serviceTypes.map((serviceType) => (
                      <SelectItem key={serviceType.id} value={serviceType.id}>
                        <div className="flex items-center gap-2">
                          {serviceType.icon_url && (
                            <img 
                              src={serviceType.icon_url} 
                              alt="" 
                              className="h-4 w-4 rounded object-cover"
                            />
                          )}
                          {serviceType.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Script Template</CardTitle>
                  <CardDescription>
                    Choose a template to customize for this client
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/templates")}
                >
                  Manage Templates
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedServiceTypeId 
                      ? "Select a service type first..." 
                      : filteredTemplates.length === 0 
                        ? "No templates for this service type" 
                        : "Select a template..."
                  } />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {!selectedServiceTypeId ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Please select a service type first
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No templates for this service type. Create one in Templates page.
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.service_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedServiceTypeId && filteredTemplates.length > 0
                  ? "AI will only replace UPPERCASE placeholders like [COMPANY_NAME], [SERVICE_TYPE], [CITY] in the template. All formatting, spacing, and styling will be preserved exactly as designed."
                  : "Templates are filtered by the selected service type"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Service Details</CardTitle>
                  <CardDescription>
                    Provide specific information about this service
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedServiceTypeId ? (
                <p className="text-sm text-muted-foreground">
                  Please select a service type to see available fields
                </p>
              ) : serviceDetailFields.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    No questions configured for this service type yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/service-types")}
                  >
                    Configure in Service Types
                  </Button>
                </div>
              ) : (
                serviceDetailFields.map((field) => (
                  <div key={field.id}>
                    <Label htmlFor={field.field_name}>
                      {field.field_label}
                      {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.field_type === 'textarea' ? (
                      <Textarea
                        id={field.field_name}
                        placeholder={field.placeholder || ''}
                        value={fieldValues[field.field_name] || ''}
                        onChange={(e) => setFieldValues(prev => ({
                          ...prev,
                          [field.field_name]: e.target.value
                        }))}
                        required={field.is_required}
                      />
                    ) : (
                      <Input
                        id={field.field_name}
                        type={field.field_type}
                        placeholder={field.placeholder || ''}
                        value={fieldValues[field.field_name] || ''}
                        onChange={(e) => setFieldValues(prev => ({
                          ...prev,
                          [field.field_name]: e.target.value
                        }))}
                        required={field.is_required}
                      />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Generating Script..." : "Generate Customized Script"}
          </Button>
        </div>
      </div>
    </div>
  );
}
