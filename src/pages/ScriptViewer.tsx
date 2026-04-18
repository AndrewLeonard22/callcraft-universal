import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Edit2, Download, Copy, MessageSquare, X, ClipboardCheck,
  Sparkles, Save, XCircle, ExternalLink, Calendar, RotateCcw, Link2,
  Globe, Ban, Image as ImageIcon, Info, MapPin, ChevronRight,
} from "lucide-react";
import { DebouncedSaveManager } from "@/utils/saveHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZipChecker } from "@/components/ZipChecker";
import ServiceAreaMap from "@/components/ServiceAreaMap";
import { RichTextEditor } from "@/components/RichTextEditor";
import { FormattedScript } from "@/components/FormattedScript";
import { ScriptActions } from "@/components/ScriptActions";
import { getClientLogo, safeUrl } from "@/utils/clientHelpers";
import { logger } from "@/utils/logger";

interface ClientData {
  id: string;
  name: string;
  service_type: string;
  city: string | null;
  hard_nos: string[];
  services_advertised: string[];
  excluded_zips: string[];
  things_to_know: string | null;
  financing_offered: string | null;
  avg_install_time: string | null;
  additional_contacts: Array<{ name: string; role: string; phone: string }>;
}

interface ClientDetail {
  field_name: string;
  field_value: string;
}

