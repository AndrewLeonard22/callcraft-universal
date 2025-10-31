import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Download, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ServiceAreaMap from "@/components/ServiceAreaMap";
import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";

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

// Helper to get logo based on service type
const getClientLogo = (serviceType: string, customLogoUrl?: string): string => {
  // If custom logo exists, use it
  if (customLogoUrl) return customLogoUrl;
  
  // Otherwise fall back to default logos based on service type
  const type = serviceType.toLowerCase();
  
  if (type.includes("pergola")) return logoPergola;
  if (type.includes("hvac") || type.includes("heating") || type.includes("cooling")) return logoHvac;
  if (type.includes("solar") || type.includes("panel")) return logoSolar;
  if (type.includes("landscape") || type.includes("lawn") || type.includes("garden")) return logoLandscaping;
  
  return logoDefault;
};

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
    // First check for script-specific details
    const scriptSpecific = details.find((d) => d.field_name === `script_${scriptId}_${fieldName}`)?.field_value;
    if (scriptSpecific) return scriptSpecific;
    
    // Fall back to general client details
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
            <span key={`bracket-${key++}`} className="bg-primary/5 text-primary font-medium px-1.5 py-0.5 rounded">
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
            <span key={`quote-${key++}`} className="bg-accent/5 text-accent font-medium px-1 rounded">
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
      <div className="space-y-4">
        {lines.map((line, index) => {
          // Main numbered sections (like "1. SECTION NAME" or "3. UNDERSTAND WHY THEY CALLED")
          if (line.match(/^\d+\.\s+[A-Z]/)) {
            return (
              <h3 key={index} className="text-2xl font-bold mt-8 mb-4 first:mt-0 text-foreground">
                {line}
              </h3>
            );
          }
          
          // Section headers (all caps or ending with colon)
          if (line.match(/^[A-Z\s]+:$/) || line.match(/^[*#]+\s*[A-Z][^a-z]*$/)) {
            return (
              <h3 key={index} className="text-xl font-bold mt-8 mb-4 first:mt-0 text-foreground">
                {line.replace(/^[*#]+\s*/, '').replace(/:$/, '')}
              </h3>
            );
          }
          
          // Stage markers (like "Stage 1:", "Phase 2:")
          if (line.match(/^(Stage|Phase|Step)\s+\d+/i)) {
            return (
              <h4 key={index} className="text-lg font-semibold mt-6 mb-3 text-foreground">
                {line}
              </h4>
            );
          }
          
          // Sub-headers (lines starting with ** or ending with :)
          if (line.match(/^\*\*[^*]+\*\*/) || (line.endsWith(':') && line.length < 60 && !line.includes('.'))) {
            return (
              <h5 key={index} className="font-semibold text-base mt-4 mb-2 text-foreground">
                {line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/:$/, '')}
              </h5>
            );
          }
          
          // Empty lines
          if (!line.trim()) {
            return <div key={index} className="h-2" />;
          }
          
          // Regular content with formatting
          return (
            <p key={index} className="text-[15px] leading-relaxed text-foreground/80">
              {formatLine(line)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Button variant="ghost" className="mb-8 -ml-3" onClick={() => navigate(`/client/${client.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scripts
        </Button>

        {/* Client Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4 flex-1">
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border shadow-sm">
                <img 
                  src={getClientLogo(client.service_type, getDetailValue("logo_url") !== "N/A" ? getDetailValue("logo_url") : undefined)} 
                  alt={`${client.name} logo`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-3xl font-semibold mb-2 text-foreground">
                  {client.name}
                </h1>
                <p className="text-base text-muted-foreground capitalize">
                  {(script as any)?.service_name || client.service_type} {client.city && `• ${client.city}`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate(`/edit-script/${scriptId}`)} className="h-9">
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" onClick={handleCopy} className="h-9">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleDownload} className="h-9">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Two Column Layout: Sticky Sidebar + Scrollable Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sticky Sidebar - Client Information */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
              {/* Service Area Map */}
              {(client.city || getDetailValue("service_area") !== "N/A") && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Service Area</h2>
                    <ServiceAreaMap 
                      city={client.city} 
                      serviceArea={getDetailValue("service_area")}
                      address={getDetailValue("address")}
                    />
                    {getDetailValue("service_area") !== "N/A" && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Coverage: {getDetailValue("service_area")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Client Information Section */}
              <Card className="border border-border shadow-sm">
                <CardContent className="p-6">
                  <h2 className="text-base font-semibold mb-4 text-foreground">Client Information</h2>
                  
                  {/* Key Details */}
                  <div className="space-y-4">
                    {getDetailValue("business_name") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Name</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("business_name")}</div>
                      </div>
                    )}

                    {getDetailValue("owners_name") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owner's Name</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("owners_name")}</div>
                      </div>
                    )}

                    {(getDetailValue("sales_rep_name") !== "N/A" || getDetailValue("sales_rep_phone") !== "N/A") && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sales Rep</div>
                        {getDetailValue("sales_rep_name") !== "N/A" && (
                          <div className="text-sm font-medium text-foreground">{getDetailValue("sales_rep_name")}</div>
                        )}
                        {getDetailValue("sales_rep_phone") !== "N/A" && (
                          <div className="text-xs text-muted-foreground">{getDetailValue("sales_rep_phone")}</div>
                        )}
                      </div>
                    )}
                    
                    {getDetailValue("starting_price") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Starting Price</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("starting_price")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("minimum_size") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum Size</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("minimum_size")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("warranty") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Warranty</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("warranty")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("guarantee") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guarantee</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("guarantee")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("years_in_business") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Years in Business</div>
                        <div className="text-sm font-medium text-foreground">{getDetailValue("years_in_business")}</div>
                      </div>
                    )}

                    {getDetailValue("address") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</div>
                        <div className="text-sm text-foreground">{getDetailValue("address")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("business_hours") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hours</div>
                        <div className="text-sm text-foreground">{getDetailValue("business_hours")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("financing_options") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Financing</div>
                        <div className="text-sm text-foreground">{getDetailValue("financing_options")}</div>
                      </div>
                    )}
                    
                    {getDetailValue("other_key_info") !== "N/A" && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Additional Info</div>
                        <div className="text-sm text-foreground whitespace-pre-wrap">{getDetailValue("other_key_info")}</div>
                      </div>
                    )}
                  </div>

                  {/* Service Details Section */}
                  {(getDetailValue("project_min_price") !== "N/A" || 
                    getDetailValue("project_min_size") !== "N/A" || 
                    getDetailValue("price_per_sq_ft") !== "N/A" || 
                    getDetailValue("warranties") !== "N/A" || 
                    getDetailValue("financing_options") !== "N/A" ||
                    getDetailValue("video_of_service") !== "N/A" ||
                    getDetailValue("avg_install_time") !== "N/A") && (
                    <div className="border-t border-border pt-4 mt-4">
                      <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide">Service Details</h3>
                      <div className="space-y-3">
                        {getDetailValue("project_min_price") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Minimum Price</div>
                            <div className="text-sm text-foreground">{getDetailValue("project_min_price")}</div>
                          </div>
                        )}
                        
                        {getDetailValue("project_min_size") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Minimum Size</div>
                            <div className="text-sm text-foreground">{getDetailValue("project_min_size")}</div>
                          </div>
                        )}
                        
                        {getDetailValue("price_per_sq_ft") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Price per Sq Ft</div>
                            <div className="text-sm text-foreground">{getDetailValue("price_per_sq_ft")}</div>
                          </div>
                        )}
                        
                        {getDetailValue("warranties") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Warranties</div>
                            <div className="text-sm text-foreground whitespace-pre-wrap">{getDetailValue("warranties")}</div>
                          </div>
                        )}
                        
                        {getDetailValue("financing_options") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Financing Options</div>
                            <div className="text-sm text-foreground whitespace-pre-wrap">{getDetailValue("financing_options")}</div>
                          </div>
                        )}
                        
                        {getDetailValue("video_of_service") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Service Video</div>
                            <a href={getDetailValue("video_of_service")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 transition-colors block">
                              Watch Video
                            </a>
                          </div>
                        )}
                        
                        {getDetailValue("avg_install_time") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Install Time</div>
                            <div className="text-sm text-foreground">{getDetailValue("avg_install_time")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Links Section */}
                  {(getDetailValue("website") !== "N/A" || 
                    getDetailValue("facebook_page") !== "N/A" || 
                    getDetailValue("instagram") !== "N/A" || 
                    getDetailValue("crm_account_link") !== "N/A" || 
                    getDetailValue("appointment_calendar") !== "N/A" || 
                    getDetailValue("reschedule_calendar") !== "N/A" ||
                    getDetailValue("appointment_link") !== "N/A") && (
                    <div className="border-t border-border pt-4 mt-4">
                      <h3 className="text-xs font-semibold mb-3 text-foreground uppercase tracking-wide">Links</h3>
                      <div className="space-y-3">
                        {getDetailValue("website") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Website</div>
                            <a href={getDetailValue("website")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              {getDetailValue("website")}
                            </a>
                          </div>
                        )}

                        {getDetailValue("facebook_page") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Facebook</div>
                            <a href={getDetailValue("facebook_page")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              View Page
                            </a>
                          </div>
                        )}

                        {getDetailValue("instagram") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Instagram</div>
                            <a href={getDetailValue("instagram")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              View Profile
                            </a>
                          </div>
                        )}

                        {getDetailValue("crm_account_link") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">CRM Account</div>
                            <a href={getDetailValue("crm_account_link")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              Open CRM
                            </a>
                          </div>
                        )}

                        {getDetailValue("appointment_calendar") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Appointment Calendar</div>
                            <a href={getDetailValue("appointment_calendar")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              Schedule
                            </a>
                          </div>
                        )}

                        {getDetailValue("reschedule_calendar") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Reschedule Calendar</div>
                            <a href={getDetailValue("reschedule_calendar")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              Reschedule
                            </a>
                          </div>
                        )}

                        {getDetailValue("appointment_link") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Appointment Link</div>
                            <a href={getDetailValue("appointment_link")} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              Book Now
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Offer Details */}
                  {(getDetailValue("offer_name") !== "N/A" || getDetailValue("offer_description") !== "N/A") && (
                    <div className="border-t border-border pt-4 mt-4">
                      <h3 className="text-xs font-semibold mb-2 text-foreground uppercase tracking-wide">Current Offer</h3>
                      {getDetailValue("offer_name") !== "N/A" && (
                        <div className="text-sm font-medium mb-1 text-foreground">{getDetailValue("offer_name")}</div>
                      )}
                      {getDetailValue("offer_description") !== "N/A" && (
                        <div className="text-xs text-muted-foreground">{getDetailValue("offer_description")}</div>
                      )}
                    </div>
                  )}

                  {/* Script Version */}
                  <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    Script Version: v{script.version}
                  </div>
                </CardContent>
              </Card>

              {/* Service Information Section */}
              {(getDetailValue("project_min_price") !== "N/A" || 
                getDetailValue("project_min_size") !== "N/A" || 
                getDetailValue("price_per_sq_ft") !== "N/A" || 
                getDetailValue("warranties") !== "N/A" || 
                getDetailValue("financing_options") !== "N/A" || 
                getDetailValue("video_of_service") !== "N/A" || 
                getDetailValue("avg_install_time") !== "N/A") && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Service Information</h2>
                    
                    <div className="space-y-4">
                      {getDetailValue("project_min_price") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Minimum Price</div>
                          <div className="text-sm font-medium text-foreground">{getDetailValue("project_min_price")}</div>
                        </div>
                      )}

                      {getDetailValue("project_min_size") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Minimum Size</div>
                          <div className="text-sm font-medium text-foreground">{getDetailValue("project_min_size")}</div>
                        </div>
                      )}

                      {getDetailValue("price_per_sq_ft") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price Per Square Foot</div>
                          <div className="text-sm font-medium text-foreground">{getDetailValue("price_per_sq_ft")}</div>
                        </div>
                      )}

                      {getDetailValue("warranties") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Warranties/Guarantees</div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">{getDetailValue("warranties")}</div>
                        </div>
                      )}

                      {getDetailValue("financing_options") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Financing Options</div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">{getDetailValue("financing_options")}</div>
                        </div>
                      )}

                      {getDetailValue("video_of_service") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video of Service</div>
                          <a href={getDetailValue("video_of_service")} target="_blank" rel="noopener noreferrer" 
                             className="text-sm text-primary hover:text-primary/80 break-all transition-colors block">
                            Watch Video
                          </a>
                        </div>
                      )}

                      {getDetailValue("avg_install_time") !== "N/A" && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Average Install Time After Booking</div>
                          <div className="text-sm font-medium text-foreground">{getDetailValue("avg_install_time")}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Main Content - Call Script */}
          <div className="lg:col-span-2">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-8">
                <h2 className="text-lg font-semibold mb-6 text-foreground">Additional Info</h2>
                <div className="max-w-none">
                  <FormattedScript content={script.script_content} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}