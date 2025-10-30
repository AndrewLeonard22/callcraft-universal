import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Client {
  id: string;
  name: string;
  service_type: string;
  city: string;
}

export default function CreateScript() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [onboardingForm, setOnboardingForm] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [templateScript, setTemplateScript] = useState("");

  useEffect(() => {
    loadClientAndTemplate();
  }, [clientId]);

  const loadClientAndTemplate = async () => {
    try {
      // Load client data
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Load template script
      const { data: templateData, error: templateError } = await supabase
        .from("scripts")
        .select("script_content")
        .eq("is_template", true)
        .eq("service_name", "Outdoor Services Template")
        .single();

      if (templateError) {
        console.error("Error loading template:", templateError);
      } else {
        setTemplateScript(templateData.script_content);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load client data");
    }
  };

  const handleGenerate = async () => {
    if (!serviceName.trim()) {
      toast.error("Please enter a service name");
      return;
    }

    if (!onboardingForm.trim() && !transcript.trim()) {
      toast.error("Please provide either onboarding form data or a transcript");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: {
          client_id: clientId,
          service_name: serviceName,
          onboarding_form: onboardingForm,
          transcript: transcript,
          use_template: true,
          template_script: templateScript
        },
      });

      if (error) throw error;

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
      <div className="container mx-auto p-8 max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Link to={`/client/${clientId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create New Script</h1>
            <p className="text-muted-foreground">For {client.name}</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Information</CardTitle>
              <CardDescription>
                What service is this script for?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="serviceName">Service Name</Label>
                <Input
                  id="serviceName"
                  placeholder="e.g., Lawn Care, Pool Installation, Deck Building"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="custom" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="custom">Custom Data</TabsTrigger>
              <TabsTrigger value="template">View Template</TabsTrigger>
            </TabsList>
            
            <TabsContent value="custom" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Onboarding Form Data</CardTitle>
                  <CardDescription>
                    Paste the onboarding form information here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Paste onboarding form data here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={onboardingForm}
                    onChange={(e) => setOnboardingForm(e.target.value)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Onboarding Call Transcript</CardTitle>
                  <CardDescription>
                    Paste the call transcript here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Paste call transcript here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="template">
              <Card>
                <CardHeader>
                  <CardTitle>Script Template</CardTitle>
                  <CardDescription>
                    This template will be customized with your client's data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{templateScript}</pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Generating Script..." : "Generate Script with AI"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
