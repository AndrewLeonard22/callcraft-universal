import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  script_content: string;
  version: number;
}

export default function EditScript() {
  const navigate = useNavigate();
  const { scriptId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [scriptContent, setScriptContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadScriptData();
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
      setScriptContent(scriptData.script_content);

      // Load the client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", scriptData.client_id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);
    } catch (error) {
      console.error("Error loading script:", error);
      toast.error("Failed to load script data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!scriptContent.trim()) {
      toast.error("Script content cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("scripts")
        .update({ script_content: scriptContent })
        .eq("id", scriptId);

      if (error) throw error;

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
            {client.name} - {script.service_name}
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Script Content</CardTitle>
              <CardDescription>
                Edit the script content below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="script-content">Script</Label>
                <Textarea
                  id="script-content"
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  placeholder="Enter script content..."
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
