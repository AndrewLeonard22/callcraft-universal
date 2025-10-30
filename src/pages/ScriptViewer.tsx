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
  const { scriptId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientData | null>(null);
  const [details, setDetails] = useState<ClientDetail[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scriptId) {
      loadClientData();
    }
  }, [scriptId]);

  const loadClientData = async () => {
    try {
      // First load the script to get the client_id
      const scriptResult = await supabase
        .from("scripts")
        .select("*, client_id, service_name")
        .eq("id", scriptId)
        .single();

      if (scriptResult.error) throw scriptResult.error;
      setScript(scriptResult.data);

      // Then load client and details
      const [clientResult, detailsResult] = await Promise.all([
        supabase.from("clients").select("*").eq("id", scriptResult.data.client_id).single(),
        supabase.from("client_details").select("*").eq("client_id", scriptResult.data.client_id),
      ]);

      if (clientResult.error) throw clientResult.error;

      setClient(clientResult.data);
      setDetails(detailsResult.data || []);
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
    
    const formatLine = (text: string) => {
      const parts: (string | JSX.Element)[] = [];
      let remaining = text;
      let key = 0;
      
      // Process the text to find and replace patterns
      while (remaining.length > 0) {
        // Check for [bracketed text]
        const bracketMatch = remaining.match(/\[([^\]]+)\]/);
        if (bracketMatch && bracketMatch.index !== undefined) {
          // Add text before match
          if (bracketMatch.index > 0) {
            parts.push(remaining.substring(0, bracketMatch.index));
          }
          // Add highlighted span
          parts.push(
            <span key={`bracket-${key++}`} className="bg-primary/20 text-primary font-medium px-2 py-0.5 rounded">
              {bracketMatch[1]}
            </span>
          );
          remaining = remaining.substring(bracketMatch.index + bracketMatch[0].length);
          continue;
        }
        
        // Check for "quoted text"
        const quoteMatch = remaining.match(/"([^"]+)"/);
        if (quoteMatch && quoteMatch.index !== undefined) {
          // Add text before match
          if (quoteMatch.index > 0) {
            parts.push(remaining.substring(0, quoteMatch.index));
          }
          // Add highlighted span
          parts.push(
            <span key={`quote-${key++}`} className="bg-accent/20 text-accent font-medium px-1 rounded">
              {quoteMatch[1]}
            </span>
          );
          remaining = remaining.substring(quoteMatch.index + quoteMatch[0].length);
          continue;
        }
        
        // Check for **bold text**
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
          // Add text before match
          if (boldMatch.index > 0) {
            parts.push(remaining.substring(0, boldMatch.index));
          }
          // Add bold text
          parts.push(
            <strong key={`bold-${key++}`} className="font-bold text-foreground">
              {boldMatch[1]}
            </strong>
          );
          remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
          continue;
        }
        
        // Check for *italic/semibold text*
        const italicMatch = remaining.match(/\*([^*]+)\*/);
        if (italicMatch && italicMatch.index !== undefined) {
          // Add text before match
          if (italicMatch.index > 0) {
            parts.push(remaining.substring(0, italicMatch.index));
          }
          // Add semibold text
          parts.push(
            <strong key={`semi-${key++}`} className="font-semibold">
              {italicMatch[1]}
            </strong>
          );
          remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
          continue;
        }
        
        // No more matches, add remaining text
        parts.push(remaining);
        break;
      }
      
      return parts.length > 0 ? parts : text;
    };
    
    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          // Section headers (all caps or ending with colon)
          if (line.match(/^[A-Z\s]+:$/) || line.match(/^[*#]+\s*[A-Z][^a-z]*$/)) {
            return (
              <h3 key={index} className="text-base font-bold mt-5 mb-2 first:mt-0 text-primary border-b border-border pb-1">
                {line.replace(/^[*#]+\s*/, '').replace(/:$/, '')}
              </h3>
            );
          }
          
          // Stage markers (like "Stage 1:", "Phase 2:")
          if (line.match(/^(Stage|Phase|Step)\s+\d+/i)) {
            return (
              <h4 key={index} className="text-sm font-semibold mt-3 mb-1.5 text-accent">
                {line}
              </h4>
            );
          }
          
          // Sub-headers (lines starting with ** or ending with :)
          if (line.match(/^\*\*[^*]+\*\*/) || (line.endsWith(':') && line.length < 60 && !line.includes('.'))) {
            return (
              <h5 key={index} className="font-semibold text-sm mt-2.5 mb-0.5 text-foreground">
                {line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/:$/, '')}
              </h5>
            );
          }
          
          // Empty lines
          if (!line.trim()) {
            return <div key={index} className="h-1" />;
          }
          
          // Regular content with formatting
          return (
            <p key={index} className="text-sm leading-relaxed text-foreground/90">
              {formatLine(line)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(`/client/${client.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scripts
        </Button>

        {/* Client Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {client.name}
              </h1>
              <p className="text-lg text-muted-foreground capitalize">
                {(script as any)?.service_name || client.service_type} {client.city && `• ${client.city}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Script
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>

          {/* Client Information Section */}
          <Card className="mb-6 shadow-lg border-2">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4 text-primary">Client Information</h2>
              
              {/* Key Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {getDetailValue("sales_rep_name") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Sales Representative</div>
                    <div className="text-base font-semibold">{getDetailValue("sales_rep_name")}</div>
                    {getDetailValue("sales_rep_phone") !== "N/A" && (
                      <div className="text-sm text-muted-foreground">{getDetailValue("sales_rep_phone")}</div>
                    )}
                  </div>
                )}
                
                {getDetailValue("starting_price") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Starting Price</div>
                    <div className="text-base font-semibold">{getDetailValue("starting_price")}</div>
                  </div>
                )}
                
                {getDetailValue("minimum_size") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Minimum Size</div>
                    <div className="text-base font-semibold">{getDetailValue("minimum_size")}</div>
                  </div>
                )}
                
                {getDetailValue("warranty") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Warranty</div>
                    <div className="text-base font-semibold">{getDetailValue("warranty")}</div>
                  </div>
                )}
                
                {getDetailValue("guarantee") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Guarantee</div>
                    <div className="text-base font-semibold">{getDetailValue("guarantee")}</div>
                  </div>
                )}
                
                {getDetailValue("years_in_business") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Years in Business</div>
                    <div className="text-base font-semibold">{getDetailValue("years_in_business")}</div>
                  </div>
                )}
              </div>

              {/* Contact & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {getDetailValue("address") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Address</div>
                    <div className="text-base">{getDetailValue("address")}</div>
                  </div>
                )}
                
                {getDetailValue("service_area") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Service Area</div>
                    <div className="text-base">{getDetailValue("service_area")}</div>
                  </div>
                )}
              </div>

              {/* Offer Details */}
              {(getDetailValue("offer_name") !== "N/A" || getDetailValue("offer_description") !== "N/A") && (
                <div className="border-t pt-4 mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-accent">Current Offer</h3>
                  {getDetailValue("offer_name") !== "N/A" && (
                    <div className="text-base font-semibold mb-2">{getDetailValue("offer_name")}</div>
                  )}
                  {getDetailValue("offer_description") !== "N/A" && (
                    <div className="text-sm text-muted-foreground">{getDetailValue("offer_description")}</div>
                  )}
                </div>
              )}

              {/* Additional Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getDetailValue("business_hours") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Business Hours</div>
                    <div className="text-sm">{getDetailValue("business_hours")}</div>
                  </div>
                )}
                
                {getDetailValue("financing_options") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Financing</div>
                    <div className="text-sm">{getDetailValue("financing_options")}</div>
                  </div>
                )}
                
                {getDetailValue("appointment_link") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Appointment Link</div>
                    <a href={getDetailValue("appointment_link")} target="_blank" rel="noopener noreferrer" 
                       className="text-sm text-primary hover:underline break-all">
                      {getDetailValue("appointment_link")}
                    </a>
                  </div>
                )}
                
                {getDetailValue("calendar_link") !== "N/A" && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Calendar Link</div>
                    <a href={getDetailValue("calendar_link")} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-primary hover:underline break-all">
                      {getDetailValue("calendar_link")}
                    </a>
                  </div>
                )}
              </div>

              {/* Script Version */}
              <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
                Script Version: v{script.version}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call Script */}
        <Card className="shadow-lg border-2">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4 text-primary">Call Script</h2>
            <div className="prose prose-lg max-w-none">
              <FormattedScript content={script.script_content} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}