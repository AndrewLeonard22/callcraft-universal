import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Download, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientData {
  id: string;
  name: string;
  service_type: string;
  city: string;
}

interface ClientDetail {
  field_name: string;
  field_value: string;
}

interface Script {
  script_content: string;
  version: number;
}

export default function ScriptViewer() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientData | null>(null);
  const [details, setDetails] = useState<ClientDetail[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);

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
        supabase.from("scripts").select("*").eq("client_id", clientId).order("version", { ascending: false }).limit(1).single(),
      ]);

      if (clientResult.error) throw clientResult.error;
      if (scriptResult.error) throw scriptResult.error;

      setClient(clientResult.data);
      setDetails(detailsResult.data || []);
      setScript(scriptResult.data);
    } catch (error) {
      console.error("Error loading client data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (script) {
      navigator.clipboard.writeText(script.script_content);
      toast.success("Script copied to clipboard!");
    }
  };

  const handleDownload = () => {
    if (script && client) {
      const blob = new Blob([script.script_content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${client.name.replace(/\s+/g, "-")}-script.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Script downloaded!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-8" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!client || !script) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto text-center py-16">
          <h2 className="text-2xl font-bold mb-4">Client not found</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getDetailValue = (fieldName: string) => {
    return details.find((d) => d.field_name === fieldName)?.field_value || "N/A";
  };

  const FormattedScript = ({ content }: { content: string }) => {
    const lines = content.split('\n');
    
    return (
      <div className="space-y-4">
        {lines.map((line, index) => {
          // Section headers (all caps or ending with colon)
          if (line.match(/^[A-Z\s]+:$/) || line.match(/^[*#]+\s*[A-Z][^a-z]*$/)) {
            return (
              <h3 key={index} className="text-xl font-bold mt-6 mb-3 text-primary border-b-2 border-primary/20 pb-2">
                {line.replace(/^[*#]+\s*/, '').replace(/:$/, '')}
              </h3>
            );
          }
          
          // Stage markers (like "Stage 1:", "Phase 2:")
          if (line.match(/^(Stage|Phase|Step)\s+\d+/i)) {
            return (
              <h4 key={index} className="text-lg font-semibold mt-4 mb-2 text-accent">
                {line}
              </h4>
            );
          }
          
          // Sub-headers (lines starting with ** or ending with :)
          if (line.match(/^\*\*[^*]+\*\*/) || (line.endsWith(':') && line.length < 60 && !line.includes('.'))) {
            return (
              <h5 key={index} className="font-bold text-base mt-3 mb-1 text-foreground">
                {line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/:$/, '')}
              </h5>
            );
          }
          
          // Format inline content
          let formattedLine = line;
          
          // Highlight names in brackets or quotes
          formattedLine = formattedLine.replace(/\[([^\]]+)\]/g, '<span class="bg-primary/20 text-primary font-medium px-2 py-0.5 rounded">$1</span>');
          formattedLine = formattedLine.replace(/"([^"]+)"/g, '<span class="bg-accent/20 text-accent font-medium px-1 rounded">$1</span>');
          
          // Bold text between asterisks
          formattedLine = formattedLine.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>');
          formattedLine = formattedLine.replace(/\*([^*]+)\*/g, '<strong class="font-semibold">$1</strong>');
          
          // Empty lines
          if (!line.trim()) {
            return <div key={index} className="h-2" />;
          }
          
          // Regular content
          return (
            <p key={index} className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {client.name}
              </h1>
              <p className="text-muted-foreground capitalize">
                {client.service_type} {client.city && `• ${client.city}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground mb-1">Sales Rep</div>
                <div className="font-medium">{getDetailValue("sales_rep_name")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground mb-1">Starting Price</div>
                <div className="font-medium">{getDetailValue("starting_price")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground mb-1">Warranty</div>
                <div className="font-medium">{getDetailValue("warranty")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground mb-1">Version</div>
                <div className="font-medium">v{script.version}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="prose prose-lg max-w-none">
              <FormattedScript content={script.script_content} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}