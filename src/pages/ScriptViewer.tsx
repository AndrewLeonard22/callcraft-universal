import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, X, ClipboardCheck, Sparkles, ExternalLink,
  Calendar, RotateCcw, PhoneCall, Link2, Globe, Ban, Image as ImageIcon,
  ChevronRight, MapPin, Zap, MessageSquare,
} from "lucide-react";
import { DebouncedSaveManager } from "@/utils/saveHelpers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZipChecker } from "@/components/ZipChecker";
import { AreaCockpit } from "@/components/AreaCockpit";
import { ScriptTeleprompter } from "@/components/ScriptTeleprompter";
import { ScriptBlockEditor } from "@/components/ScriptBlockEditor";
import { FormattedScript } from "@/components/FormattedScript";
import { ScriptActions } from "@/components/ScriptActions";
import { ProjectEstimatePanel } from "@/components/ProjectEstimatePanel";
import { AreaMapTab } from "@/components/AreaMapTab";
import { getClientLogo, safeUrl } from "@/utils/clientHelpers";
import { logger } from "@/utils/logger";

interface ClientData {
  id: string; name: string; service_type: string; city: string | null;
  hard_nos: string[]; services_advertised: string[]; excluded_zips: string[];
  things_to_know: string | null; financing_offered: string | null;
  avg_install_time: string | null;
  additional_contacts: Array<{ name: string; role: string; phone: string }>;
  // Area map fields (Pass 1 migration)
  hq_lat?: number | null; hq_lng?: number | null; hq_address?: string | null;
  excluded_areas?: import("@/utils/areaLookup").ExcludedArea[];
}
interface ClientDetail { field_name: string; field_value: string; }
interface Script { script_content: string; version: number; service_type_id?: string; service_name?: string; }
interface ObjectionTemplate { id: string; service_name: string; content: string; }
interface FAQ { id: string; service_type_id: string; question: string; answer: string; }
interface QualificationQuestion { id: string; service_type_id: string | null; question: string; display_order: number; }
interface QualificationResponse { id: string; script_id: string; question_id: string; is_asked: boolean; customer_response: string | null; }

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
    pavers: "Pavers", turf: "Turf", pergola: "Pergolas", outdoor_kitchen: "Outdoor Kitchens",
    fire_pit: "Fire Pits", pool_deck: "Pool Decks", retaining_wall: "Retaining Walls",
    lighting: "Lighting", drainage: "Drainage", seating_wall: "Seating Walls",
    bbq_islands: "BBQ Islands", water_features: "Water Features",
    full_backyard_remodel: "Full Backyard Remodel",
  };
  return map[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

const getInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700",
];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

type CenterTab = "script" | "objections" | "faq" | "qualification" | "area" | "website";

