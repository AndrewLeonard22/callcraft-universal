import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditClient() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Client basic info
  const [clientName, setClientName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [city, setCity] = useState("");
  
  // Client details as JSON string for easy editing
  const [clientDetailsJson, setClientDetailsJson] = useState("");
  
  // Original data inputs
  const [onboardingForm, setOnboardingForm] = useState("");
  const [transcript, setTranscript] = useState("");
  const [scriptTemplate, setScriptTemplate] = useState("");

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      const [clientResult, detailsResult, scriptResult] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_details").select("*").eq("client_id", clientId),
        supabase.from("scripts").select("script_content").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (clientResult.error) throw clientResult.error;

      setClientName(clientResult.data.name);
      setServiceType(clientResult.data.service_type);
      setCity(clientResult.data.city || "");

      // Convert client details to a readable JSON format and extract original sources
      if (detailsResult.data) {
        const detailsObj: Record<string, string> = {};
        let originalForm = "";
        let originalTranscript = "";
        
        detailsResult.data.forEach((detail) => {
          if (detail.field_name === "_original_onboarding_form") {
            originalForm = detail.field_value || "";
          } else if (detail.field_name === "_original_transcript") {
            originalTranscript = detail.field_value || "";
          } else {
            detailsObj[detail.field_name] = detail.field_value || "";
          }
        });
        
        setClientDetailsJson(JSON.stringify(detailsObj, null, 2));
        setOnboardingForm(originalForm);
        setTranscript(originalTranscript);
      }

      // Load script template from the most recent script
      if (scriptResult.data) {
        setScriptTemplate(scriptResult.data.script_content);
      }
    } catch (error) {
      console.error("Error loading client data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setScriptTemplate(text);
      toast.success("Script uploaded successfully");
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
    }
  };

  const handleSave = async () => {
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    setSaving(true);
    try {
      // Update basic client info
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          name: clientName,
          service_type: serviceType,
          city: city,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId);

      if (clientError) throw clientError;

      // Update client details from JSON
      if (clientDetailsJson.trim()) {
        try {
          const detailsObj = JSON.parse(clientDetailsJson);
          
          // Keep original source data
          const { data: originalData } = await supabase
            .from("client_details")
            .select("*")
            .eq("client_id", clientId)
            .in("field_name", ["_original_onboarding_form", "_original_transcript"]);
          
          // Delete existing details except original source data
          await supabase
            .from("client_details")
            .delete()
            .eq("client_id", clientId)
            .not("field_name", "in", '("_original_onboarding_form","_original_transcript")');
          
          // Insert updated details
          const detailsArray = Object.entries(detailsObj).map(([key, value]) => ({
            client_id: clientId,
            field_name: key,
            field_value: value as string,
          }));

          // Re-add original data
          if (originalData && originalData.length > 0) {
            detailsArray.push(...originalData.map(d => ({
              client_id: clientId,
              field_name: d.field_name,
              field_value: d.field_value || "",
            })));
          }

          const { error: detailsError } = await supabase
            .from("client_details")
            .insert(detailsArray);

          if (detailsError) throw detailsError;
        } catch (parseError) {
          toast.error("Invalid JSON format in client details");
          setSaving(false);
          return;
        }
      }

      toast.success("Client information updated successfully!");
      navigate(`/client/${clientId}`);
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast.error(error.message || "Failed to update client");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!scriptTemplate.trim()) {
      toast.error("Please provide a script template");
      return;
    }

    if (!onboardingForm.trim() && !transcript.trim()) {
      toast.error("Please provide onboarding form or transcript data to regenerate");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { 
          onboarding_form: onboardingForm, 
          transcript: transcript,
          use_template: true,
          template_script: scriptTemplate,
          client_id: clientId,
          regenerate: true,
        },
      });

      if (error) throw error;

      toast.success("Script regenerated successfully!");
      navigate(`/client/${clientId}`);
    } catch (error: any) {
      console.error("Error regenerating script:", error);
      toast.error(error.message || "Failed to regenerate script");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading client data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link to={`/client/${clientId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Scripts
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Edit Client Information</h1>
          <p className="text-muted-foreground">
            Update client details, data sources, and regenerate scripts
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update the client's basic details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client name"
                />
              </div>
              <div>
                <Label htmlFor="service-type">Service Type</Label>
                <Input
                  id="service-type"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="e.g., HVAC, Plumbing, Solar"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Details (JSON)</CardTitle>
              <CardDescription>
                Edit client details in JSON format for full control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder='{"sales_rep_name": "John Doe", "starting_price": "$5,000"}'
                className="min-h-[300px] font-mono text-sm"
                value={clientDetailsJson}
                onChange={(e) => setClientDetailsJson(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Edit the JSON above to update client details. Make sure the JSON is valid.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Script Template</CardTitle>
              <CardDescription>
                Update the base script template for this client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="script-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm font-medium">Upload Script File</span>
                  </div>
                  <input
                    id="script-upload"
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </Label>
                {scriptTemplate && (
                  <span className="text-sm text-muted-foreground">
                    ✓ Script loaded ({scriptTemplate.length} characters)
                  </span>
                )}
              </div>
              
              <div className="relative">
                <Label htmlFor="script-template" className="text-sm font-medium">
                  Or paste your script here
                </Label>
                <Textarea
                  id="script-template"
                  placeholder="Paste your script template here..."
                  className="min-h-[200px] font-mono text-sm mt-2"
                  value={scriptTemplate}
                  onChange={(e) => setScriptTemplate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source Data</CardTitle>
              <CardDescription>
                View and edit the onboarding form or transcript used to generate scripts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="form">Onboarding Form</TabsTrigger>
                  <TabsTrigger value="transcript">Call Transcript</TabsTrigger>
                </TabsList>
                
                <TabsContent value="form">
                  <Textarea
                    placeholder="Paste onboarding form data here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={onboardingForm}
                    onChange={(e) => setOnboardingForm(e.target.value)}
                  />
                </TabsContent>
                
                <TabsContent value="transcript">
                  <Textarea
                    placeholder="Paste call transcript here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
              size="lg"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            
            <Button
              onClick={handleRegenerate}
              disabled={saving}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              {saving ? "Regenerating..." : "Regenerate Script with New Data"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
