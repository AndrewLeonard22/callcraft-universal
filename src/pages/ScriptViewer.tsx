import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Download, Copy, MessageSquare, X, ClipboardCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  service_type_id?: string;
}

interface ObjectionTemplate {
  id: string;
  service_name: string;
  content: string;
}

interface FAQ {
  id: string;
  service_type_id: string;
  question: string;
  answer: string;
}

interface QualificationQuestion {
  id: string;
  service_type_id: string | null;
  question: string;
  display_order: number;
}

interface QualificationResponse {
  id: string;
  script_id: string;
  question_id: string;
  is_asked: boolean;
  customer_response: string | null;
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
  const [desiredSqFt, setDesiredSqFt] = useState("");
  const [objectionTemplates, setObjectionTemplates] = useState<ObjectionTemplate[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [showObjections, setShowObjections] = useState(false);
  const [showFaqs, setShowFaqs] = useState(false);
  const [showQualification, setShowQualification] = useState(false);
  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [qualificationQuestions, setQualificationQuestions] = useState<QualificationQuestion[]>([]);
  const [qualificationResponses, setQualificationResponses] = useState<Record<string, QualificationResponse>>({});
  const [qualificationSummary, setQualificationSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const responseTimeouts = useRef<Record<string, number>>({});
  const responsesRef = useRef<Record<string, QualificationResponse>>({});
  useEffect(() => {
    responsesRef.current = qualificationResponses;
  }, [qualificationResponses]);
  useEffect(() => {
    return () => {
      Object.values(responseTimeouts.current).forEach((id) => clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (scriptId) {
      loadClientData();
      loadObjectionTemplates();

      // Set up real-time subscriptions
      const scriptChannel = supabase
        .channel('script-viewer-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scripts' }, (payload) => {
          if ((payload.new as any).id === scriptId) {
            loadClientData();
          }
        })
        .subscribe();

      const objectionChannel = supabase
        .channel('script-objections-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'objection_handling_templates' }, () => {
          loadObjectionTemplates();
        })
        .subscribe();

      const faqsChannel = supabase
        .channel('script-faqs-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faqs' }, () => {
          loadFaqsOnly();
        })
        .subscribe();

      const qualChannel = supabase
        .channel('script-qualification-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qualification_questions' }, () => {
          loadQualificationsOnly();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(scriptChannel);
        supabase.removeChannel(objectionChannel);
        supabase.removeChannel(faqsChannel);
        supabase.removeChannel(qualChannel);
      };
    }
  }, [scriptId]);

  const loadFaqsOnly = async () => {
    if (!serviceTypeId) return;
    
    try {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq('service_type_id', serviceTypeId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error loading FAQs:', error);
      } else {
        setFaqs(data || []);
      }
    } catch (error) {
      console.error("Error loading FAQs:", error);
    }
  };

  const loadQualificationsOnly = async () => {
    if (!serviceTypeId || !organizationId) return;

    try {
      const { data, error } = await supabase
        .from("qualification_questions")
        .select("*")
        .eq('organization_id', organizationId)
        .or(`service_type_id.eq.${serviceTypeId},service_type_id.is.null`)
        .order("display_order", { ascending: true });

      if (error) {
        console.error('Error loading qualification questions:', error);
      } else {
        setQualificationQuestions(data || []);
      }
    } catch (error) {
      console.error("Error loading qualification questions:", error);
    }
  };

  useEffect(() => {
    if (!serviceTypeId || !organizationId) return;
    loadFaqsOnly();
    loadQualificationsOnly();
  }, [serviceTypeId, organizationId]);

  const loadClientData = async () => {
    try {
      // First load the script to get the client_id
      const scriptResult = await supabase
        .from("scripts")
        .select("*, client_id, service_name, service_type_id, organization_id")
        .eq("id", scriptId)
        .single();

      if (scriptResult.error) throw scriptResult.error;
      setScript(scriptResult.data);
      setServiceTypeId(scriptResult.data.service_type_id);
      setOrganizationId(scriptResult.data.organization_id);
      // Load FAQs if service_type_id exists
      if (scriptResult.data.service_type_id) {
        const [faqResult, qualQuestionsResult, qualResponsesResult, summaryCheck] = await Promise.all([
          supabase
            .from("faqs")
            .select("*")
            .eq('service_type_id', scriptResult.data.service_type_id)
            .order("created_at", { ascending: false }),
          supabase
            .from("qualification_questions")
            .select("*")
            .eq('organization_id', scriptResult.data.organization_id)
            .or(`service_type_id.eq.${scriptResult.data.service_type_id},service_type_id.is.null`)
            .order("display_order", { ascending: true }),
          supabase
            .from("qualification_responses")
            .select("*")
            .eq('script_id', scriptId),
          supabase
            .from("scripts")
            .select("qualification_summary")
            .eq("id", scriptId)
            .single()
        ]);

        if (faqResult.error) {
          console.error('Error loading FAQs:', faqResult.error);
        } else {
          setFaqs(faqResult.data || []);
        }

        if (qualQuestionsResult.error) {
          console.error('Error loading qualification questions:', qualQuestionsResult.error);
        } else {
          setQualificationQuestions(qualQuestionsResult.data || []);
        }

        if (qualResponsesResult.error) {
          console.error('Error loading qualification responses:', qualResponsesResult.error);
        } else {
          const responsesMap: Record<string, QualificationResponse> = {};
          (qualResponsesResult.data || []).forEach((response: QualificationResponse) => {
            responsesMap[response.question_id] = response;
          });
          setQualificationResponses(responsesMap);
        }

        if (summaryCheck.data?.qualification_summary) {
          setQualificationSummary(summaryCheck.data.qualification_summary);
        }
      }

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

  const loadObjectionTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("objection_handling_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setObjectionTemplates(data || []);
    } catch (error) {
      console.error("Error loading objection templates:", error);
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

  const handleQualificationCheck = async (questionId: string, isChecked: boolean) => {
    // Optimistic update to avoid UI lag
    const prevState = qualificationResponses[questionId];
    setQualificationResponses(prev => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {} as QualificationResponse), is_asked: isChecked },
    }));

    try {
      const existing = prevState;
      
      if (existing && (existing as any).id) {
        const { error } = await supabase
          .from("qualification_responses")
          .update({ is_asked: isChecked })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("qualification_responses")
          .insert({
            script_id: scriptId,
            question_id: questionId,
            is_asked: isChecked,
            customer_response: null,
          })
          .select()
          .single();
        if (error) throw error;

        // Ensure row id is stored
        setQualificationResponses(prev => ({
          ...prev,
          [questionId]: data,
        }));
      }
    } catch (error) {
      console.error("Error updating qualification check:", error);
      toast.error("Failed to update question status");
      // Revert on failure
      setQualificationResponses(prev => ({
        ...prev,
        [questionId]: prevState || undefined as any,
      }));
    }
  };