export default function ScriptViewer() {
  const { scriptId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [details, setDetails] = useState<ClientDetail[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);

  const [centerTab, setCenterTab] = useState<CenterTab>("script");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  // null = unknown (let the iframe try) · false = site refuses framing
  const [frameable, setFrameable] = useState<Record<string, boolean>>({});
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
  useEffect(() => () => { saveManager.current.waitForPendingSaves().then(() => saveManager.current.cancelAll()); }, []);

  const loadClientData = useCallback(async () => {
    try {
      const { data: scriptData, error: scriptError } = await supabase
        .from("scripts").select("*, client_id, service_name, service_type_id, organization_id")
        .eq("id", scriptId).single();
      if (scriptError) throw scriptError;
      setScript(scriptData);
      setServiceTypeId(scriptData.service_type_id);
      setOrganizationId(scriptData.organization_id);

      const [clientResult, detailsResult, faqResult, qualQuestionsResult, qualResponsesResult] = await Promise.all([
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
        hq_lat: raw.hq_lat ?? null, hq_lng: raw.hq_lng ?? null,
        hq_address: raw.hq_address ?? null,
        excluded_areas: Array.isArray(raw.excluded_areas) ? raw.excluded_areas : [],
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
    } finally { setLoading(false); }
  }, [scriptId]);

  // Org-scoped (was: select * of EVERY org's templates, and the tab label
  // proudly displayed the global count). Loads once organizationId resolves
  // from the script row; realtime re-load is filtered to this org too.
  const loadObjectionTemplates = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase.from("objection_handling_templates").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      if (error) throw error;
      setObjectionTemplates(data || []);
    } catch (error) { logger.error("Error loading objection templates:", error); }
  }, []);

  useEffect(() => {
    if (!scriptId) return;
    loadClientData();
    const ch = supabase.channel("sv-main")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scripts", filter: `id=eq.${scriptId}` }, () => loadClientData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [scriptId, loadClientData]);

  useEffect(() => {
    if (!organizationId) return;
    loadObjectionTemplates(organizationId);
    const ch = supabase.channel("sv-objections")
      .on("postgres_changes", { event: "*", schema: "public", table: "objection_handling_templates", filter: `organization_id=eq.${organizationId}` }, () => loadObjectionTemplates(organizationId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [organizationId, loadObjectionTemplates]);

  useEffect(() => {
    if (!client?.id) return;
    const cid = client.id;
    const ch1 = supabase.channel("sv-client").on("postgres_changes", { event: "UPDATE", schema: "public", table: "clients", filter: `id=eq.${cid}` }, () => loadClientData()).subscribe();
    const ch2 = supabase.channel("sv-details").on("postgres_changes", { event: "*", schema: "public", table: "client_details", filter: `client_id=eq.${cid}` }, () => loadClientData()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [client?.id, loadClientData]);

  // Probe whether a URL allows iframing so blocked sites get a designed
  // fallback instead of the browser's "refused to connect" error.
  const checkFrameable = useCallback((url: string) => {
    if (!url) return;
    setFrameable(prev => {
      if (url in prev) return prev;
      fetch(`/api/embed-check?url=${encodeURIComponent(url)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d && typeof d.frameable === "boolean") setFrameable(p => ({ ...p, [url]: d.frameable }));
        })
        .catch(() => {});
      return prev;
    });
  }, []);

  const getDetailValue = (fieldName: string): string => {
    const scriptSpecific = details.find(d => d.field_name === `script_${scriptId}_${fieldName}`)?.field_value;
    if (scriptSpecific) return scriptSpecific;
    return details.find(d => d.field_name === fieldName)?.field_value || "";
  };

  useEffect(() => {
    const w = details.find(d => d.field_name === "website")?.field_value;
    if (w) checkFrameable(w);
  }, [details, checkFrameable]);

  const getWorkPhotos = (): string[] => {
    const raw = getDetailValue("work_photos");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return raw.split(",").map(u => u.trim()).filter(Boolean); }
  };

  const thingsToKnowBullets = (): string[] => {
    const raw = client?.things_to_know || getDetailValue("other_key_info") || "";
    if (!raw) return [];
    return raw.split(/\r?\n/).map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  };

  const handleCopy = () => { if (script) { navigator.clipboard.writeText(script.script_content); toast.success("Copied!"); } };
  const handleDownload = () => {
    if (!script || !client) return;
    const blob = new Blob([script.script_content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${client.name.replace(/\s+/g, "-")}-script.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
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
      setIsEditing(false); toast.success("Script saved");
    } catch (error) { logger.error("Error saving script:", error); toast.error("Failed to save script"); }
    finally { setSaving(false); }
  };

  const handleQualificationCheck = async (questionId: string, isChecked: boolean) => {
    const prevState = qualificationResponses[questionId];
    setQualificationResponses(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {} as QualificationResponse), is_asked: isChecked } }));
    try {
      if (prevState?.id) {
        const { error } = await supabase.from("qualification_responses").update({ is_asked: isChecked }).eq("id", prevState.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("qualification_responses").insert({ script_id: scriptId, question_id: questionId, is_asked: isChecked, customer_response: null }).select().single();
        if (error) throw error;
        setQualificationResponses(prev => ({ ...prev, [questionId]: data }));
      }
    } catch {
      toast.error("Failed to update question status");
      setQualificationResponses(prev => ({ ...prev, [questionId]: prevState || (undefined as any) }));
    }
  };

  const handleQualificationResponse = useCallback(async (questionId: string, response: string) => {
    setQualificationResponses(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {} as QualificationResponse), customer_response: response } }));
    await saveManager.current.debouncedSave(`qual-${questionId}`, async () => {
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
        setQualificationResponses(prev => ({ ...prev, [questionId]: data }));
      }
    }, 500,
    () => setSavingStates(prev => ({ ...prev, [questionId]: true })),
    success => { setSavingStates(prev => ({ ...prev, [questionId]: false })); if (!success) toast.error("Failed to save response"); });
  }, [scriptId]);

  const handleGenerateSummary = async () => {
    if (!qualificationQuestions.length) { toast.error("No qualification questions found"); return; }
    setGeneratingSummary(true);
    try {
      const homeownerQ = qualificationQuestions.find(q => q.question.toLowerCase().includes("homeowner") && q.question.toLowerCase().includes("city"));
      let leadName = "[Lead Name]", leadCity = "[City]";
      if (homeownerQ) {
        const resp = qualificationResponses[homeownerQ.id]?.customer_response;
        if (resp) { const m = resp.match(/^(.+?)\s+from\s+(.+)$/i); if (m) { leadName = m[1].trim(); leadCity = m[2].trim(); } else { leadName = resp; } }
      }
      const responses = qualificationQuestions.map(q => ({ question: q.question, customer_response: qualificationResponses[q.id]?.customer_response || null, is_asked: qualificationResponses[q.id]?.is_asked || false }));
      const { data, error } = await supabase.functions.invoke("generate-qualification-summary", { body: { responses, serviceName: (script as any)?.service_name || client?.service_type, leadName, leadCity } });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      setQualificationSummary(data.summary);
      toast.success("Summary generated");
    } catch (error) { logger.error("Error generating summary:", error); toast.error("Failed to generate summary"); }
    finally { setGeneratingSummary(false); }
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-14 border-b border-border shrink-0" />
        <div className="flex flex-1 min-h-0">
          <div className="w-[340px] border-r border-border animate-pulse bg-muted/20 shrink-0" />
          <div className="flex-1 p-10 space-y-3">
            {[100, 90, 95, 80, 85].map((w, i) => <div key={i} className="h-4 bg-muted rounded" style={{ width: `${w}%` }} />)}
          </div>
          <div className="w-80 border-l border-border animate-pulse bg-muted/20 shrink-0" />
        </div>
      </div>
    );
  }

  if (!client || !script) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Script not found</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const workPhotos = getWorkPhotos();
  const bullets = thingsToKnowBullets();
  const logoUrl = getDetailValue("logo_url");
  const ownerPhotoUrl = getDetailValue("owner_photo_url");
  const hardNos = client.hard_nos ?? [];
  const businessName = getDetailValue("business_name") || client.name;
  const ownersName = getDetailValue("owners_name");
  const salesRepName = getDetailValue("sales_rep_name");
  const salesRepPhone = getDetailValue("sales_rep_phone");

  const clientInitials = businessName.split(/\s+/).filter(Boolean).slice(0, 3).map(w => w[0]).join("").toUpperCase();
  const clientAvatarColor = avatarColor(businessName);

  const subtitle = [ownersName, client.city, `Script v${script.version}`].filter(Boolean).join(" · ");

  // Min project price for DQ strip + estimate panel
  const minPriceRaw = getDetailValue("project_min_price") || getDetailValue("starting_price");
  const minPriceNum = minPriceRaw ? parseFloat(minPriceRaw.replace(/[^0-9.]/g, "")) : undefined;
  const minPriceBadge = minPriceNum && minPriceNum > 0
    ? `MIN $${minPriceNum >= 1000 ? `${Math.round(minPriceNum / 1000)}K` : minPriceNum}`
    : null;

  const TIMELINE_OPTIONS = [
    { label: "< 30 days", key: "under_30_days" },
    { label: "1–3 months", key: "1-3 months" },
    { label: "3–6 months", key: "3-6 months" },
    { label: "6+ months", key: "6+ months" },
  ];
  const TIMELINE_ORDER = TIMELINE_OPTIONS.map(o => o.key);
  const timelineDqThreshold = getDetailValue("timeline_dq_threshold");
  const timelineThresholdIdx = timelineDqThreshold ? TIMELINE_ORDER.indexOf(timelineDqThreshold) : -1;
  const isTimelineDQ = (key: string) => timelineThresholdIdx >= 0 && TIMELINE_ORDER.indexOf(key) > timelineThresholdIdx;
  const showTimelineWidget = timelineThresholdIdx >= 0;

  // The teleprompter parses the script natively now (no iframe, no injected
  // DQ widget HTML) — this only resolves min-price placeholders beforehand.
  const processedScriptContent = (() => {
    let content = script.script_content;
    if (minPriceNum && minPriceNum > 0) {
      const formatted = `$${minPriceNum.toLocaleString("en-US")}`;
      content = content
        .replace(/\[project_min_price\]/gi, formatted)
        .replace(/\{\{project_min_price\}\}/gi, formatted)
        .replace(/\{project_min_price\}/gi, formatted)
        .replace(/\[project minimum\]/gi, formatted)
        .replace(/\[PROJECT MINIMUM\]/gi, formatted)
        .replace(/\[min price\]/gi, formatted)
        .replace(/\[minimum\]/gi, formatted);
    }
    return content;
  })();

  const quickLinks = [
    { key: "appointment_calendar", label: "Book Appointment", icon: Calendar },
    { key: "reschedule_calendar",  label: "Reschedule",       icon: RotateCcw },
    { key: "callback_calendar",    label: "Callback",          icon: PhoneCall },
    { key: "crm_account_link",     label: "CRM Account",      icon: Link2 },
    { key: "website",              label: "Website",           icon: Globe },
  ].filter(({ key }) => !!getDetailValue(key));

  const contacts: Array<{ name: string; role: string; phone?: string; photo?: string }> = [];
  if (ownersName) contacts.push({ name: ownersName, role: "Owner · Primary", photo: ownerPhotoUrl || undefined });
  if (client.additional_contacts?.length) {
    contacts.push(...client.additional_contacts.map(c => ({ name: c.name, role: c.role, phone: c.phone || undefined })));
  } else if (salesRepName) {
    contacts.push({ name: salesRepName, role: "Sales Rep", phone: salesRepPhone || undefined });
  }

  const projectRows = [
    { label: "Minimum project",   value: getDetailValue("project_min_price") || getDetailValue("starting_price") },
    { label: "Avg install time",  value: client.avg_install_time || getDetailValue("avg_install_time") },
    { label: "Max drive distance",value: getDetailValue("max_drive_distance") },
    { label: "Financing offered", value: client.financing_offered || getDetailValue("financing_options") },
    { label: "Warranty",          value: getDetailValue("warranty") },
    { label: "Years in business", value: getDetailValue("years_in_business") },
  ].filter(r => !!r.value);

  const services = client.services_advertised?.length
    ? client.services_advertised
    : getDetailValue("services_offered") ? getDetailValue("services_offered").split(/[,\n]/).map(s => s.trim()).filter(Boolean) : [];

  const websiteUrl = getDetailValue("website");
  const rescheduleUrl = getDetailValue("reschedule_calendar");

  const centerTabs: { id: CenterTab; label: string; icon?: string }[] = [
    { id: "script",         label: "Script" },
    { id: "area",           label: "Area" },
    { id: "objections",     label: `Objections${objectionTemplates.length > 0 ? ` (${objectionTemplates.length})` : ""}` },
    { id: "faq",            label: `FAQ${faqs.length > 0 ? ` (${faqs.length})` : ""}` },
    { id: "qualification",  label: "Qualification" },
    ...(websiteUrl ? [{ id: "website" as CenterTab, label: "Website" }] : []),
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-14 border-b border-border bg-background z-40 flex items-center gap-3 px-4">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Client initials avatar */}
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0 ${clientAvatarColor}`}>
          {clientInitials}
        </div>

        {/* Name + subtitle */}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground leading-tight truncate">{businessName}</div>
          {subtitle && <div className="text-[12px] text-muted-foreground leading-tight">{subtitle}</div>}
        </div>

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

      {/* ── Hard disqualifiers strip ──────────────────────────────────────── */}
      {(hardNos.length > 0 || minPriceBadge) && (
        <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-red-700 shrink-0">
            <Zap className="h-3 w-3" /> Hard Disqualifiers
          </span>
          <div className="flex flex-wrap gap-1.5">
            {hardNos.map(slug => (
              <span key={slug} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-red-200 text-red-700 text-[11px] font-medium">
                <X className="h-3 w-3" /> {hardNoLabel(slug)}
              </span>
            ))}
            {minPriceBadge && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-red-200 text-red-700 text-[11px] font-medium">
                <X className="h-3 w-3" /> {minPriceBadge}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Three-column body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT SIDEBAR — rebuilt: one section pattern, reference-density ── */}
        {centerTab !== "area" && <aside className="w-[300px] shrink-0 border-r border-border overflow-y-auto bg-muted/[0.18]">

          {/* Actions — the CTA plus everything one click away */}
          <div className="space-y-2 px-3.5 pb-3.5 pt-3.5">
            {quickLinks.some(l => l.key === "appointment_calendar") && (
              <a
                href={safeUrl(getDetailValue("appointment_calendar"))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-[13px] font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
              >
                <Calendar className="h-4 w-4" />
                Book Appointment
              </a>
            )}
            {quickLinks.filter(l => l.key !== "appointment_calendar").length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {quickLinks.filter(l => l.key !== "appointment_calendar").map(({ key, label, icon: Icon }) => {
                  const pill = "flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground/85 transition-colors hover:border-foreground/25 hover:text-foreground";
                  // Reschedule opens IN PLACE (Andrew: "I would just want that
                  // to be a pop up") — no tab-jumping mid-call.
                  if (key === "reschedule_calendar") {
                    return (
                      <button key={key} className={pill} onClick={() => { checkFrameable(rescheduleUrl); setRescheduleOpen(true); }}>
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  }
                  return (
                    <a key={key} href={safeUrl(getDetailValue(key))} target="_blank" rel="noopener noreferrer" className={pill}>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contacts */}
          {contacts.length > 0 && (
            <section className="border-t border-border/70 px-3.5 py-3">
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80">Contacts</h3>
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {c.photo ? (
                      <img src={c.photo} alt={c.name} className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
                    ) : (
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarColor(c.name)}`}>
                        {getInitials(c.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{c.name}</div>
                      <div className="truncate text-[11.5px] leading-tight text-muted-foreground">{c.role}{c.phone && ` · ${c.phone}`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Service Area — the setter's #1 mid-call tool, always rendered
              (ZipChecker geocodes keylessly even when the profile is thin). */}
          <section className="border-t border-border/70 px-3.5 py-3">
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80">Service Area</h3>
            {getDetailValue("address") && (
              <div className="mb-2 flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[12.5px] leading-snug text-foreground/90">{getDetailValue("address")}</span>
              </div>
            )}
            {client.excluded_zips?.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {client.excluded_zips.map(z => (
                  <span key={z} className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">{z}</span>
                ))}
              </div>
            )}
            <ZipChecker
              excludedZips={client.excluded_zips ?? []}
              clientCity={client.city ?? undefined}
              clientAddress={getDetailValue("address") || undefined}
              serviceRadiusMiles={Number(getDetailValue("service_radius_miles")) || 30}
              hqLat={client.hq_lat ?? undefined}
              hqLng={client.hq_lng ?? undefined}
            />
          </section>

          {/* Project Parameters */}
          {projectRows.length > 0 && (
            <section className="border-t border-border/70 px-3.5 py-3">
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80">Project Parameters</h3>
              <div className="divide-y divide-border/50 rounded-lg border border-border/70 bg-background">
                {projectRows.map(({ label, value }) => {
                  const text = String(value);
                  const money = /^[\d,]+$/.test(text.trim()) ? `$${text.trim()}` : text;
                  return money.length > 30 ? (
                    <div key={label} className="px-3 py-2">
                      <div className="text-[10.5px] text-muted-foreground">{label}</div>
                      <div className="mt-0.5 text-[12px] leading-snug text-foreground/85">{money}</div>
                    </div>
                  ) : (
                    <div key={label} className="flex items-baseline justify-between gap-3 px-3 py-2">
                      <span className="text-[11.5px] text-muted-foreground">{label}</span>
                      <span className="text-right text-[12.5px] font-semibold tabular-nums text-foreground">{money}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Reference drawers — not mid-call reads, one consistent pattern */}
          {services.length > 0 && (
            <details className="group border-t border-border/70 px-3.5 py-2.5">
              <summary className="flex cursor-pointer list-none select-none items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">Services Offered<ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /></summary>
              <div className="flex flex-wrap gap-1 pt-2">
                {services.map(s => (
                  <span key={s} className="rounded-md border border-border bg-background px-2 py-0.5 text-[12px] text-foreground/85">
                    {client.services_advertised?.length ? serviceLabel(s) : s}
                  </span>
                ))}
              </div>
            </details>
          )}

          {bullets.length > 0 && (
            <details className="group border-t border-border/70 px-3.5 py-2.5">
              <summary className="flex cursor-pointer list-none select-none items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">Things to Know<ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /></summary>
              <ul className="space-y-1.5 pt-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground/90">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    {b}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="group border-t border-border/70 px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none select-none items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">Recent Work<ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /></summary>
            <div className="pt-2">
            {workPhotos.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {workPhotos.slice(0, 5).map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImageIndex(i)}
                      className="relative aspect-video overflow-hidden rounded-md bg-muted transition-opacity hover:opacity-80"
                    >
                      <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                  {workPhotos.length > 5 && (
                    <button
                      onClick={() => setSelectedImageIndex(5)}
                      className="relative aspect-video overflow-hidden rounded-md bg-muted transition-opacity hover:opacity-80"
                    >
                      <img src={workPhotos[5]} alt="" className="h-full w-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="text-sm font-semibold text-white">+{workPhotos.length - 5}</span>
                      </div>
                    </button>
                  )}
                </div>
                <Link to={`/edit/${client.id}`} className="mt-2 block text-center text-[11.5px] text-muted-foreground transition-colors hover:text-foreground">
                  Edit client ↗
                </Link>
              </>
            ) : (
              <Link to={`/edit/${client.id}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-4 text-[12.5px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                + Add work photos
              </Link>
            )}
            </div>
          </details>
        </aside>}

        {/* ── CENTER — Script + Tabs ────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Tab strip */}
          <div className="shrink-0 border-b border-border flex items-end px-6 gap-1 bg-background">
            {centerTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setCenterTab(tab.id)}
                className={`px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  centerTab === tab.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content — Area tab gets full-height flex treatment; others scroll */}
          {/* Area stays mounted — unmount-per-switch reset the map every time
              (Andrew: 'every time I click on area again, it resets'). */}
          {(
            <div className={centerTab === "area" ? "relative flex-1 min-h-0" : "hidden"}>
              {/* FULL-SCREEN map (Andrew's verdict): the canvas IS the tab —
                  edge to edge, booting on the client's HQ so it's never blank —
                  with the address-check floating over it as a glass card
                  (the map-app idiom). Root is h-screen flex, so flex-1 +
                  absolute-inset carries real height (the old auto-scroll
                  column collapsed the canvas to 0px = Andrew's 'blank'). */}
              <div className="absolute inset-0">
                <AreaCockpit
                  hqAddress={getDetailValue("address") || undefined}
                  hqLat={client.hq_lat ?? undefined}
                  hqLng={client.hq_lng ?? undefined}
                  serviceRadiusMiles={Number(getDetailValue("service_radius_miles")) || 30}
                />
              </div>
            </div>
          )}
          {/* WEBSITE — kept mounted so the page doesn't reload every switch */}
          {websiteUrl && (
            <div className={centerTab === "website" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3 text-[12px] text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                <a
                  href={safeUrl(websiteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex shrink-0 items-center gap-1 transition-colors hover:text-foreground"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {frameable[websiteUrl] === false ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-muted/20">
                  <Globe className="h-8 w-8 text-muted-foreground/30" />
                  <div className="text-[13px] font-medium text-foreground">This site doesn't allow embedding</div>
                  <div className="text-[12px] text-muted-foreground">{websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</div>
                  <Button asChild size="sm" className="mt-1 h-8">
                    <a href={safeUrl(websiteUrl)} target="_blank" rel="noopener noreferrer">
                      Open website <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              ) : (
                <iframe
                  src={safeUrl(websiteUrl)}
                  title="Company website"
                  className="min-h-0 w-full flex-1 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
          )}
          {centerTab !== "area" && centerTab !== "website" && (
          <div className="flex-1 overflow-y-auto">

            {/* SCRIPT */}
            {centerTab === "script" && (
              <div className="px-6 pb-5">
                {isEditing ? (
                  <div className="pt-5">
                    <ScriptBlockEditor value={editedContent} onChange={setEditedContent} />
                  </div>
                ) : (
                  <ScriptTeleprompter
                    content={processedScriptContent}
                    timeline={showTimelineWidget ? { options: TIMELINE_OPTIONS.map(o => ({ ...o, dq: isTimelineDQ(o.key) })) } : null}
                  />
                )}
              </div>
            )}

            {/* OBJECTIONS */}
            {centerTab === "objections" && (
              <div className="px-8 py-6 max-w-[780px] mx-auto text-[15px] leading-relaxed">
                {objectionTemplates.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center gap-2">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No objection templates yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {objectionTemplates.map(t => (
                      <div
                        key={t.id}
                        className="border border-border rounded-lg cursor-pointer hover:border-foreground/20 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedObjection(expandedObjection === t.id ? null : t.id)}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">{t.service_name}</span>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expandedObjection === t.id ? "rotate-90" : ""}`} />
                        </div>
                        {expandedObjection === t.id && (
                          <div className="px-4 pb-4 border-t border-border text-[13px]">
                            <FormattedScript content={t.content} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FAQ */}
            {centerTab === "faq" && (
              <div className="px-6 py-5 max-w-[720px] mx-auto">
                {faqs.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center gap-2">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No FAQs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {faqs.map(faq => (
                      <div
                        key={faq.id}
                        className="border border-border rounded-lg cursor-pointer hover:border-foreground/20 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">{faq.question}</span>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expandedFaq === faq.id ? "rotate-90" : ""}`} />
                        </div>
                        {expandedFaq === faq.id && (
                          <div className="px-4 pb-4 border-t border-border text-[13px]">
                            <FormattedScript content={faq.answer} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* QUALIFICATION */}
            {centerTab === "qualification" && (
              <div className="px-6 py-5 max-w-[720px] mx-auto">
                {qualificationQuestions.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center gap-2">
                    <ClipboardCheck className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No qualification questions configured.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {qualificationQuestions.map(question => {
                      const response = qualificationResponses[question.id];
                      return (
                        <div key={question.id} className="space-y-2 pb-5 border-b border-border/60 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={response?.is_asked || false}
                              onCheckedChange={checked => handleQualificationCheck(question.id, checked as boolean)}
                              className="mt-0.5"
                            />
                            <Label className="text-[13px] font-medium leading-snug cursor-pointer flex-1">{question.question}</Label>
                          </div>
                          <Textarea
                            placeholder="Customer's response..."
                            value={response?.customer_response || ""}
                            onChange={e => handleQualificationResponse(question.id, e.target.value)}
                            className="text-[13px] resize-none ml-6"
                            rows={2}
                          />
                        </div>
                      );
                    })}

                    <div className="space-y-3 pt-2">
                      <Button onClick={handleGenerateSummary} disabled={generatingSummary} className="h-9 text-[13px]">
                        {generatingSummary ? "Generating..." : <><Sparkles className="mr-2 h-4 w-4" />Generate AI Summary</>}
                      </Button>
                      {qualificationSummary && (
                        <div className="p-4 bg-muted/50 border border-border rounded-lg text-[13px] whitespace-pre-wrap">
                          {qualificationSummary}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </main>

        {/* ── RIGHT — Project Estimate (hidden on full-bleed tabs) ─────── */}
        {centerTab !== "area" && centerTab !== "website" && (
          <aside className="w-80 shrink-0 border-l border-border overflow-hidden flex flex-col bg-background">
            <ProjectEstimatePanel
              clientMinPrice={minPriceNum}
              clientServices={client.services_advertised?.length ? client.services_advertised : undefined}
              salesRepName={salesRepName || undefined}
            />
          </aside>
        )}
      </div>

      {/* ── Reschedule popup — the calendar comes to the setter ─────────── */}
      {rescheduleOpen && rescheduleUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRescheduleOpen(false)}>
          <div className="flex h-[85vh] w-full max-w-[920px] flex-col overflow-hidden rounded-xl bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Reschedule</span>
              <a
                href={safeUrl(rescheduleUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Open in new tab <ExternalLink className="h-3 w-3" />
              </a>
              <button onClick={() => setRescheduleOpen(false)} className="ml-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {frameable[rescheduleUrl] === false ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-muted/20">
                <RotateCcw className="h-8 w-8 text-muted-foreground/30" />
                <div className="text-[13px] font-medium text-foreground">This calendar doesn't allow embedding</div>
                <Button asChild size="sm" className="mt-1 h-8">
                  <a href={safeUrl(rescheduleUrl)} target="_blank" rel="noopener noreferrer">
                    Open calendar <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            ) : (
              <iframe src={safeUrl(rescheduleUrl)} title="Reschedule calendar" className="min-h-0 w-full flex-1 bg-white" />
            )}
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {selectedImageIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setSelectedImageIndex(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" onClick={() => setSelectedImageIndex(null)}>
            <X className="h-5 w-5" />
          </button>
          {workPhotos.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl" onClick={e => { e.stopPropagation(); setSelectedImageIndex(p => (p === 0 ? workPhotos.length - 1 : (p ?? 0) - 1)); }}>‹</button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl" onClick={e => { e.stopPropagation(); setSelectedImageIndex(p => ((p ?? 0) + 1) % workPhotos.length); }}>›</button>
            </>
          )}
          <img src={workPhotos[selectedImageIndex]} alt="" className="max-w-[90vw] max-h-[85vh] object-contain" onClick={e => e.stopPropagation()} />
          {workPhotos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1 rounded-full">
              {selectedImageIndex + 1} / {workPhotos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