interface Script {
  script_content: string;
  version: number;
  service_type_id?: string;
  service_name?: string;
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

// Derive display label for a hard_no slug
const hardNoLabel = (slug: string): string => {
  const map: Record<string, string> = {
    pools: "NO POOLS", decks: "NO DECKS", electrical: "NO ELECTRICAL",
    lighting: "NO LIGHTING", hot_tubs: "NO HOT TUBS", tree_removal: "NO TREE REMOVAL",
    concrete: "NO CONCRETE", fencing: "NO FENCING", roofing: "NO ROOFING",
    water_features: "NO WATER FEATURES", bbq_islands: "NO BBQ ISLANDS",
  };
  return map[slug] ?? `NO ${slug.replace(/_/g, " ").toUpperCase()}`;
};

const serviceLabel = (slug: string): string => {
  const map: Record<string, string> = {
    pavers: "Pavers", turf: "Turf", pergola: "Pergolas",
    outdoor_kitchen: "Outdoor Kitchens", fire_pit: "Fire Pits",
    pool_deck: "Pool Decks", retaining_wall: "Retaining Walls",
    lighting: "Lighting", drainage: "Drainage", seating_wall: "Seating Walls",
    bbq_islands: "BBQ Islands", water_features: "Water Features",
    full_backyard_remodel: "Full Backyard Remodel",
  };
  return map[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

type LeftTab = "info" | "area" | "photos";

export default function ScriptViewer() {
  const { scriptId } = useParams();
  const navigate = useNavigate();

  // Core data
  const [client, setClient] = useState<ClientData | null>(null);
  const [details, setDetails] = useState<ClientDetail[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [leftTab, setLeftTab] = useState<LeftTab>("info");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [overflowNosOpen, setOverflowNosOpen] = useState(false);

  // Floating panels
  const [showObjections, setShowObjections] = useState(false);
  const [showFaqs, setShowFaqs] = useState(false);
  const [showQualification, setShowQualification] = useState(false);

  // Expanded items
  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Service type / org
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Qual
  const [qualificationQuestions, setQualificationQuestions] = useState<QualificationQuestion[]>([]);
  const [qualificationResponses, setQualificationResponses] = useState<Record<string, QualificationResponse>>({});
  const [qualificationSummary, setQualificationSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  // Objections / FAQs
  const [objectionTemplates, setObjectionTemplates] = useState<ObjectionTemplate[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  const saveManager = useRef(new DebouncedSaveManager());
  const responsesRef = useRef<Record<string, QualificationResponse>>({});

  useEffect(() => {
    responsesRef.current = qualificationResponses;
  }, [qualificationResponses]);

  useEffect(() => {
    return () => {
      saveManager.current.waitForPendingSaves().then(() => saveManager.current.cancelAll());
    };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadClientData = useCallback(async () => {
    try {
      const { data: scriptData, error: scriptError } = await supabase
        .from("scripts")
        .select("*, client_id, service_name, service_type_id, organization_id")
        .eq("id", scriptId)
        .single();

      if (scriptError) throw scriptError;

      setScript(scriptData);
      setServiceTypeId(scriptData.service_type_id);
      setOrganizationId(scriptData.organization_id);

      const [
        clientResult,
        detailsResult,
        faqResult,
        qualQuestionsResult,
        qualResponsesResult,
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", scriptData.client_id).single(),
        supabase.from("client_details").select("*").eq("client_id", scriptData.client_id),
        scriptData.service_type_id
          ? supabase.from("faqs").select("*").eq("service_type_id", scriptData.service_type_id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        scriptData.service_type_id && scriptData.organization_id
          ? supabase.from("qualification_questions").select("*").eq("organization_id", scriptData.organization_id).or(`service_type_id.eq.${scriptData.service_type_id},service_type_id.is.null`).order("display_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("qualification_responses").select("*").eq("script_id", scriptId),
      ]);

      if (clientResult.error) throw clientResult.error;

      const raw = clientResult.data as any;
      setClient({
        id: raw.id,
        name: raw.name,
        service_type: raw.service_type,
        city: raw.city,
        hard_nos: raw.hard_nos ?? [],
        services_advertised: raw.services_advertised ?? [],
        excluded_zips: raw.excluded_zips ?? [],
        things_to_know: raw.things_to_know ?? null,
        financing_offered: raw.financing_offered ?? null,
        avg_install_time: raw.avg_install_time ?? null,
        additional_contacts: raw.additional_contacts ?? [],
      });

      setDetails(detailsResult.data || []);
      setFaqs(faqResult.data || []);
      setQualificationQuestions(qualQuestionsResult.data || []);

      const responsesMap: Record<string, QualificationResponse> = {};
      (qualResponsesResult.data || []).forEach((r: QualificationResponse) => {
        responsesMap[r.question_id] = r;
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
    }
  }, []);

  useEffect(() => {
    if (scriptId) {
      loadClientData();
      loadObjectionTemplates();

      const channel = supabase
        .channel("script-viewer-all")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scripts", filter: `id=eq.${scriptId}` }, () => loadClientData())
        .on("postgres_changes", { event: "*", schema: "public", table: "objection_handling_templates" }, () => loadObjectionTemplates())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [scriptId, loadClientData, loadObjectionTemplates]);

  useEffect(() => {
    if (!client) return;
    const clientId = client.id;

    const ch1 = supabase.channel("sv-client")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clients", filter: `id=eq.${clientId}` }, () => loadClientData())
      .subscribe();

    const ch2 = supabase.channel("sv-details")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_details", filter: `client_id=eq.${clientId}` }, () => loadClientData())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [client, loadClientData]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getDetailValue = (fieldName: string): string => {
    const scriptSpecific = details.find((d) => d.field_name === `script_${scriptId}_${fieldName}`)?.field_value;
    if (scriptSpecific) return scriptSpecific;
    return details.find((d) => d.field_name === fieldName)?.field_value || "";
  };

  const getWorkPhotos = (): string[] => {
    const raw = getDetailValue("work_photos");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return raw.split(",").map((u) => u.trim()).filter(Boolean); }
  };

  const getThingsToKnow = (): string => {
    return client?.things_to_know || getDetailValue("other_key_info") || "";
  };

  const thingsToKnowBullets = (): string[] => {
    const raw = getThingsToKnow();
    if (!raw) return [];
    return raw.split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  };

  // ── Script edit ───────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (script) { navigator.clipboard.writeText(script.script_content); toast.success("Copied!"); }
  };

  const handleDownload = () => {
    if (script && client) {
      const blob = new Blob([script.script_content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${client.name.replace(/\s+/g, "-")}-script.txt`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }
  };

  const handleSaveEdit = async () => {
    if (!script || !scriptId) return;
    if (!editedContent.trim()) { toast.error("Script content cannot be empty"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("scripts").update({ script_content: editedContent }).eq("id", scriptId).select().single();
      if (error) throw error;
      if (!data) throw new Error("No data returned");
      setScript({ ...script, script_content: editedContent });
      setIsEditing(false);
      toast.success("Script saved");
    } catch (error) {
      logger.error("Error saving script:", error);
      toast.error("Failed to save script");
    } finally {
      setSaving(false);
    }
  };

  // ── Qualification ─────────────────────────────────────────────────────────

  const handleQualificationCheck = async (questionId: string, isChecked: boolean) => {
    const prevState = qualificationResponses[questionId];
    setQualificationResponses((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {} as QualificationResponse), is_asked: isChecked },
    }));
    try {
      if (prevState?.id) {
        const { error } = await supabase.from("qualification_responses").update({ is_asked: isChecked }).eq("id", prevState.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("qualification_responses").insert({ script_id: scriptId, question_id: questionId, is_asked: isChecked, customer_response: null }).select().single();
        if (error) throw error;
        setQualificationResponses((prev) => ({ ...prev, [questionId]: data }));
      }
    } catch {
      toast.error("Failed to update question status");
      setQualificationResponses((prev) => ({ ...prev, [questionId]: prevState || (undefined as any) }));
    }
  };

  const handleQualificationResponse = useCallback(async (questionId: string, response: string) => {
    setQualificationResponses((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {} as QualificationResponse), customer_response: response },
    }));
    await saveManager.current.debouncedSave(
      `qual-response-${questionId}`,
      async () => {
        const existing = responsesRef.current[questionId];
        let rowId = existing?.id;
        if (!rowId) {
          const { data: rows } = await supabase.from("qualification_responses").select("id").eq("script_id", scriptId).eq("question_id", questionId).order("created_at", { ascending: false }).limit(1);
          if (rows?.[0]) rowId = rows[0].id as string;
        }
        if (rowId) {
          const { error } = await supabase.from("qualification_responses").update({ customer_response: response }).eq("id", rowId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("qualification_responses").insert({ script_id: scriptId, question_id: questionId, is_asked: false, customer_response: response }).select().single();
          if (error) throw error;
          setQualificationResponses((prev) => ({ ...prev, [questionId]: data }));
        }
      },
      500,
      () => setSavingStates((prev) => ({ ...prev, [questionId]: true })),
      (success) => {
        setSavingStates((prev) => ({ ...prev, [questionId]: false }));
        if (!success) toast.error("Failed to save response");
      }
    );
  }, [scriptId]);

  const handleGenerateSummary = async () => {
    if (!qualificationQuestions.length) { toast.error("No qualification questions found"); return; }
    setGeneratingSummary(true);
    try {
      const homeownerQ = qualificationQuestions.find((q) => q.question.toLowerCase().includes("homeowner") && q.question.toLowerCase().includes("city"));
      let leadName = "[Lead Name]", leadCity = "[City]";
      if (homeownerQ) {
        const resp = qualificationResponses[homeownerQ.id]?.customer_response;
        if (resp) {
          const m = resp.match(/^(.+?)\s+from\s+(.+)$/i);
          if (m) { leadName = m[1].trim(); leadCity = m[2].trim(); } else { leadName = resp; }
        }
      }
      const responses = qualificationQuestions.map((q) => ({
        question: q.question,
        customer_response: qualificationResponses[q.id]?.customer_response || null,
        is_asked: qualificationResponses[q.id]?.is_asked || false,
      }));
      const { data, error } = await supabase.functions.invoke("generate-qualification-summary", {
        body: { responses, serviceName: (script as any)?.service_name || client?.service_type, leadName, leadCity },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      setQualificationSummary(data.summary);
      toast.success("Summary generated");
    } catch (error) {
      logger.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="h-14 border-b border-border bg-background" />
        <div className="flex flex-1 min-h-0">
          <div className="w-[296px] border-r border-border animate-pulse bg-muted/20" />
          <div className="flex-1 p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-4 bg-muted rounded w-full" style={{ width: `${70 + (i % 3) * 10}%` }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!client || !script) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Script not found</h2>
          <Button onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const workPhotos = getWorkPhotos();
  const bullets = thingsToKnowBullets();
  const logoUrl = getDetailValue("logo_url");
  const hardNos = client.hard_nos ?? [];
  const MAX_INLINE_NOS = 4;
  const visibleNos = hardNos.slice(0, MAX_INLINE_NOS);
  const hiddenNos = hardNos.slice(MAX_INLINE_NOS);

  // Quick links — only render rows with a value
  const quickLinks = [
    { key: "appointment_calendar", label: "Book Appointment", icon: Calendar },
    { key: "reschedule_calendar", label: "Reschedule", icon: RotateCcw },
    { key: "crm_account_link", label: "CRM Account", icon: Link2 },
    { key: "website", label: "Website", icon: Globe },
  ].filter(({ key }) => !!getDetailValue(key));

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-auto min-h-[3.5rem] border-b border-border bg-background z-40 px-4 flex flex-col justify-center gap-1 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(`/client/${client.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="h-8 w-8 rounded-md overflow-hidden bg-muted shrink-0 border border-border">
            <img src={getClientLogo(client.service_type, logoUrl || undefined)} alt="" className="h-full w-full object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[15px] font-semibold text-foreground leading-none truncate">
                {getDetailValue("business_name") || client.name}
              </h1>
              <span className="text-[12px] text-muted-foreground hidden sm:inline">
                {(script as any)?.service_name || client.service_type}
                {client.city && ` · ${client.city}`}
              </span>
            </div>
          </div>

          {/* Hard NOs — inline pills */}
          {hardNos.length > 0 && (
            <div className="hidden md:flex items-center gap-1 flex-wrap">
              {visibleNos.map((slug) => (
                <span key={slug} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold rounded tracking-wide uppercase whitespace-nowrap">
                  <Ban className="h-2.5 w-2.5" />
                  {hardNoLabel(slug)}
                </span>
              ))}
              {hiddenNos.length > 0 && (
                <div className="relative">
                  <button
                    className="inline-flex items-center px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold rounded hover:bg-red-100 transition-colors"
                    onClick={() => setOverflowNosOpen((v) => !v)}
                  >
                    +{hiddenNos.length} more
                  </button>
                  {overflowNosOpen && (
                    <div className="absolute top-6 right-0 z-50 bg-background border border-border rounded-lg shadow-lg p-2 space-y-1 min-w-[160px]">
                      {hiddenNos.map((slug) => (
                        <div key={slug} className="flex items-center gap-1.5 text-red-700 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
                          <Ban className="h-2.5 w-2.5" /> {hardNoLabel(slug)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <ScriptActions
            isEditing={isEditing}
            isSaving={saving}
            onEdit={() => { setEditedContent(script.script_content); setIsEditing(true); }}
            onSave={handleSaveEdit}
            onCancel={() => { setIsEditing(false); setEditedContent(""); }}
            onCopy={handleCopy}
            onDownload={handleDownload}
          />
        </div>

        {/* Hard NOs on mobile (below the main bar row) */}
        {hardNos.length > 0 && (
          <div className="md:hidden flex items-center gap-1 flex-wrap pb-1">
            {hardNos.map((slug) => (
              <span key={slug} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold rounded tracking-wide uppercase">
                <Ban className="h-2.5 w-2.5" />
                {hardNoLabel(slug)}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ───────────────────────────────────────────────── */}
        <aside className="w-[296px] shrink-0 border-r border-border flex flex-col overflow-hidden bg-background">

          {/* Quick links — always visible */}
          {quickLinks.length > 0 && (
            <div className="shrink-0 border-b border-border p-2 space-y-0.5">
              {quickLinks.map(({ key, label, icon: Icon }) => (
                <a
                  key={key}
                  href={safeUrl(getDetailValue(key))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-foreground hover:bg-accent hover:text-accent-foreground transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                  <span className="flex-1 font-medium">{label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}

          {/* Things to Know — always visible, constrained height */}
          {bullets.length > 0 && (
            <div className="shrink-0 border-b border-border">
              <div className="px-3 pt-2.5 pb-1">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Things to Know</div>
              </div>
              <div className="max-h-36 overflow-y-auto px-3 pb-2.5 space-y-1">
                {bullets.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="leading-snug">{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab nav */}
          <div className="shrink-0 flex items-center gap-0 border-b border-border px-2 bg-muted/30">
            {(["info", "area", "photos"] as LeftTab[]).map((tab) => {
              const labels: Record<LeftTab, string> = { info: "Info", area: "Area", photos: `Photos${workPhotos.length > 0 ? ` (${workPhotos.length})` : ""}` };
              return (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`px-3 py-2 text-[12px] font-medium transition-colors border-b-2 ${
                    leftTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-y-auto">

            {/* INFO TAB */}
            {leftTab === "info" && (
              <div className="p-3 space-y-4">

                {/* Contacts */}
                {(() => {
                  const contacts: Array<{ name: string; role: string; phone?: string }> = [];
                  const ownerName = getDetailValue("owners_name");
                  if (ownerName) contacts.push({ name: ownerName, role: "Owner/Client" });
                  if (client.additional_contacts?.length) {
                    contacts.push(...client.additional_contacts);
                  } else {
                    const repName = getDetailValue("sales_rep_name");
                    const repPhone = getDetailValue("sales_rep_phone");
                    if (repName) contacts.push({ name: repName, role: "Sales Rep", phone: repPhone || undefined });
                  }
                  if (!contacts.length) return null;
                  return (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Contacts</div>
                      <div className="space-y-2">
                        {contacts.map((c, i) => (
                          <div key={i} className="space-y-0">
                            <div className="text-[13px] font-medium text-foreground">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{c.role}{c.phone && ` · ${c.phone}`}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Address */}
                {getDetailValue("address") && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Address</div>
                    <div className="text-[13px] text-foreground">{getDetailValue("address")}</div>
                  </div>
                )}

                {/* Services advertised */}
                {(() => {
                  const services = client.services_advertised?.length
                    ? client.services_advertised
                    : getDetailValue("services_offered") ? getDetailValue("services_offered").split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [];
                  if (!services.length) return null;
                  return (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Services We Advertise</div>
                      <div className="flex flex-wrap gap-1">
                        {services.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-primary/8 text-primary text-[11px] font-medium rounded-full border border-primary/20">
                            {client.services_advertised?.length ? serviceLabel(s) : s}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Project info */}
                {(() => {
                  const rows = [
                    { label: "Minimum Project", value: getDetailValue("project_min_price") || getDetailValue("starting_price") },
                    { label: "Avg Install Time", value: client.avg_install_time || getDetailValue("avg_install_time") },
                    { label: "Financing", value: client.financing_offered || getDetailValue("financing_options") || getDetailValue("financing_offered") },
                    { label: "Warranty", value: getDetailValue("warranty") || getDetailValue("warranties") },
                    { label: "Years in Business", value: getDetailValue("years_in_business") },
                  ].filter((r) => !!r.value);
                  if (!rows.length) return null;
                  return (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Project Details</div>
                      <div className="space-y-1.5">
                        {rows.map(({ label, value }) => (
                          <div key={label} className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
                            <span className="text-[13px] text-foreground text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Current offer */}
                {(getDetailValue("offer_name") || getDetailValue("offer_description")) && (
                  <div className="p-2.5 rounded-md bg-primary/5 border border-primary/15">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-1">Current Offer</div>
                    {getDetailValue("offer_name") && <div className="text-[13px] font-medium text-foreground">{getDetailValue("offer_name")}</div>}
                    {getDetailValue("offer_description") && <div className="text-[12px] text-muted-foreground mt-0.5">{getDetailValue("offer_description")}</div>}
                  </div>
                )}

                {/* Script version */}
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                  Script v{script.version}
                  {" · "}
                  <Link to={`/edit/${client.id}`} className="hover:text-foreground transition-colors underline underline-offset-2">
                    Edit client
                  </Link>
                </div>
              </div>
            )}

            {/* AREA TAB */}
            {leftTab === "area" && (
              <div className="p-3 space-y-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Service Area Check</div>
                  <ZipChecker
                    excludedZips={client.excluded_zips ?? []}
                    clientCity={client.city ?? undefined}
                    clientAddress={getDetailValue("address") || undefined}
                    serviceRadiusMiles={Number(getDetailValue("service_radius_miles")) || 30}
                  />
                </div>

                {/* Excluded zones list */}
                {(client.excluded_zips?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Excluded Zones</div>
                    <div className="flex flex-wrap gap-1">
                      {client.excluded_zips.map((z) => (
                        <span key={z} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium rounded">
                          {z}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Service area text */}
                {getDetailValue("service_area") && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Coverage</div>
                    <div className="text-[13px] text-foreground">{getDetailValue("service_area")}</div>
                  </div>
                )}

                {getDetailValue("service_radius_miles") && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Service radius</span>
                    <span className="text-[13px] text-foreground">{getDetailValue("service_radius_miles")} miles</span>
                  </div>
                )}

                {/* Full service area map */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Map</div>
                  <ServiceAreaMap
                    city={client.city ?? undefined}
                    serviceArea={client.service_type}
                    address={getDetailValue("address") || undefined}
                    radiusMiles={Number(getDetailValue("service_radius_miles")) || undefined}
                  />
                </div>
              </div>
            )}

            {/* PHOTOS TAB */}
            {leftTab === "photos" && (
              <div className="p-3">
                {workPhotos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-[12px] text-muted-foreground">No work photos uploaded yet.</p>
                    <Link to={`/edit/${client.id}`} className="text-[12px] text-primary hover:underline mt-1">
                      Add photos in Edit Client
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {workPhotos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIndex(i)}
                        className="aspect-square rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <img src={photo} alt={`Work sample ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main script area ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {isEditing ? (
              <div className="space-y-4">
                <p className="text-[13px] text-muted-foreground">
                  Editing script — changes save when you click Save above.
                </p>
                <RichTextEditor
                  value={editedContent}
                  onChange={setEditedContent}
                  placeholder="Enter script content..."
                  minHeight="500px"
                />
              </div>
            ) : (
              <FormattedScript content={script.script_content} />
            )}
          </div>
        </main>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 bg-black/50 rounded-full"
            onClick={() => setSelectedImageIndex(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {workPhotos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 bg-black/50 rounded-full text-2xl"
                onClick={(e) => { e.stopPropagation(); setSelectedImageIndex((p) => (p === 0 ? workPhotos.length - 1 : (p ?? 0) - 1)); }}
              >‹</button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 bg-black/50 rounded-full text-2xl"
                onClick={(e) => { e.stopPropagation(); setSelectedImageIndex((p) => ((p ?? 0) + 1) % workPhotos.length); }}
              >›</button>
            </>
          )}
          <img
            src={workPhotos[selectedImageIndex]}
            alt={`Work sample ${selectedImageIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {workPhotos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-3 py-1 rounded-full">
              {selectedImageIndex + 1} / {workPhotos.length}
            </div>
          )}
        </div>
      )}

      {/* ── Floating panels (unchanged from original) ────────────────────── */}

      {objectionTemplates.length > 0 && (
        <>
          <Button onClick={() => { setShowObjections(!showObjections); if (!showObjections) setShowFaqs(false); }} className="fixed bottom-6 right-6 h-14 rounded-full shadow-lg z-40" size="lg">
            {showObjections ? <><X className="mr-2 h-5 w-5" />Close</> : <><MessageSquare className="mr-2 h-5 w-5" />Objections</>}
          </Button>
          {showObjections && (
            <div className="fixed bottom-24 right-6 w-96 max-h-[500px] bg-background border border-border rounded-lg shadow-2xl z-30 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-muted/50">
                <h3 className="font-semibold text-base">Objection Handling</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Quick reference for common objections</p>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
                {objectionTemplates.map((t) => (
                  <div key={t.id} className="border border-border rounded-md cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setExpandedObjection(expandedObjection === t.id ? null : t.id)}>
                    <div className="p-3 flex items-center justify-between">
                      <h4 className="font-medium text-[13px]">{t.service_name}</h4>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandedObjection === t.id ? "rotate-90" : ""}`} />
                    </div>
                    {expandedObjection === t.id && (
                      <div className="px-3 pb-3 pt-0 border-t border-border text-[13px]">
                        <FormattedScript content={t.content} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {faqs.length > 0 && (
        <>
          <Button onClick={() => { setShowFaqs(!showFaqs); if (!showFaqs) setShowObjections(false); }} className={`fixed ${objectionTemplates.length > 0 ? "bottom-24" : "bottom-6"} right-6 h-14 rounded-full shadow-lg z-40`} size="lg">
            {showFaqs ? <><X className="mr-2 h-5 w-5" />Close</> : <><MessageSquare className="mr-2 h-5 w-5" />FAQs</>}
          </Button>
          {showFaqs && (
            <div className="fixed bottom-24 right-6 w-96 max-h-[500px] bg-background border border-border rounded-lg shadow-2xl z-30 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-muted/50">
                <h3 className="font-semibold text-base">FAQs</h3>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
                {faqs.map((faq) => (
                  <div key={faq.id} className="border border-border rounded-md cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}>
                    <div className="p-3 flex items-center justify-between">
                      <h4 className="font-medium text-[13px]">{faq.question}</h4>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandedFaq === faq.id ? "rotate-90" : ""}`} />
                    </div>
                    {expandedFaq === faq.id && (
                      <div className="px-3 pb-3 pt-0 border-t border-border text-[13px]">
                        <FormattedScript content={faq.answer} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {qualificationQuestions.length > 0 && (
        <>
          <Button
            onClick={() => { const opening = !showQualification; setShowQualification(opening); if (opening) { setShowObjections(false); setShowFaqs(false); } }}
            className="fixed bottom-6 left-6 h-14 rounded-full shadow-lg z-40"
            size="lg"
          >
            {showQualification ? <><X className="mr-2 h-5 w-5" />Close</> : <><ClipboardCheck className="mr-2 h-5 w-5" />Qualify</>}
          </Button>
          {showQualification && (
            <div className="fixed bottom-24 left-6 w-[500px] max-h-[600px] bg-background border border-border rounded-lg shadow-2xl z-30 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-muted/50">
                <h3 className="font-semibold text-base">Client Qualification</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Discovery questions to qualify the prospect</p>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-4">
                {qualificationQuestions.map((question) => {
                  const response = qualificationResponses[question.id];
                  return (
                    <div key={question.id} className="space-y-2 pb-4 border-b border-border last:border-0">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={response?.is_asked || false} onCheckedChange={(checked) => handleQualificationCheck(question.id, checked as boolean)} className="mt-1" />
                        <Label className="text-[13px] font-medium leading-relaxed cursor-pointer flex-1">{question.question}</Label>
                      </div>
                      <Textarea
                        placeholder="Customer's response..."
                        value={response?.customer_response || ""}
                        onChange={(e) => handleQualificationResponse(question.id, e.target.value)}
                        className="text-[13px]"
                        rows={2}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-border bg-muted/50 space-y-3">
                <Button onClick={handleGenerateSummary} disabled={generatingSummary} className="w-full">
                  {generatingSummary ? "Generating..." : <><Sparkles className="mr-2 h-4 w-4" />Generate AI Summary</>}
                </Button>
                {qualificationSummary && (
                  <div className="p-3 bg-background border border-border rounded text-[13px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {qualificationSummary}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