  const handleQualificationResponse = (questionId: string, response: string) => {
    // Update local state immediately for responsive UI
    setQualificationResponses(prev => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {} as QualificationResponse), customer_response: response },
    }));
    
    // Clear existing timeout for this question
    if (responseTimeouts.current[questionId]) {
      window.clearTimeout(responseTimeouts.current[questionId]);
    }
    
    // Debounce the database update (500ms after user stops typing)
    responseTimeouts.current[questionId] = window.setTimeout(async () => {
      try {
        const existing = responsesRef.current[questionId];
        let rowId = existing?.id;

        if (!rowId) {
          const { data: rows, error: selError } = await supabase
            .from("qualification_responses")
            .select("id")
            .eq("script_id", scriptId)
            .eq("question_id", questionId)
            .order("created_at", { ascending: false })
            .limit(1);
          if (!selError && rows && rows.length > 0) {
            rowId = rows[0].id as string;
          }
        }

        if (rowId) {
          const { error } = await supabase
            .from("qualification_responses")
            .update({ customer_response: response })
            .eq("id", rowId);

          if (error) throw error;

          setQualificationResponses(prev => ({
            ...prev,
            [questionId]: { ...(prev[questionId] || {} as QualificationResponse), id: rowId!, customer_response: response } as QualificationResponse,
          }));
        } else {
          const { data, error } = await supabase
            .from("qualification_responses")
            .insert({
              script_id: scriptId,
              question_id: questionId,
              is_asked: false,
              customer_response: response,
            })
            .select()
            .single();

          if (error) throw error;
          
          setQualificationResponses(prev => ({
            ...prev,
            [questionId]: data,
          }));
        }
      } catch (error) {
        console.error("Error updating qualification response:", error);
      }
    }, 500);
  };

  const handleGenerateSummary = async () => {
    if (!qualificationQuestions.length) {
      toast.error("No qualification questions found");
      return;
    }

    const answeredQuestions = qualificationQuestions.filter(q => {
      const response = qualificationResponses[q.id];
      return response?.is_asked && response?.customer_response;
    });

    if (answeredQuestions.length === 0) {
      toast.error("Please answer at least one qualification question");
      return;
    }

    setGeneratingSummary(true);
    try {
      const responses = answeredQuestions.map(q => ({
        question: q.question,
        customer_response: qualificationResponses[q.id].customer_response,
      }));

      const { data, error } = await supabase.functions.invoke('generate-qualification-summary', {
        body: { 
          responses,
          serviceName: (script as any)?.service_name || client?.service_type,
          clientName: client?.name
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const summary = data.summary;
      setQualificationSummary(summary);

      // Save summary to database
      const { error: updateError } = await supabase
        .from("scripts")
        .update({ qualification_summary: summary })
        .eq("id", scriptId);

      if (updateError) throw updateError;

      toast.success("Summary generated successfully!");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
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

  // Calculator logic
  const calculatedPricePerSqFt = () => {
    const minPrice = getDetailValue("starting_price");
    const minSize = getDetailValue("minimum_size");
    
    if (minPrice === "N/A" || minSize === "N/A") return null;
    
    const priceNum = parseFloat(minPrice.replace(/[^0-9.]/g, ''));
    const sizeNum = parseFloat(minSize.replace(/[^0-9.]/g, ''));
    
    if (isNaN(priceNum) || isNaN(sizeNum) || sizeNum === 0) return null;
    
    return priceNum / sizeNum;
  };
  
  const calculateEstimate = () => {
    if (!desiredSqFt) return null;
    
    const sqFt = parseFloat(desiredSqFt);
    if (isNaN(sqFt) || sqFt === 0) return null;
    
    let pricePerSqFtNum: number | null = null;
    const pricePerSqFtValue = getDetailValue("price_per_sq_ft");
    
    if (pricePerSqFtValue !== "N/A") {
      const match = pricePerSqFtValue.match(/\d+/);
      if (match) {
        pricePerSqFtNum = parseFloat(match[0]);
      }
    }
    
    if (!pricePerSqFtNum) {
      pricePerSqFtNum = calculatedPricePerSqFt();
    }
    
    if (!pricePerSqFtNum) return null;
    
    const estimate = sqFt * pricePerSqFtNum;
    const lowEstimate = estimate * 0.9;
    const highEstimate = estimate * 1.1;
    
    return { low: lowEstimate, mid: estimate, high: highEstimate };
  };
  
  const estimate = calculateEstimate();
  const autoCalcPrice = calculatedPricePerSqFt();

  const FormattedScript = ({ content }: { content: string }) => {
    // If content contains HTML tags, render it as HTML preserving exact spacing
    if (content.includes('<p>') || content.includes('<span') || content.includes('<strong>') || content.includes('<mark>')) {
      return (
        <div 
          className="html-content whitespace-pre-wrap text-sm text-foreground/80"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
    
    // Otherwise, use the marker-based formatting (backward compatibility)
    const lines = content.split('\n');
    
    const formatLine = (text: string) => {
      const parts: (string | JSX.Element)[] = [];
      let remaining = text;
      let key = 0;
      
      // Process the text to find and replace patterns
      while (remaining.length > 0) {
        let matched = false;

        // Priority 1: Color formatting (most specific) - {red:text}
        const colorMatch = remaining.match(/\{(red|blue|green|yellow|purple|orange):([^}]+)\}/);
        if (colorMatch && colorMatch.index !== undefined) {
          if (colorMatch.index > 0) {
            parts.push(remaining.substring(0, colorMatch.index));
          }
          const colorClass = {
            red: 'text-red-600 dark:text-red-400',
            blue: 'text-blue-600 dark:text-blue-400',
            green: 'text-green-600 dark:text-green-400',
            yellow: 'text-yellow-600 dark:text-yellow-400',
            purple: 'text-purple-600 dark:text-purple-400',
            orange: 'text-orange-600 dark:text-orange-400',
          }[colorMatch[1]];
          parts.push(
            <span key={`color-${key++}`} className={`${colorClass} font-medium`}>
              {colorMatch[2]}
            </span>
          );
          remaining = remaining.substring(colorMatch.index + colorMatch[0].length);
          matched = true;
        }
        
        if (!matched) {
          // Priority 2: Large text - ^text^
          const largeMatch = remaining.match(/\^([^^]+)\^/);
          if (largeMatch && largeMatch.index !== undefined) {
            if (largeMatch.index > 0) {
              parts.push(remaining.substring(0, largeMatch.index));
            }
            parts.push(
              <span key={`large-${key++}`} className="text-lg font-semibold">
                {largeMatch[1]}
              </span>
            );
            remaining = remaining.substring(largeMatch.index + largeMatch[0].length);
            matched = true;
          }
        }
        
        if (!matched) {
          // Priority 3: Small text - ~text~
          const smallMatch = remaining.match(/~([^~]+)~/);
          if (smallMatch && smallMatch.index !== undefined) {
            if (smallMatch.index > 0) {
              parts.push(remaining.substring(0, smallMatch.index));
            }
            parts.push(
              <span key={`small-${key++}`} className="text-xs">
                {smallMatch[1]}
              </span>
            );
            remaining = remaining.substring(smallMatch.index + smallMatch[0].length);
            matched = true;
          }
        }
        
        if (!matched) {
          // Priority 4: Bracket highlights - [text]
          const bracketMatch = remaining.match(/\[([^\]]+)\]/);
          if (bracketMatch && bracketMatch.index !== undefined) {
            if (bracketMatch.index > 0) {
              parts.push(remaining.substring(0, bracketMatch.index));
            }
            parts.push(
              <span key={`bracket-${key++}`} className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-medium px-2 py-0.5 rounded">
                {bracketMatch[1]}
              </span>
            );
            remaining = remaining.substring(bracketMatch.index + bracketMatch[0].length);
            matched = true;
          }
        }
        
        if (!matched) {
          // Priority 5: Quote formatting - "text"
          const quoteMatch = remaining.match(/"([^"]+)"/);
          if (quoteMatch && quoteMatch.index !== undefined) {
            if (quoteMatch.index > 0) {
              parts.push(remaining.substring(0, quoteMatch.index));
            }
            parts.push(
              <span key={`quote-${key++}`} className="bg-blue-500/20 text-blue-700 dark:text-blue-400 font-medium px-1.5 rounded italic">
                "{quoteMatch[1]}"
              </span>
            );
            remaining = remaining.substring(quoteMatch.index + quoteMatch[0].length);
            matched = true;
          }
        }
        
        if (!matched) {
          // Priority 6: Bold with ** (must check before single *)
          const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
          if (boldMatch && boldMatch.index !== undefined) {
            if (boldMatch.index > 0) {
              parts.push(remaining.substring(0, boldMatch.index));
            }
            parts.push(
              <strong key={`bold-${key++}`} className="font-bold">
                {boldMatch[1]}
              </strong>
            );
            remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
            matched = true;
          }
        }
        
        if (!matched) {
          // Priority 7: Bold with __ (underscore)
          const underscoreMatch = remaining.match(/__([^_]+)__/);
          if (underscoreMatch && underscoreMatch.index !== undefined) {
            if (underscoreMatch.index > 0) {
              parts.push(remaining.substring(0, underscoreMatch.index));
            }
            parts.push(
              <strong key={`underscore-${key++}`} className="font-bold">
                {underscoreMatch[1]}
              </strong>
            );
            remaining = remaining.substring(underscoreMatch.index + underscoreMatch[0].length);
            matched = true;
          }
        }
        
        if (!matched) {
          // Priority 8: Single * for semibold (last to avoid conflicts)
          const italicMatch = remaining.match(/\*([^*]+)\*/);
          if (italicMatch && italicMatch.index !== undefined) {
            if (italicMatch.index > 0) {
              parts.push(remaining.substring(0, italicMatch.index));
            }
            parts.push(
              <strong key={`semi-${key++}`} className="font-semibold">
                {italicMatch[1]}
              </strong>
            );
            remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
            matched = true;
          }
        }
        
        // If nothing matched, add the rest and break
        if (!matched) {
          parts.push(remaining);
          break;
        }
      }
      
      return parts.length > 0 ? parts : text;
    };
    
    // Build elements preserving multiple blank lines as larger gaps
    const elements: JSX.Element[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle consecutive blank lines -> add proportional spacer matching template paragraph margins
      if (!line.trim()) {
        let count = 1;
        while (i + 1 < lines.length && !lines[i + 1].trim()) {
          count++;
          i++;
        }
        const height = 16 * count; // 1rem per blank line for clear visual separation
        elements.push(<div key={`spacer-${i}`} style={{ height }} aria-hidden="true" />);
        continue;
      }

      // Main numbered sections (like "1. SECTION NAME" or "3. UNDERSTAND WHY THEY CALLED")
      if (line.match(/^\d+\.\s+[A-Z]/)) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-sm font-bold mt-2 mb-1 first:mt-0 text-foreground">
            {line}
          </h3>
        );
        continue;
      }
      
      // Section headers (all caps or ending with colon)
      if (line.match(/^[A-Z\s]+:$/) || line.match(/^[*#]+\s*[A-Z][^a-z]*$/)) {
        elements.push(
          <h3 key={`h3b-${i}`} className="text-sm font-bold mt-2 mb-1 first:mt-0 text-foreground">
            {line.replace(/^[*#]+\s*/, '').replace(/:$/, '')}
          </h3>
        );
        continue;
      }
      
      // Stage markers (like "Stage 1:", "Phase 2:")
      if (line.match(/^(Stage|Phase|Step)\s+\d+/i)) {
        elements.push(
          <h4 key={`h4-${i}`} className="text-sm font-semibold mt-2 mb-1 text-foreground">
            {line}
          </h4>
        );
        continue;
      }
      
      // Sub-headers (lines starting with ** or ending with :)
      if (line.match(/^\*\*[^*]+\*\*/) || (line.endsWith(':') && line.length < 60 && !line.includes('.'))) {
        elements.push(
          <h5 key={`h5-${i}`} className="font-semibold text-sm mt-2 mb-1 text-foreground">
            {line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/:$/, '')}
          </h5>
        );
        continue;
      }
      
      // Regular content with formatting
      elements.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
          {formatLine(line)}
        </p>
      );
    }
    
    return (
      <div className="html-content text-sm text-foreground/80">
        {elements}
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
              {(client.city || getDetailValue("service_area") !== "N/A" || getDetailValue("address") !== "N/A") && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Service Area</h2>
                    <ServiceAreaMap 
                      city={client.city} 
                      serviceArea={getDetailValue("service_area")}
                      address={getDetailValue("address")}
                      radiusMiles={Number(getDetailValue("service_radius_miles")) || undefined}
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

              {/* Service Details */}
              {(getDetailValue("project_min_price") !== "N/A" || 
                getDetailValue("project_min_size") !== "N/A" || 
                getDetailValue("price_per_sq_ft") !== "N/A" || 
                getDetailValue("warranties") !== "N/A" || 
                getDetailValue("financing_options") !== "N/A" || 
                getDetailValue("video_of_service") !== "N/A" || 
                getDetailValue("avg_install_time") !== "N/A") && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Service Details</h2>
                    
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

              {/* Estimate Calculator */}
              {(getDetailValue("starting_price") !== "N/A" || getDetailValue("price_per_sq_ft") !== "N/A") && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Estimate Calculator</h2>
                    
                    {autoCalcPrice && (
                      <div className="p-3 bg-accent/10 rounded-lg border border-border mb-4">
                        <p className="text-xs text-muted-foreground mb-1">Auto-calculated Price Per Sq Ft</p>
                        <p className="text-xl font-bold text-foreground">
                          ${autoCalcPrice.toFixed(2)}/sq ft
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Based on minimum price and size
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="calc-sqft" className="text-sm font-medium">
                          Customer's Desired Square Footage
                        </Label>
                        <Input
                          id="calc-sqft"
                          type="number"
                          placeholder="e.g., 750"
                          value={desiredSqFt}
                          onChange={(e) => setDesiredSqFt(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      
                      {estimate && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <p className="text-sm font-semibold text-foreground">Estimated Price Range</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-xs text-muted-foreground mb-1">Low</p>
                              <p className="text-base font-semibold text-foreground">
                                ${estimate.low.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-lg text-center border-2 border-primary">
                              <p className="text-xs text-muted-foreground mb-1">Mid</p>
                              <p className="text-base font-semibold text-primary">
                                ${estimate.mid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-xs text-muted-foreground mb-1">High</p>
                              <p className="text-base font-semibold text-foreground">
                                ${estimate.high.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            ±10% variation • {desiredSqFt} sq ft × ${(estimate.mid / parseFloat(desiredSqFt)).toFixed(2)}/sq ft
                          </p>
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
                <div className="max-w-none">
                  <FormattedScript content={script.script_content} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Objection Handling Toggle Button */}
        {objectionTemplates.length > 0 && (
          <>
            <Button
              onClick={() => {
                setShowObjections(!showObjections);
                if (!showObjections) setShowFaqs(false);
              }}
              className="fixed bottom-6 right-6 h-14 rounded-full shadow-lg z-40"
              size="lg"
            >
              {showObjections ? (
                <>
                  <X className="mr-2 h-5 w-5" />
                  Close
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Objections
                </>
              )}
            </Button>

            {/* Objection Handling Panel */}
            {showObjections && (
              <div className="fixed bottom-24 right-6 w-96 max-h-[500px] bg-background border border-border rounded-lg shadow-2xl z-30 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border bg-muted/50">
                  <h3 className="font-semibold text-lg">Objection Handling</h3>
                  <p className="text-xs text-muted-foreground mt-1">Quick reference for common objections</p>
                </div>
                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                  {objectionTemplates.map((template) => (
                    <Card 
                      key={template.id} 
                      className="border border-border cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setExpandedObjection(expandedObjection === template.id ? null : template.id)}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm">{template.service_name}</h4>
                        {expandedObjection === template.id && (
                          <div className="text-sm whitespace-pre-wrap mt-2 pt-2 border-t border-border">
                            <FormattedScript content={template.content} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* FAQs Toggle Button */}
        {faqs.length > 0 && (
          <>
            <Button
              onClick={() => {
                setShowFaqs(!showFaqs);
                if (!showFaqs) setShowObjections(false);
              }}
              className="fixed bottom-24 right-6 h-14 rounded-full shadow-lg z-40"
              size="lg"
            >
              {showFaqs ? (
                <>
                  <X className="mr-2 h-5 w-5" />
                  Close
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-5 w-5" />
                  FAQs
                </>
              )}
            </Button>

            {/* FAQs Panel */}
            {showFaqs && (
              <div className="fixed bottom-40 right-6 w-96 max-h-[500px] bg-background border border-border rounded-lg shadow-2xl z-30 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border bg-muted/50">
                  <h3 className="font-semibold text-lg">FAQs</h3>
                  <p className="text-xs text-muted-foreground mt-1">Frequently asked questions</p>
                </div>
                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                  {faqs.map((faq) => (
                    <Card 
                      key={faq.id} 
                      className="border border-border cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm">{faq.question}</h4>
                        {expandedFaq === faq.id && (
                          <div className="text-sm whitespace-pre-wrap mt-2 pt-2 border-t border-border">
                            <FormattedScript content={faq.answer} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Qualification Toggle Button */}
        {qualificationQuestions.length > 0 && (
          <>
            <Button
              onClick={() => {
                const opening = !showQualification;
                setShowQualification(opening);
                if (opening) {
                  setShowObjections(false);
                  setShowFaqs(false);
                  loadQualificationsOnly();
                }
              }}
              className="fixed bottom-6 left-6 h-14 rounded-full shadow-lg z-40"
              size="lg"
            >
              {showQualification ? (
                <>
                  <X className="mr-2 h-5 w-5" />
                  Close
                </>
              ) : (
                <>
                  <ClipboardCheck className="mr-2 h-5 w-5" />
                  Qualify
                </>
              )}
            </Button>

            {/* Qualification Panel */}
            {showQualification && (
              <div className="fixed bottom-24 left-6 w-[500px] max-h-[600px] bg-background border border-border rounded-lg shadow-2xl z-30 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border bg-muted/50">
                  <h3 className="font-semibold text-lg">Client Qualification</h3>
                  <p className="text-xs text-muted-foreground mt-1">Discovery questions to qualify the prospect</p>
                </div>
                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                  {qualificationQuestions.map((question) => {
                    const response = qualificationResponses[question.id];
                    return (
                      <div key={question.id} className="space-y-2 pb-4 border-b border-border last:border-0">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={response?.is_asked || false}
                            onCheckedChange={(checked) => handleQualificationCheck(question.id, checked as boolean)}
                            className="mt-1"
                          />
                          <Label className="text-sm font-medium leading-relaxed cursor-pointer flex-1">
                            {question.question}
                          </Label>
                        </div>
                        <Textarea
                          placeholder="Customer's response..."
                          value={response?.customer_response || ""}
                          onChange={(e) => handleQualificationResponse(question.id, e.target.value)}
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 border-t border-border bg-muted/50 space-y-3">
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="w-full"
                  >
                    {generatingSummary ? (
                      "Generating..."
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate AI Summary
                      </>
                    )}
                  </Button>
                  {qualificationSummary && (
                    <div className="p-3 bg-background border border-border rounded text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {qualificationSummary}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}