import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function CreateClient() {
  const navigate = useNavigate();
  const [onboardingForm, setOnboardingForm] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!onboardingForm.trim() && !transcript.trim()) {
      toast.error("Please provide at least one input");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: {
          onboarding_form: onboardingForm,
          transcript: transcript,
        },
      });

      if (error) throw error;

      toast.success("Client script generated successfully!");
      navigate(`/script/${data.client_id}`);
    } catch (error) {
      console.error("Error generating script:", error);
      toast.error("Failed to generate script. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Create New Client Script
          </h1>
          <p className="text-muted-foreground">
            Upload or paste your onboarding form and call transcript. Our AI will extract all relevant
            information and generate a customized call script.
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Onboarding Form Data
              </CardTitle>
              <CardDescription>
                Paste the client's onboarding form responses including company details, services, pricing, etc.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Company Name: Backyard Paradiso NJ&#10;Service Type: Pergola Installation&#10;City: New Jersey&#10;Starting Price: $8,000&#10;..."
                value={onboardingForm}
                onChange={(e) => setOnboardingForm(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Onboarding Call Transcript
              </CardTitle>
              <CardDescription>
                Paste the transcript from your onboarding call (from Fathom, Zoom, or plain text)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="[00:01] Agent: Thanks for joining us today. Can you tell me about your business?&#10;[00:15] Client: We've been installing pergolas in New Jersey for 15 years..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Sparkles className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">AI-Powered Extraction</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Our AI will automatically extract company name, services, pricing, warranties, sales rep
                    details, and more to generate a complete call script.
                  </p>
                  <Button
                    onClick={handleGenerate}
                    disabled={loading}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                        Generating Script...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Script with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}