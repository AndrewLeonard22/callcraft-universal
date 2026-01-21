import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Edit2, Download, Copy, MessageSquare, X, ClipboardCheck, Sparkles, Save, XCircle } from "lucide-react";
import { DebouncedSaveManager } from "@/utils/saveHelpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ServiceAreaMap from "@/components/ServiceAreaMap";
import OutdoorLivingCalculator from "@/components/OutdoorLivingCalculator";
import { RichTextEditor } from "@/components/RichTextEditor";
import { FormattedScript } from "@/components/FormattedScript";
import { ScriptActions } from "@/components/ScriptActions";
import { CompanyProfileModal } from "@/components/CompanyProfileModal";
import { getClientLogo, safeUrl } from "@/utils/clientHelpers";
import { logger } from "@/utils/logger";

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

interface ServiceDetailField {
  id: string;
  service_type_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  placeholder?: string;
  display_order: number;
}

export default function ScriptViewer() {
  const { scriptId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientData | null>(null);
  const [details, setDetails] = useState<ClientDetail[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [desiredSqFt, setDesiredSqFt] = useState("");
  const [pergolaDimensions, setPergolaDimensions] = useState("");
  const [pergolaMaterial, setPergolaMaterial] = useState<"aluminum" | "wood">("aluminum");
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
  const [serviceDetailFields, setServiceDetailFields] = useState<ServiceDetailField[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditingServiceDetails, setIsEditingServiceDetails] = useState(false);
  const [editedServiceDetails, setEditedServiceDetails] = useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const saveManager = useRef(new DebouncedSaveManager());
  const responsesRef = useRef<Record<string, QualificationResponse>>({});
  
  useEffect(() => {
    responsesRef.current = qualificationResponses;
  }, [qualificationResponses]);
  
  // Cleanup: wait for pending saves before unmount
  useEffect(() => {
    return () => {
      saveManager.current.waitForPendingSaves().then(() => {
        saveManager.current.cancelAll();
      });
    };
  }, []);

  // Optimized: Combined real-time subscriptions into single channel
  useEffect(() => {
    if (scriptId) {
      loadClientData();
      loadObjectionTemplates();

      // Single channel for all script-related updates
      const channel = supabase
        .channel('script-viewer-all')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scripts', filter: `id=eq.${scriptId}` }, () => {
          loadClientData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'objection_handling_templates' }, () => {
          loadObjectionTemplates();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faqs' }, () => {
          loadFaqsOnly();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qualification_questions' }, () => {
          loadQualificationsOnly();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [scriptId]);

  // Optimized: Memoized to prevent recreation
  const loadFaqsOnly = useCallback(async () => {
    if (!serviceTypeId) return;
    
    try {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq('service_type_id', serviceTypeId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error('Error loading FAQs:', error);
      } else {
        setFaqs(data || []);
      }
    } catch (error) {
      logger.error("Error loading FAQs:", error);
    }
  }, [serviceTypeId]);

  const loadQualificationsOnly = useCallback(async () => {
    if (!serviceTypeId || !organizationId) return;

    try {
      const { data, error } = await supabase
        .from("qualification_questions")
        .select("*")
        .eq('organization_id', organizationId)
        .or(`service_type_id.eq.${serviceTypeId},service_type_id.is.null`)
        .order("display_order", { ascending: true });

      if (error) {
        logger.error('Error loading qualification questions:', error);
      } else {
        setQualificationQuestions(data || []);
      }
    } catch (error) {
      logger.error("Error loading qualification questions:", error);
    }
  }, [serviceTypeId, organizationId]);

  useEffect(() => {
    if (!serviceTypeId || !organizationId) return;
    loadFaqsOnly();
    loadQualificationsOnly();
    loadServiceDetailFields();
  }, [serviceTypeId, organizationId]);

  // Realtime updates for client and client_details
  useEffect(() => {
    if (!client) return;
    const clientId = client.id;

    const clientChannel = supabase
      .channel('script-client-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clients', filter: `id=eq.${clientId}` }, () => {
        supabase.from('clients').select('*').eq('id', clientId).single().then(({ data }) => {
          if (data) setClient(data);
        });
      })
      .subscribe();

    const detailsChannel = supabase
      .channel('script-client-details-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_details', filter: `client_id=eq.${clientId}` }, () => {
        supabase.from('client_details').select('*').eq('client_id', clientId).then(({ data }) => {
          setDetails(data || []);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(clientChannel);
      supabase.removeChannel(detailsChannel);
    };
  }, [client]);

  const handleEditServiceDetails = () => {
    // Initialize edited values with current values
    const currentValues: Record<string, string> = {};
    serviceDetailFields.forEach((field) => {
      const value = getDetailValue(field.field_name);
      currentValues[field.field_name] = value !== "N/A" ? value : "";
    });
    setEditedServiceDetails(currentValues);
    setIsEditingServiceDetails(true);
  };

  const handleCancelEditServiceDetails = () => {
    setIsEditingServiceDetails(false);
    setEditedServiceDetails({});
  };

  const handleSaveServiceDetails = async () => {
    if (!client) {
      toast.error("Client data not loaded");
      return;
    }

    setSaving(true);
    try {
      // Prepare upsert operations for each field
      const operations = [];
      
      // First, get all existing records for these fields
      const fieldNames = serviceDetailFields.map(f => f.field_name);
      const { data: existingRecords } = await supabase
        .from("client_details")
        .select("id, field_name")
        .eq("client_id", client.id)
        .in("field_name", fieldNames);

      const existingMap = new Map(
        (existingRecords || []).map(r => [r.field_name, r.id])
      );

      // Build upsert operations
      for (const field of serviceDetailFields) {
        const value = editedServiceDetails[field.field_name]?.trim();
        const existingId = existingMap.get(field.field_name);

        if (value) {
          // Update or insert
          if (existingId) {
            operations.push(
              supabase
                .from("client_details")
                .update({ field_value: value })
                .eq("id", existingId)
            );
          } else {
            operations.push(
              supabase
                .from("client_details")
                .insert({
                  client_id: client.id,
                  field_name: field.field_name,
                  field_value: value,
                })
            );
          }
        } else if (existingId) {
          // Delete if empty and exists
          operations.push(
            supabase
              .from("client_details")
              .delete()
              .eq("id", existingId)
          );
        }
      }

      // Execute all operations
      if (operations.length > 0) {
        const results = await Promise.allSettled(operations);
        const failures = results.filter(r => r.status === 'rejected');
        
        if (failures.length > 0) {
          logger.error("Some service details failed to save:", failures);
          throw new Error(`Failed to save ${failures.length} field(s). Please try again.`);
        }
      }

      toast.success("Service details saved successfully");
      setIsEditingServiceDetails(false);
      setEditedServiceDetails({});
      
      // CRITICAL: Reload fresh data from DB and wait for it
      // This ensures any script content using these fields gets the latest values
      await loadClientData();
    } catch (error: any) {
      logger.error("Error saving service details:", error);
      toast.error(error.message || "Failed to save service details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const loadServiceDetailFields = useCallback(async () => {
    if (!serviceTypeId || !organizationId) return;

    try {
      const { data, error } = await supabase
        .from("service_detail_fields")
        .select("*")
        .eq("service_type_id", serviceTypeId)
        .eq("organization_id", organizationId)
        .order("display_order");

      if (error) {
        logger.error('Error loading service detail fields:', error);
      } else {
        setServiceDetailFields(data || []);
      }
    } catch (error) {
      logger.error("Error loading service detail fields:", error);
    }
  }, [serviceTypeId, organizationId]);

  // Optimized: Fully parallelized data loading
  const loadClientData = useCallback(async () => {
    try {
      // Load script first to get IDs
      const { data: scriptData, error: scriptError } = await supabase
        .from("scripts")
        .select("*, client_id, service_name, service_type_id, organization_id")
        .eq("id", scriptId)
        .single();

      if (scriptError) throw scriptError;
      
      setScript(scriptData);
      setServiceTypeId(scriptData.service_type_id);
      setOrganizationId(scriptData.organization_id);
      
      // Parallel load ALL data at once
      const [
        clientResult,
        detailsResult,
        faqResult,
        qualQuestionsResult,
        qualResponsesResult
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", scriptData.client_id).single(),
        supabase.from("client_details").select("*").eq("client_id", scriptData.client_id),
        scriptData.service_type_id 
          ? supabase.from("faqs").select("*").eq('service_type_id', scriptData.service_type_id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        scriptData.service_type_id && scriptData.organization_id
          ? supabase.from("qualification_questions").select("*").eq('organization_id', scriptData.organization_id).or(`service_type_id.eq.${scriptData.service_type_id},service_type_id.is.null`).order("display_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("qualification_responses").select("*").eq('script_id', scriptId)
      ]);

      if (clientResult.error) throw clientResult.error;
      setClient(clientResult.data);
      setDetails(detailsResult.data || []);
      setFaqs(faqResult.data || []);
      setQualificationQuestions(qualQuestionsResult.data || []);
      
      const responsesMap: Record<string, QualificationResponse> = {};
      (qualResponsesResult.data || []).forEach((response: QualificationResponse) => {
        responsesMap[response.question_id] = response;
      });
      setQualificationResponses(responsesMap);
      
    } catch (error) {
      logger.error("Error loading client data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  }, [scriptId]);

  const loadObjectionTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("objection_handling_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setObjectionTemplates(data || []);
    } catch (error) {
      logger.error("Error loading objection templates:", error);
      toast.error("Failed to load objection templates");
    }
  }, []);

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
      logger.error("Error updating qualification check:", error);
      toast.error("Failed to update question status");
      // Revert on failure
      setQualificationResponses(prev => ({
        ...prev,
        [questionId]: prevState || undefined as any,
      }));
    }
  };

  const handleQualificationResponse = useCallback(async (questionId: string, response: string) => {
    // Update local state immediately for responsive UI
    setQualificationResponses(prev => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {} as QualificationResponse), customer_response: response },
    }));
    
    // Use debounced save manager to ensure saves complete
    await saveManager.current.debouncedSave(
      `qual-response-${questionId}`,
      async () => {
        const currentState = responsesRef.current[questionId];
        const existing = currentState;
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
      },
      500,
      () => setSavingStates(prev => ({ ...prev, [questionId]: true })),
      (success) => {
        setSavingStates(prev => ({ ...prev, [questionId]: false }));
        if (!success) {
          toast.error("Failed to save response");
        }
      }
    );
  }, [scriptId]);

  const handleEditClick = () => {
    if (script) {
      setEditedContent(script.script_content);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent("");
  };

  const handleSaveEdit = async () => {
    if (!script || !scriptId) return;
    
    if (!editedContent.trim()) {
      toast.error("Script content cannot be empty");
      return;
    }
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("scripts")
        .update({ script_content: editedContent })
        .eq("id", scriptId)
        .select()
        .single();

      if (error) throw error;
      
      // Verify the save was successful
      if (!data) {
        throw new Error("Script update returned no data");
      }

      setScript({ ...script, script_content: editedContent });
      setIsEditing(false);
      toast.success("Script saved successfully");
    } catch (error) {
      logger.error("Error saving script:", error);
      toast.error("Failed to save script. Please try again.");
      // Keep editing mode open so user doesn't lose their changes
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!qualificationQuestions.length) {
      toast.error("No qualification questions found");
      return;
    }

    setGeneratingSummary(true);
    try {
      // Extract lead name and city from the first question's response (Homeowner Name & City)
      const homeownerQuestion = qualificationQuestions.find(q => 
        q.question.toLowerCase().includes('homeowner') && q.question.toLowerCase().includes('city')
      );
      
      let leadName = '[Lead Name]';
      let leadCity = '[City]';
      
      if (homeownerQuestion) {
        const homeownerResponse = qualificationResponses[homeownerQuestion.id]?.customer_response;
        if (homeownerResponse) {
          // Try to parse "Name from City" format
          const match = homeownerResponse.match(/^(.+?)\s+from\s+(.+)$/i);
          if (match) {
            leadName = match[1].trim();
            leadCity = match[2].trim();
          } else {
            // If no "from" pattern, use the whole response as name
            leadName = homeownerResponse;
          }
        }
      }

      const responses = qualificationQuestions.map(q => {
        const response = qualificationResponses[q.id];
        return {
          question: q.question,
          customer_response: response?.customer_response || null,
          is_asked: response?.is_asked || false
        };
      });

      const { data, error } = await supabase.functions.invoke('generate-qualification-summary', {
        body: { 
          responses,
          serviceName: (script as any)?.service_name || client?.service_type,
          leadName,
          leadCity
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const summary = data.summary;
      setQualificationSummary(summary);

      toast.success("Summary generated successfully!");
    } catch (error) {
      logger.error("Error generating summary:", error);
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

  // Normalize and sanitize URLs so clicks open the correct destination
  const safeUrl = (raw: string) => {
    const value = (raw || "").trim();
    if (!value) return "#";
    const lower = value.toLowerCase();
    // Basic protocol allowlist to avoid javascript:/data:/vbscript:
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) return "#";
    if (!/^https?:\/\//i.test(value)) return `https://${value.replace(/^\/+/, "")}`;
    return value;
  };
  
  // Calculator logic
  const calculatedPricePerSqFt = () => {
    const minPrice = getDetailValue("starting_price") !== "N/A" ? getDetailValue("starting_price") : getDetailValue("project_min_price");
    const minSize = getDetailValue("minimum_size") !== "N/A" ? getDetailValue("minimum_size") : getDetailValue("project_min_size");
    
    if (minPrice === "N/A" || minSize === "N/A") return null;
    
    const priceNum = parseFloat(minPrice.replace(/[^0-9.]/g, ''));
    const sizeNum = parseFloat(minSize.replace(/[^0-9.]/g, ''));
    
    if (isNaN(priceNum) || isNaN(sizeNum) || sizeNum === 0) return null;
    
    return priceNum / sizeNum;
  };
  
  const calculatePergolaSquareFootage = (dimensions: string): number => {
    // Parse dimensions like "15 x 20" or "15x20"
    const match = dimensions.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i);
    if (match) {
      const length = parseFloat(match[1]);
      const width = parseFloat(match[2]);
      return length * width;
    }
    return 0;
  };
  
  // Service type helper functions
  const isPergolaService = (): boolean => {
    if (!client?.service_type) return false;
    const serviceType = client.service_type.toLowerCase();
    return serviceType.includes('pergola');
  };

  const isTurfService = (): boolean => {
    if (!client?.service_type) return false;
    const serviceType = client.service_type.toLowerCase();
    return serviceType.includes('turf') || serviceType.includes('artificial');
  };

  const isBackyardService = (): boolean => {
    if (!client?.service_type) return false;
    return client.service_type.toLowerCase().includes('backyard');
  };
  
  // Ensure only one calculator displays per service
  const showPergola = isPergolaService();
  const showTurf = !showPergola && isTurfService();
  const showBackyard = !showPergola && !showTurf && isBackyardService();
  
  const calculateEstimate = () => {
    // Check if this is a pergola service
    const aluminumPrice = getDetailValue("price_per_sq_ft_aluminum");
    const woodPrice = getDetailValue("price_per_sq_ft_wood");
    const isPergola = aluminumPrice !== "N/A" || woodPrice !== "N/A";
    
    let sqFt: number;
    
    if (isPergola) {
      // For pergola, calculate from dimensions
      sqFt = calculatePergolaSquareFootage(pergolaDimensions);
      if (sqFt === 0) return null;
    } else {
      // For other services, use direct square footage input
      if (!desiredSqFt) return null;
      sqFt = parseFloat(desiredSqFt);
      if (isNaN(sqFt) || sqFt === 0) return null;
    }
    
    let pricePerSqFtNum: number | null = null;
    
    if (isPergola) {
      const selectedPrice = pergolaMaterial === "aluminum" ? aluminumPrice : woodPrice;
      if (selectedPrice !== "N/A") {
        const match = selectedPrice.match(/\d+\.?\d*/);
        if (match) {
          pricePerSqFtNum = parseFloat(match[0]);
        }
      }
    } else {
      // Regular service - check price_per_sq_ft
      const pricePerSqFtValue = getDetailValue("price_per_sq_ft");
      if (pricePerSqFtValue !== "N/A") {
        const match = pricePerSqFtValue.match(/\d+/);
        if (match) {
          pricePerSqFtNum = parseFloat(match[0]);
        }
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
                <h1 
                  className="text-3xl font-semibold mb-2 text-foreground cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setShowCompanyProfile(true)}
                  title="Click to view company profile"
                >
                  {client.name}
                </h1>
                <p className="text-base text-muted-foreground capitalize">
                  {(script as any)?.service_name || client.service_type} {client.city && `• ${client.city}`}
                </p>
              </div>
            </div>
            <ScriptActions
              isEditing={isEditing}
              isSaving={saving}
              onEdit={handleEditClick}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
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

                    {(() => {
                      const valCandidates = [
                        "services_offered",
                        "services",
                        "services.offered",
                        "services offered",
                        "Services Offered",
                      ] as const;
                      let firstVal = valCandidates
                        .map((k) => getDetailValue(k))
                        .find((v) => v !== "N/A");
                      if (!firstVal) {
                        const normalized = (s: string) => s.replace(/[_.-]+/g, " ").trim().toLowerCase();
                        const match = details.find((d) => normalized(d.field_name) === "services offered");
                        if (match?.field_value) firstVal = match.field_value;
                      }
                      return firstVal ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services Offered</div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">{firstVal}</div>
                        </div>
                      ) : null;
                    })()}


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
                            <a href={safeUrl(getDetailValue("website"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              {getDetailValue("website")}
                            </a>
                          </div>
                        )}

                        {getDetailValue("facebook_page") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Facebook</div>
                            <a href={safeUrl(getDetailValue("facebook_page"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              View Page
                            </a>
                          </div>
                        )}

                        {getDetailValue("instagram") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Instagram</div>
                            <a href={safeUrl(getDetailValue("instagram"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              View Profile
                            </a>
                          </div>
                        )}

                        {getDetailValue("crm_account_link") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">CRM Account</div>
                            <a href={safeUrl(getDetailValue("crm_account_link"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              Open CRM
                            </a>
                          </div>
                        )}

                        {getDetailValue("appointment_calendar") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Appointment Calendar</div>
                            <a href={safeUrl(getDetailValue("appointment_calendar"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              {getDetailValue("appointment_calendar")}
                            </a>
                          </div>
                        )}

                        {getDetailValue("reschedule_calendar") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Reschedule Calendar</div>
                            <a href={safeUrl(getDetailValue("reschedule_calendar"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              {getDetailValue("reschedule_calendar")}
                            </a>
                          </div>
                        )}

                        {getDetailValue("appointment_link") !== "N/A" && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Appointment Link</div>
                            <a href={safeUrl(getDetailValue("appointment_link"))} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 break-all transition-colors block">
                              {getDetailValue("appointment_link")}
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
              {serviceDetailFields.length > 0 && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-foreground">Service Details</h2>
                      {!isEditingServiceDetails ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEditServiceDetails}
                          className="h-8 px-2"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEditServiceDetails}
                            disabled={saving}
                            className="h-8 px-2"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveServiceDetails}
                            disabled={saving}
                            className="h-8 px-2"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            {saving ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {!isEditingServiceDetails ? (
                      <div className="space-y-4">
                        {serviceDetailFields.map((field) => {
                          const value = getDetailValue(field.field_name);
                          if (value === "N/A") return null;
                          
                          return (
                            <div key={field.id} className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {field.field_label}
                              </div>
                              <div className="text-sm font-medium text-foreground whitespace-pre-wrap">
                                {field.field_type === 'url' ? (
                                  <a 
                                    href={safeUrl(value)} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-primary hover:text-primary/80 break-all transition-colors"
                                  >
                                    {value}
                                  </a>
                                ) : (
                                  value
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {serviceDetailFields.every(field => getDetailValue(field.field_name) === "N/A") && (
                          <p className="text-sm text-muted-foreground">
                            No service details added yet. Click Edit to add details.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {serviceDetailFields.map((field) => (
                          <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.field_name} className="text-xs font-medium uppercase tracking-wide">
                              {field.field_label}
                              {field.is_required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {field.field_type === 'textarea' ? (
                              <Textarea
                                id={field.field_name}
                                value={editedServiceDetails[field.field_name] || ""}
                                onChange={(e) =>
                                  setEditedServiceDetails((prev) => ({
                                    ...prev,
                                    [field.field_name]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder}
                                className="min-h-[80px]"
                              />
                            ) : (
                              <Input
                                id={field.field_name}
                                type={field.field_type === 'url' ? 'url' : 'text'}
                                value={editedServiceDetails[field.field_name] || ""}
                                onChange={(e) =>
                                  setEditedServiceDetails((prev) => ({
                                    ...prev,
                                    [field.field_name]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder}
                              />
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-4">
                          Need to add more fields? Go to{" "}
                          <Link to="/service-types" className="text-primary hover:underline">
                            Service Types
                          </Link>{" "}
                          to create custom fields.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Estimate Calculator */}
              {/* Pergola Calculator - Only for Pergola services */}
              {showPergola && (getDetailValue("price_per_sq_ft_aluminum") !== "N/A" || getDetailValue("price_per_sq_ft_wood") !== "N/A") && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Pergola Estimate Calculator</h2>
                    
                    <div className="space-y-3">
                      {/* Pergola Material Selection */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Material Type</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPergolaMaterial("aluminum")}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              pergolaMaterial === "aluminum"
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border bg-muted text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            <div className="text-sm">Aluminum</div>
                            {getDetailValue("price_per_sq_ft_aluminum") !== "N/A" && (
                              <div className="text-xs mt-1">${getDetailValue("price_per_sq_ft_aluminum")}/sq ft</div>
                            )}
                          </button>
                          <button
                            onClick={() => setPergolaMaterial("wood")}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              pergolaMaterial === "wood"
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border bg-muted text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            <div className="text-sm">Wood</div>
                            {getDetailValue("price_per_sq_ft_wood") !== "N/A" && (
                              <div className="text-xs mt-1">${getDetailValue("price_per_sq_ft_wood")}/sq ft</div>
                            )}
                          </button>
                        </div>
                      </div>
                       
                      {/* Pergola Dimensions Input */}
                      <div>
                        <Label htmlFor="pergola-dimensions" className="text-sm font-medium">
                          Pergola Dimensions
                        </Label>
                        <Input
                          id="pergola-dimensions"
                          type="text"
                          placeholder="e.g., 15 x 20"
                          value={pergolaDimensions}
                          onChange={(e) => setPergolaDimensions(e.target.value)}
                          className="mt-1.5"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter dimensions as length x width (e.g., 15 x 20)
                        </p>
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
                             ±10% variation • {calculatePergolaSquareFootage(pergolaDimensions)} sq ft × ${(estimate.mid / calculatePergolaSquareFootage(pergolaDimensions)).toFixed(2)}/sq ft
                           </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Turf Calculator - Only for Turf/Artificial Turf services */}
              {showTurf && getDetailValue("price_per_sq_ft") !== "N/A" && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Turf Estimate Calculator</h2>
                    
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
                             ±10% variation • {parseFloat(desiredSqFt)} sq ft × ${(estimate.mid / parseFloat(desiredSqFt)).toFixed(2)}/sq ft
                           </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Outdoor Living Calculator - Only for Backyard Remodel */}
              {showBackyard && (
                <OutdoorLivingCalculator />
              )}
            </div>
          </div>

          {/* Main Content - Call Script */}
          <div className="lg:col-span-2">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-8">
                <div className="max-w-none">
                  {isEditing ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Edit your script content directly. You can use the rich text editor to format the text.
                      </p>
                      <RichTextEditor
                        value={editedContent}
                        onChange={setEditedContent}
                        placeholder="Enter your script content..."
                        minHeight="500px"
                      />
                    </div>
                  ) : (
                    <FormattedScript content={script.script_content} />
                  )}
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
      
      {/* Company Profile Modal */}
      <CompanyProfileModal
        open={showCompanyProfile}
        onOpenChange={setShowCompanyProfile}
        client={client}
        details={details}
        logoUrl={getDetailValue("logo_url") !== "N/A" ? getDetailValue("logo_url") : getClientLogo(client.service_type)}
      />
    </div>
  );
}