import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Download, Copy, MessageSquare, X, ClipboardCheck,
  Sparkles, ExternalLink, Calendar, RotateCcw, Link2,
  Globe, Ban, Image as ImageIcon, ChevronRight, MapPin, ChevronDown,
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
import OutdoorLivingCalculator from "@/components/OutdoorLivingCalculator";
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

type LeftTab = "info" | "calc" | "photos";

export default function ScriptViewer() {
  const { scriptId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [details, setDetails] = useState<ClientDetail[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);

  const [leftTab, setLeftTab] = useState<LeftTab>("info");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [overflowNosOpen, setOverflowNosOpen] = useState(false);

  const [showObjections, setShowObjections] = useState(false);
  const [showFaqs, setShowFaqs] = useState(false);
  const [showQualification, setShowQualification] = useState(false);

  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [qualificationQuestions, setQualificationQuestions] = useState<QualificationQuestion[]>([]);
  const [qualificationResponses, setQualificationResponses] = useState<Record<string, QualificationResponse>>({});
  const [qualificationSummary, setQualificationSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  const [objectionTemplates, setObjectionTemplates] = useState<ObjectionTemplate[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  const saveManager = useRef(new DebouncedSaveManager());
  const responsesRef = useRef<Record<string, QualificationResponse>>({});

  useEffect(() => { responsesRef.current = qualificationResponses; }, [qualificationResponses]);
  useEffect(() => {
    return () => { saveManager.current.waitForPendingSaves().then(() => saveManager.current.cancelAll()); };
  }, []);

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

      const [clientResult, detailsResult, faqResult, qualQuestionsResult, qualResponsesResult] =
        await Promise.all([
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
        id: raw.id, name: raw.name, service_type: raw.service_type, city: raw.city,
        hard_nos: raw.hard_nos ?? [], services_advertised: raw.services_advertised ?? [],
        excluded_zips: raw.excluded_zips ?? [], things_to_know: raw.things_to_know ?? null,
        financing_offered: raw.financing_offered ?? null, avg_install_time: raw.avg_install_time ?? null,
        additional_contacts: raw.additional_contacts ?? [],
      });

      setDetails(detailsResult.data || []);
      setFaqs(faqResult.data || []);
      setQualificationQuestions(qualQuestionsResult.data || []);

      const responsesMap: Record<string, QualificationResponse> = {};
      (qualResponsesResult.data || []).forEach((r: QualificationResponse) => { responsesMap[r.question_id] = r; });
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
      const { data, error } = await supabase.from("objection_handling_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setObjectionTemplates(data || []);
    } catch (error) { logger.error("Error loading objection templates:", error); }
  }, []);

  useEffect(() => {
    if (scriptId) {
      loadClientData();
      loadObjectionTemplates();
      const channel = supabase.channel("script-viewer-all")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scripts", filter: `id=eq.${scriptId}` }, () => loadClientData())
        .on("postgres_changes", { event: "*", schema: "public", table: "objection_handling_templates" }, () => loadObjectionTemplates())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [scriptId, loadClientData, loadObjectionTemplates]);

  useEffect(() => {
    if (!client) return;
    const clientId = client.id;
    const ch1 = supabase.channel("sv-client").on("postgres_changes", { event: "UPDATE", schema: "public", table: "clients", filter: `id=eq.${clientId}` }, () => loadClientData()).subscribe();
    const ch2 = supabase.channel("sv-details").on("postgres_changes", { event: "*", schema: "public", table: "client_details", filter: `client_id=eq.${clientId}` }, () => loadClientData()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [client?.id, loadClientData]);

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

  const thingsToKnowBullets = (): string[] => {
    const raw = client?.things_to_know || getDetailValue("other_key_info") || "";
    if (!raw) return [];
    return raw.split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  };

  const handleCopy = () => {
    if (script) { navigator.clipboard.writeText(script.script_content); toast.success("Copied!"); }
  };

  const handleDownload = () => {
    if (script && client) {
      const blob = new Blob([script.script_content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${client.name.replace(/\s+/g, "-")}-script.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
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
    } finally { setSaving(false); }
  };

  const handleQualificationCheck = async (questionId: string, isChecked: boolean) => {
    const prevState = qualificationResponses[questionId];
    setQualificationResponses((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {} as QualificationResponse), is_asked: isChecked } }));
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
    setQualificationResponses((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {} as QualificationResponse), customer_response: response } }));
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
      (success) => { setSavingStates((prev) => ({ ...prev, [questionId]: false })); if (!success) toast.error("Failed to save response"); }
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
        if (resp) { const m = resp.match(/^(.+?)\s+from\s+(.+)$/i); if (m) { leadName = m[1].trim(); leadCity = m[2].trim(); } else { leadName = resp; } }
      }
      const responses = qualificationQuestions.map((q) => ({ question: q.question, customer_response: qualificationResponses[q.id]?.customer_response || null, is_asked: qualificationResponses[q.id]?.is_asked || false }));
      const { data, error } = await supabase.functions.invoke("generate-qualification-summary", { body: { responses, serviceName: (script as any)?.service_name || client?.service_type, leadName, leadCity } });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      setQualificationSummary(data.summary);
      toast.success("Summary generated");
    } catch (error) {
      logger.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally { setGeneratingSummary(false); }
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-11 border-b border-border bg-background shrink-0" />
        <div className="flex flex-1 min-h-0">
          <div className="w-72 border-r border-border bg-zinc-50/50 animate-pulse" />
          <div className="flex-1 p-10 space-y-3">
            {[100, 90, 95, 80, 85].map((w, i) => (
              <div key={i} className="h-4 bg-muted rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!client || !script) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Script not found</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const workPhotos = getWorkPhotos();
  const bullets = thingsToKnowBullets();
  const logoUrl = getDetailValue("logo_url");
  const hardNos = client.hard_nos ?? [];
  const MAX_INLINE_NOS = 3;
  const visibleNos = hardNos.slice(0, MAX_INLINE_NOS);
  const hiddenNos = hardNos.slice(MAX_INLINE_NOS);
  const businessName = getDetailValue("business_name") || client.name;

  const quickLinks = [
    { key: "appointment_calendar", label: "Book Appointment", icon: Calendar },
    { key: "reschedule_calendar",  label: "Reschedule",       icon: RotateCcw },
    { key: "crm_account_link",     label: "CRM Account",      icon: Link2 },
    { key: "website",              label: "Website",           icon: Globe },
  ].filter(({ key }) => !!getDetailValue(key));

  const projectRows = [
    { label: "Min Project",   value: getDetailValue("project_min_price") || getDetailValue("starting_price") },
    { label: "Avg Install",   value: client.avg_install_time || getDetailValue("avg_install_time") },
    { label: "Financing",     value: client.financing_offered || getDetailValue("financing_options") || getDetailValue("financing_offered") },
    { label: "Max Drive",     value: getDetailValue("max_drive_distance") },
    { label: "Warranty",      value: getDetailValue("warranty") || getDetailValue("warranties") },
    { label: "In Business",   value: getDetailValue("years_in_business") },
  ].filter((r) => !!r.value);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-11 border-b border-border bg-background z-40 flex items-center gap-2 px-3">

        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/client/${client.id}`)}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Logo */}
        <div className="h-6 w-6 rounded overflow-hidden bg-muted shrink-0 border border-border">
          <img src={getClientLogo(client.service_type, logoUrl || undefined)} alt="" className="h-full w-full object-cover" />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-foreground truncate leading-none">{businessName}</span>
          <span className="text-[11px] text-muted-foreground hidden sm:block shrink-0">
            {(script as any)?.service_name || client.service_type}
            {client.city && ` · ${client.city}`}
          </span>
        </div>

        {/* Hard NOs */}
        {hardNos.length > 0 && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {visibleNos.map((slug) => (
              <span key={slug} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                <Ban className="h-2.5 w-2.5 shrink-0" />
                {hardNoLabel(slug)}
              </span>
            ))}
            {hiddenNos.length > 0 && (
              <div className="relative">
                <button
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                  onClick={() => setOverflowNosOpen((v) => !v)}
                >
                  +{hiddenNos.length} <ChevronDown className="h-2.5 w-2.5" />
                </button>
                {overflowNosOpen && (
                  <div className="absolute top-7 right-0 z-50 bg-background border border-border rounded-lg shadow-lg py-1.5 min-w-[160px]">
                    {hiddenNos.map((slug) => (
                      <div key={slug} className="flex items-center gap-1.5 px-3 py-1 text-red-700 text-[11px] font-bold uppercase tracking-wide">
                        <Ban className="h-2.5 w-2.5" />{hardNoLabel(slug)}
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
      </header>

      {/* Hard NOs — mobile second row */}
      {hardNos.length > 0 && (
        <div className="md:hidden shrink-0 flex items-center gap-1 flex-wrap px-3 py-1.5 bg-red-50 border-b border-red-100">
          {hardNos.map((slug) => (
            <span key={slug} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200">
              <Ban className="h-2.5 w-2.5" />{hardNoLabel(slug)}
            </span>
          ))}
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ───────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden bg-zinc-50/40">

          {/* Quick links */}
          {quickLinks.length > 0 && (
            <div className="shrink-0 border-b border-border py-0.5">
              {quickLinks.map(({ key, label, icon: Icon }) => (
                <a
                  key={key}
                  href={safeUrl(getDetailValue(key))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 h-8 px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />
                </a>
              ))}
            </div>
          )}

          {/* Things to Know */}
          {bullets.length > 0 && (
            <div className="shrink-0 border-b border-border px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Things to Know</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-foreground leading-snug">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-sm bg-amber-400 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab strip */}
          <div className="shrink-0 flex items-end gap-0 border-b border-border bg-background/50 px-2 pt-1.5">
            {(["info", "calc", "photos"] as LeftTab[]).map((tab) => {
              const label = tab === "info" ? "Info" : tab === "calc" ? "Calc" : `Photos${workPhotos.length > 0 ? ` (${workPhotos.length})` : ""}`;
              return (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
                    leftTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── INFO TAB ────────────────────────────────────────────── */}
            {leftTab === "info" && (
              <div className="divide-y divide-border/60">

                {/* Contacts */}
                {(() => {
                  const contacts: Array<{ name: string; role: string; phone?: string }> = [];
                  const ownerName = getDetailValue("owners_name");
                  if (ownerName) contacts.push({ name: ownerName, role: "Owner" });
                  if (client.additional_contacts?.length) {
                    contacts.push(...client.additional_contacts);
                  } else {
                    const repName = getDetailValue("sales_rep_name");
                    const repPhone = getDetailValue("sales_rep_phone");
                    if (repName) contacts.push({ name: repName, role: "Sales Rep", phone: repPhone || undefined });
                  }
                  if (!contacts.length) return null;
                  return (
                    <div className="px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Contacts</div>
                      <div className="space-y-2">
                        {contacts.map((c, i) => (
                          <div key={i}>
                            <div className="text-[12px] font-semibold text-foreground">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{c.role}{c.phone && ` · ${c.phone}`}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Address + ZipChecker */}
                {(getDetailValue("address") || client.excluded_zips?.length > 0 || getDetailValue("service_radius_miles")) && (
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Location</div>
                    {getDetailValue("address") && (
                      <div className="flex items-start gap-1.5 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-[12px] text-foreground">{getDetailValue("address")}</span>
                      </div>
                    )}
                    {getDetailValue("service_radius_miles") && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-muted-foreground">Service radius</span>
                        <span className="text-[12px] text-foreground">{getDetailValue("service_radius_miles")} mi</span>
                      </div>
                    )}
                    {client.excluded_zips?.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[10px] text-muted-foreground mb-1">Excluded zones</div>
                        <div className="flex flex-wrap gap-1">
                          {client.excluded_zips.map((z) => (
                            <span key={z} className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-medium rounded">{z}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="text-[10px] text-muted-foreground mb-1.5">Check a zip / city</div>
                      <ZipChecker
                        excludedZips={client.excluded_zips ?? []}
                        clientCity={client.city ?? undefined}
                        clientAddress={getDetailValue("address") || undefined}
                        serviceRadiusMiles={Number(getDetailValue("service_radius_miles")) || 30}
                      />
                    </div>
                  </div>
                )}

                {/* Services advertised */}
                {(() => {
                  const services = client.services_advertised?.length
                    ? client.services_advertised
                    : getDetailValue("services_offered") ? getDetailValue("services_offered").split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [];
                  if (!services.length) return null;
                  return (
                    <div className="px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Services</div>
                      <div className="flex flex-wrap gap-1">
                        {services.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-medium rounded border border-indigo-100">
                            {client.services_advertised?.length ? serviceLabel(s) : s}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Project details */}
                {projectRows.length > 0 && (
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Project Details</div>
                    <div className="space-y-1.5">
                      {projectRows.map(({ label, value }) => (
                        <div key={label} className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
                          <span className="text-[12px] text-foreground text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current offer */}
                {(getDetailValue("offer_name") || getDetailValue("offer_description")) && (
                  <div className="px-3 py-2.5">
                    <div className="p-2 rounded-md bg-primary/5 border border-primary/10">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/60 mb-0.5">Current Offer</div>
                      {getDetailValue("offer_name") && <div className="text-[12px] font-semibold text-foreground">{getDetailValue("offer_name")}</div>}
                      {getDetailValue("offer_description") && <div className="text-[11px] text-muted-foreground mt-0.5">{getDetailValue("offer_description")}</div>}
                    </div>
                  </div>
                )}

                {/* Map */}
                <div className="px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Service Area Map</div>
                  <ServiceAreaMap
                    city={client.city ?? undefined}
                    serviceArea={client.service_type}
                    address={getDetailValue("address") || undefined}
                    radiusMiles={Number(getDetailValue("service_radius_miles")) || undefined}
                  />
                </div>

                {/* Footer */}
                <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Script v{script.version}</span>
                  <Link to={`/edit/${client.id}`} className="hover:text-foreground transition-colors underline underline-offset-2">Edit client</Link>
                </div>
              </div>
            )}

            {/* ── CALC TAB ────────────────────────────────────────────── */}
            {leftTab === "calc" && (
              <div className="p-2">
                <OutdoorLivingCalculator />
              </div>
            )}

            {/* ── PHOTOS TAB ──────────────────────────────────────────── */}
            {leftTab === "photos" && (
              <div className="p-2.5">
                {workPhotos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-[12px] text-muted-foreground">No work photos yet</p>
                    <Link to={`/edit/${client.id}`} className="text-[12px] text-primary hover:underline">
                      Add photos in Edit Client
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {workPhotos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIndex(i)}
                        className="aspect-square rounded overflow-hidden bg-muted hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
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
          <div className="max-w-2xl mx-auto px-10 py-8">
            {isEditing ? (
              <div className="space-y-4">
                <p className="text-[12px] text-muted-foreground">Editing — save with the button above.</p>
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
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setSelectedImageIndex(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={() => setSelectedImageIndex(null)}>
            <X className="h-5 w-5" />
          </button>
          {workPhotos.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex((p) => (p === 0 ? workPhotos.length - 1 : (p ?? 0) - 1)); }}>‹</button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex((p) => ((p ?? 0) + 1) % workPhotos.length); }}>›</button>
            </>
          )}
          <img src={workPhotos[selectedImageIndex]} alt={`Work sample ${selectedImageIndex + 1}`} className="max-w-[90vw] max-h-[85vh] object-contain" onClick={(e) => e.stopPropagation()} />
          {workPhotos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1 rounded-full">
              {selectedImageIndex + 1} / {workPhotos.length}
            </div>
          )}
        </div>
      )}

      {/* ── Floating panels ──────────────────────────────────────────────── */}

      {/* Objections */}
      {objectionTemplates.length > 0 && (
        <>
          <button
            onClick={() => { setShowObjections(!showObjections); if (!showObjections) setShowFaqs(false); }}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 h-8 px-3 rounded-full bg-background border border-border shadow-md text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
          >
            {showObjections ? <><X className="h-3.5 w-3.5" />Close</> : <><MessageSquare className="h-3.5 w-3.5" />Objections</>}
          </button>
          {showObjections && (
            <div className="fixed bottom-16 right-5 w-96 max-h-[480px] bg-background border border-border rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold">Objection Handling</h3>
                  <p className="text-[11px] text-muted-foreground">Quick reference for common objections</p>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {objectionTemplates.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg cursor-pointer hover:border-primary/30 hover:bg-accent/30 transition-colors" onClick={() => setExpandedObjection(expandedObjection === t.id ? null : t.id)}>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium">{t.service_name}</span>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${expandedObjection === t.id ? "rotate-90" : ""}`} />
                    </div>
                    {expandedObjection === t.id && (
                      <div className="px-3 pb-3 border-t border-border text-[12px]">
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

      {/* FAQs */}
      {faqs.length > 0 && (
        <>
          <button
            onClick={() => { setShowFaqs(!showFaqs); if (!showFaqs) setShowObjections(false); }}
            className={`fixed ${objectionTemplates.length > 0 ? "bottom-[3.5rem]" : "bottom-5"} right-5 z-40 flex items-center gap-1.5 h-8 px-3 rounded-full bg-background border border-border shadow-md text-[12px] font-medium text-foreground hover:bg-accent transition-colors`}
            style={objectionTemplates.length > 0 ? { bottom: "3.25rem" } : {}}
          >
            {showFaqs ? <><X className="h-3.5 w-3.5" />Close</> : <><MessageSquare className="h-3.5 w-3.5" />FAQs</>}
          </button>
          {showFaqs && (
            <div className="fixed bottom-16 right-5 w-96 max-h-[480px] bg-background border border-border rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">FAQs</h3>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {faqs.map((faq) => (
                  <div key={faq.id} className="border border-border rounded-lg cursor-pointer hover:border-primary/30 hover:bg-accent/30 transition-colors" onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium">{faq.question}</span>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${expandedFaq === faq.id ? "rotate-90" : ""}`} />
                    </div>
                    {expandedFaq === faq.id && (
                      <div className="px-3 pb-3 border-t border-border text-[12px]">
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

      {/* Qualify */}
      {qualificationQuestions.length > 0 && (
        <>
          <button
            onClick={() => { const o = !showQualification; setShowQualification(o); if (o) { setShowObjections(false); setShowFaqs(false); } }}
            className="fixed bottom-5 left-5 z-40 flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground shadow-md text-[12px] font-medium hover:bg-primary/90 transition-colors"
          >
            {showQualification ? <><X className="h-3.5 w-3.5" />Close</> : <><ClipboardCheck className="h-3.5 w-3.5" />Qualify</>}
          </button>
          {showQualification && (
            <div className="fixed bottom-16 left-5 w-[480px] max-h-[580px] bg-background border border-border rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">Client Qualification</h3>
                <p className="text-[11px] text-muted-foreground">Discovery questions to qualify the prospect</p>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
                {qualificationQuestions.map((question) => {
                  const response = qualificationResponses[question.id];
                  return (
                    <div key={question.id} className="space-y-1.5 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={response?.is_asked || false} onCheckedChange={(checked) => handleQualificationCheck(question.id, checked as boolean)} className="mt-0.5" />
                        <Label className="text-[12px] font-medium leading-snug cursor-pointer flex-1">{question.question}</Label>
                      </div>
                      <Textarea
                        placeholder="Customer's response..."
                        value={response?.customer_response || ""}
                        onChange={(e) => handleQualificationResponse(question.id, e.target.value)}
                        className="text-[12px] resize-none"
                        rows={2}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-border space-y-2">
                <Button onClick={handleGenerateSummary} disabled={generatingSummary} className="w-full h-8 text-[12px]">
                  {generatingSummary ? "Generating..." : <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Generate AI Summary</>}
                </Button>
                {qualificationSummary && (
                  <div className="p-3 bg-muted/50 border border-border rounded-lg text-[12px] whitespace-pre-wrap max-h-36 overflow-y-auto">
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
