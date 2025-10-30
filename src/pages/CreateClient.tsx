import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CreateClient() {
  const navigate = useNavigate();
  const [onboardingForm, setOnboardingForm] = useState("");
  const [transcript, setTranscript] = useState("");
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Links
  const [website, setWebsite] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [crmAccountLink, setCrmAccountLink] = useState("");
  const [appointmentCalendar, setAppointmentCalendar] = useState("");
  const [rescheduleCalendar, setRescheduleCalendar] = useState("");

  const handleFormUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.type === "application/pdf") {
        toast.error("PDF parsing requires backend processing. Please paste the text content instead.");
      } else {
        const text = await file.text();
        setOnboardingForm(text);
        toast.success("Form uploaded successfully");
      }
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
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
    if (!onboardingForm.trim() && !transcript.trim()) {
      toast.error("Please provide onboarding form data or transcript");
      return;
    }

    if (!scriptTemplate.trim()) {
      toast.error("Please provide a script template");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { 
          onboarding_form: onboardingForm, 
          transcript: transcript,
          use_template: true,
          template_script: scriptTemplate,
          links: {
            website,
            facebook_page: facebookPage,
            instagram,
            crm_account_link: crmAccountLink,
            appointment_calendar: appointmentCalendar,
            reschedule_calendar: rescheduleCalendar,
          }
        },
      });

      if (error) throw error;

      toast.success("Client and script created successfully!");
      navigate(`/client/${data.client_id}`);
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Client</h1>
          <p className="text-muted-foreground">
            Upload your script template and provide client data to generate a customized call script
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Script Template</CardTitle>
              <CardDescription>
                Upload or paste your base script that will be customized for this client
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
              <CardTitle>Client Information</CardTitle>
              <CardDescription>
                Provide the onboarding data that will be used to customize the script
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="form">Onboarding Form</TabsTrigger>
                  <TabsTrigger value="transcript">Call Transcript</TabsTrigger>
                  <TabsTrigger value="links">Links</TabsTrigger>
                </TabsList>
                
                <TabsContent value="form">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Label htmlFor="form-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors">
                          <Upload className="h-4 w-4" />
                          <span className="text-sm font-medium">Upload PDF/Text File</span>
                        </div>
                        <input
                          id="form-upload"
                          type="file"
                          accept=".txt,.md,.pdf"
                          onChange={handleFormUpload}
                          className="hidden"
                        />
                      </Label>
                    </div>
                    <Textarea
                      placeholder="Paste onboarding form data here..."
                      className="min-h-[200px] font-mono text-sm"
                      value={onboardingForm}
                      onChange={(e) => setOnboardingForm(e.target.value)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="transcript">
                  <Textarea
                    placeholder="Paste call transcript here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="links">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://example.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="facebook">Facebook Page</Label>
                      <Input
                        id="facebook"
                        type="url"
                        placeholder="https://facebook.com/yourpage"
                        value={facebookPage}
                        onChange={(e) => setFacebookPage(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        type="url"
                        placeholder="https://instagram.com/yourprofile"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="crm">CRM Account Link</Label>
                      <Input
                        id="crm"
                        type="url"
                        placeholder="https://crm.example.com/account"
                        value={crmAccountLink}
                        onChange={(e) => setCrmAccountLink(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="appointment">Appointment Calendar</Label>
                      <Input
                        id="appointment"
                        type="url"
                        placeholder="https://calendly.com/yourlink"
                        value={appointmentCalendar}
                        onChange={(e) => setAppointmentCalendar(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reschedule">Reschedule Calendar</Label>
                      <Input
                        id="reschedule"
                        type="url"
                        placeholder="https://calendly.com/reschedule"
                        value={rescheduleCalendar}
                        onChange={(e) => setRescheduleCalendar(e.target.value)}
                      />
                    </div>
                  </div>
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
