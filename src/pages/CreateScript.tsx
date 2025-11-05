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

export default function CreateScript() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  // Service-specific fields
  const [projectMinPrice, setProjectMinPrice] = useState("");
  const [projectMinSize, setProjectMinSize] = useState("");
  const [pricePerSqFt, setPricePerSqFt] = useState("");
  const [warranties, setWarranties] = useState("");
  const [financingOptions, setFinancingOptions] = useState("");
  const [videoOfService, setVideoOfService] = useState("");
  const [avgInstallTime, setAvgInstallTime] = useState("");
  const [appointmentCalendar, setAppointmentCalendar] = useState("");
  const [rescheduleCalendar, setRescheduleCalendar] = useState("");

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
      // Fetch the LATEST template data directly from database to ensure freshness
      console.log("Fetching fresh template data for ID:", selectedTemplateId);
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

      const selectedServiceType = serviceTypes.find(t => t.id === selectedServiceTypeId);
      if (!selectedServiceType) {
        toast.error("Invalid service type selected");
        setLoading(false);
        return;
      }

      console.log("Using fresh template:", {
        id: freshTemplate.id,
        service_name: freshTemplate.service_name,
        script_length: freshTemplate.script_content?.length || 0
      });

      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: {
          client_id: clientId,
          service_name: selectedServiceType.name,
          service_type_id: selectedServiceTypeId,
          use_template: true,
          template_script: freshTemplate.script_content,
          service_type_icon_url: selectedServiceType.icon_url,
          template_id: freshTemplate.id, // Send template ID for validation
          service_details: {
            project_min_price: projectMinPrice,
            project_min_size: projectMinSize,
            price_per_sq_ft: pricePerSqFt,
            warranties,
            financing_options: financingOptions,
            video_of_service: videoOfService,
            avg_install_time: avgInstallTime,
            appointment_calendar: appointmentCalendar,
            reschedule_calendar: rescheduleCalendar,
          }
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
        const detailsArray = [
          { name: `${prefix}project_min_price`, value: projectMinPrice },
          { name: `${prefix}project_min_size`, value: projectMinSize },
          { name: `${prefix}price_per_sq_ft`, value: pricePerSqFt },
          { name: `${prefix}warranties`, value: warranties },
          { name: `${prefix}financing_options`, value: financingOptions },
          { name: `${prefix}video_of_service`, value: videoOfService },
          { name: `${prefix}avg_install_time`, value: avgInstallTime },
        ]
          .filter(d => d.value.trim())
          .map(d => ({
            client_id: clientId as string,
            field_name: d.name,
            field_value: d.value,
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
              <CardTitle>Service Details</CardTitle>
              <CardDescription>
                Provide specific information about this service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="min-price">Project Minimum Price</Label>
                <Input
                  id="min-price"
                  placeholder="e.g., $5,000"
                  value={projectMinPrice}
                  onChange={(e) => setProjectMinPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="min-size">Project Minimum Size</Label>
                <Input
                  id="min-size"
                  placeholder="e.g., 500 sq ft"
                  value={projectMinSize}
                  onChange={(e) => setProjectMinSize(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="price-sqft">Price Per Square Foot</Label>
                <Input
                  id="price-sqft"
                  placeholder="e.g., $15-25/sq ft"
                  value={pricePerSqFt}
                  onChange={(e) => setPricePerSqFt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="warranties">Warranties/Guarantees</Label>
                <Textarea
                  id="warranties"
                  placeholder="Describe warranties and guarantees..."
                  value={warranties}
                  onChange={(e) => setWarranties(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <Label htmlFor="financing">Financing Options</Label>
                <Textarea
                  id="financing"
                  placeholder="Describe available financing options..."
                  value={financingOptions}
                  onChange={(e) => setFinancingOptions(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <Label htmlFor="video">Video of Service</Label>
                <Input
                  id="video"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoOfService}
                  onChange={(e) => setVideoOfService(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="install-time">Average Install Time After Booking</Label>
                <Input
                  id="install-time"
                  placeholder="e.g., 2-3 weeks"
                  value={avgInstallTime}
                  onChange={(e) => setAvgInstallTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="appointment">Appointment Calendar Link</Label>
                <Input
                  id="appointment"
                  type="url"
                  placeholder="https://calendly.com/yourlink"
                  value={appointmentCalendar}
                  onChange={(e) => setAppointmentCalendar(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reschedule">Reschedule Calendar Link</Label>
                <Input
                  id="reschedule"
                  type="url"
                  placeholder="https://calendly.com/reschedule"
                  value={rescheduleCalendar}
                  onChange={(e) => setRescheduleCalendar(e.target.value)}
                />
              </div>
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
