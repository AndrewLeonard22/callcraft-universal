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

interface Script {
  id: string;
  client_id: string;
  service_name: string;
  service_type_id: string;
  script_content: string;
  version: number;
}

interface Template {
  id: string;
  service_name: string;
  script_content: string;
  image_url?: string;
}

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

export default function EditScript() {
  const navigate = useNavigate();
  const { scriptId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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
    loadScriptData();
    loadTemplates();
    loadServiceTypes();
  }, [scriptId]);

  const loadScriptData = async () => {
    try {
      // Load the script
      const { data: scriptData, error: scriptError } = await supabase
        .from("scripts")
        .select("*")
        .eq("id", scriptId)
        .single();

      if (scriptError) throw scriptError;
      setScript(scriptData);
      setSelectedServiceTypeId(scriptData.service_type_id || "");

      // Load the client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", scriptData.client_id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Load service details - check both script-specific and general client details
      const { data: details } = await supabase
        .from("client_details")
        .select("*")
        .eq("client_id", scriptData.client_id);

      if (details) {
        const scriptPrefix = `script_${scriptId}_`;
        details.forEach((detail) => {
          const fieldName = detail.field_name;
          const fieldValue = detail.field_value || "";
          
          // Check for script-specific details first, then fall back to general
          if (fieldName === `${scriptPrefix}project_min_price` || fieldName === "project_min_price") {
            if (!projectMinPrice) setProjectMinPrice(fieldValue);
          }
          if (fieldName === `${scriptPrefix}project_min_size` || fieldName === "project_min_size") {
            if (!projectMinSize) setProjectMinSize(fieldValue);
          }
          if (fieldName === `${scriptPrefix}price_per_sq_ft` || fieldName === "price_per_sq_ft") {
            if (!pricePerSqFt) setPricePerSqFt(fieldValue);
          }
          if (fieldName === `${scriptPrefix}warranties` || fieldName === "warranties") {
            if (!warranties) setWarranties(fieldValue);
          }
          if (fieldName === `${scriptPrefix}financing_options` || fieldName === "financing_options") {
            if (!financingOptions) setFinancingOptions(fieldValue);
          }
          if (fieldName === `${scriptPrefix}video_of_service` || fieldName === "video_of_service") {
            if (!videoOfService) setVideoOfService(fieldValue);
          }
          if (fieldName === `${scriptPrefix}avg_install_time` || fieldName === "avg_install_time") {
            if (!avgInstallTime) setAvgInstallTime(fieldValue);
          }
          if (fieldName === "appointment_calendar") setAppointmentCalendar(fieldValue);
          if (fieldName === "reschedule_calendar") setRescheduleCalendar(fieldValue);
        });
      }
    } catch (error) {
      console.error("Error loading script:", error);
      toast.error("Failed to load script data");
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("scripts")
        .select("id, service_name, script_content, image_url")
        .eq("is_template", true)
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

  const handleSave = async () => {
    if (!selectedServiceTypeId) {
      toast.error("Please select a service type");
      return;
    }

    const selectedServiceType = serviceTypes.find(t => t.id === selectedServiceTypeId);
    if (!selectedServiceType) {
      toast.error("Invalid service type selected");
      return;
    }

    setSaving(true);
    try {
      // Save service details to client_details with script-specific prefix
      const scriptPrefix = `script_${scriptId}_`;
      const detailsToSave = [
        { name: `${scriptPrefix}project_min_price`, value: projectMinPrice },
        { name: `${scriptPrefix}project_min_size`, value: projectMinSize },
        { name: `${scriptPrefix}price_per_sq_ft`, value: pricePerSqFt },
        { name: `${scriptPrefix}warranties`, value: warranties },
        { name: `${scriptPrefix}financing_options`, value: financingOptions },
        { name: `${scriptPrefix}video_of_service`, value: videoOfService },
        { name: `${scriptPrefix}avg_install_time`, value: avgInstallTime },
      ];

      // Delete existing script-specific details
      await supabase
        .from("client_details")
        .delete()
        .eq("client_id", client?.id)
        .like("field_name", `${scriptPrefix}%`);

      // Insert new details
      const detailsArray = detailsToSave
        .filter(d => d.value.trim())
        .map(d => ({
          client_id: client?.id,
          field_name: d.name,
          field_value: d.value,
        }));

      if (detailsArray.length > 0) {
        await supabase.from("client_details").insert(detailsArray);
      }

      // If template is selected, regenerate script with new details
      if (selectedTemplateId) {
        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        if (!selectedTemplate) {
          toast.error("Invalid template selected");
          setSaving(false);
          return;
        }

        const { error } = await supabase.functions.invoke("extract-client-data", {
          body: {
            client_id: client?.id,
            service_name: selectedServiceType.name,
            service_type_id: selectedServiceTypeId,
            use_template: true,
            template_script: selectedTemplate.script_content,
            script_id: scriptId,
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
      } else {
        // Just update service type and name
        const { error } = await supabase
          .from("scripts")
          .update({ 
            service_name: selectedServiceType.name,
            service_type_id: selectedServiceTypeId
          })
          .eq("id", scriptId);

        if (error) throw error;
      }

      toast.success("Script updated successfully!");
      navigate(`/script/${scriptId}`);
    } catch (error: any) {
      console.error("Error saving script:", error);
      toast.error(error.message || "Failed to save script");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!client || !script) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Script not found</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link to={`/script/${scriptId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Script
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Edit Script</h1>
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
                  <CardTitle>Update Script Template (Optional)</CardTitle>
                  <CardDescription>
                    Choose a new template to regenerate the script
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
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current script or select a template..." />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {templates.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No templates available. Create one first.
                    </div>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.service_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
              <CardDescription>
                Update specific information about this service
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

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
              size="lg"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/script/${scriptId}`)}
              disabled={saving}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
