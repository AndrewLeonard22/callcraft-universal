import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
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
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClient();
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

  const handleGenerate = async () => {
    if (!serviceName.trim()) {
      toast.error("Please enter a service name");
      return;
    }

    if (!scriptTemplate.trim()) {
      toast.error("Please provide a script template");
      return;
    }

    if (!onboardingForm.trim() && !transcript.trim()) {
      toast.error("Please provide onboarding form data or transcript");
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
          template_script: scriptTemplate
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
              <CardTitle>Service Name</CardTitle>
              <CardDescription>
                What service is this script for?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g., Lawn Care, Pool Installation, Deck Building"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Script Template</CardTitle>
              <CardDescription>
                Upload or paste your base script for this service
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
              <CardTitle>Service Details</CardTitle>
              <CardDescription>
                Provide information to customize the script
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
