import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TagInput, HARD_NO_OPTIONS, SERVICES_ADVERTISED_OPTIONS } from "@/components/TagInput";
import { AreaSettingsEditor, type AreaSettings } from "@/components/ExcludedAreaEditor";
import { logger } from "@/utils/logger";

interface AdditionalContact {
  name: string;
  role: string;
  phone: string;
}

export default function CreateClient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Identity
  const [businessName, setBusinessName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // People
  const [ownersName, setOwnersName] = useState("");
  const [ownerPhotoFile, setOwnerPhotoFile] = useState<File | null>(null);
  const [ownerPhotoPreview, setOwnerPhotoPreview] = useState<string>("");
  const [salesRepName, setSalesRepName] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContact[]>([]);

  // Services & Qualification
  const [servicesAdvertised, setServicesAdvertised] = useState<string[]>([]);
  const [servicesOffered, setServicesOffered] = useState("");
  const [hardNos, setHardNos] = useState<string[]>([]);
  const [thingsToKnow, setThingsToKnow] = useState("");
  const [otherKeyInfo, setOtherKeyInfo] = useState("");
  const [financingOffered, setFinancingOffered] = useState("");
  const [avgInstallTime, setAvgInstallTime] = useState("");

  // Service Area
  const [areaSettings, setAreaSettings] = useState<AreaSettings>({
    hqAddress: "",
    hqLat: null,
    hqLng: null,
    serviceRadiusMiles: "",
    excludedAreas: [],
  });
  const [excludedZips, setExcludedZips] = useState<string[]>([]);

  // DQ Thresholds
  const [projectMinPrice, setProjectMinPrice] = useState("");
  const [timelineDqThreshold, setTimelineDqThreshold] = useState("none");

  // Links & Calendars
  const [website, setWebsite] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [crmAccountLink, setCrmAccountLink] = useState("");
  const [appointmentCalendar, setAppointmentCalendar] = useState("");
  const [rescheduleCalendar, setRescheduleCalendar] = useState("");
  const [callbackCalendar, setCallbackCalendar] = useState("");

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo must be less than 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleOwnerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Photo must be less than 2MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setOwnerPhotoFile(file);
    setOwnerPhotoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!businessName.trim()) { toast.error("Business name is required"); return; }
    if (!businessName.trim() || businessName.length > 200) { toast.error("Business name must be under 200 characters"); return; }
    if (!serviceType.trim()) { toast.error("Service type is required"); return; }

    setLoading(true);
    const uploadedPaths: string[] = [];

    try {
      // Upload logo
      let logoUrl = "";
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${Date.now()}-logo.${ext}`;
        uploadedPaths.push(path);
        const { error } = await supabase.storage.from("client-logos").upload(path, logoFile, { cacheControl: "3600", upsert: false });
        if (error) { toast.error("Failed to upload logo"); return; }
        logoUrl = supabase.storage.from("client-logos").getPublicUrl(path).data.publicUrl;
      }

      // Upload owner photo
      let ownerPhotoUrl = "";
      if (ownerPhotoFile) {
        const ext = ownerPhotoFile.name.split(".").pop();
        const path = `${Date.now()}-owner.${ext}`;
        uploadedPaths.push(path);
        const { error } = await supabase.storage.from("client-logos").upload(path, ownerPhotoFile, { cacheControl: "3600", upsert: false });
        if (error) { toast.error("Failed to upload owner photo"); return; }
        ownerPhotoUrl = supabase.storage.from("client-logos").getPublicUrl(path).data.publicUrl;
      }

      // Create client via edge function
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: {
          business_info: {
            business_name: businessName,
            owners_name: ownersName,
            sales_rep_name: salesRepName,
            sales_rep_phone: salesRepPhone,
            address,
            service_area: "",
            services_offered: servicesOffered,
            other_key_info: otherKeyInfo,
          },
          links: {
            website,
            facebook_page: facebookPage,
            instagram,
            crm_account_link: crmAccountLink,
          },
        },
      });

      if (error || !data?.client_id) throw new Error(error?.message || "Client creation failed");
      const newClientId = data.client_id as string;

      // Update clients table with array/area fields
      const { error: updateErr } = await supabase.from("clients").update({
        service_type: serviceType.trim(),
        city: city.trim() || null,
        hard_nos: hardNos,
        services_advertised: servicesAdvertised,
        excluded_zips: excludedZips,
        things_to_know: thingsToKnow.trim() || null,
        financing_offered: financingOffered.trim() || null,
        avg_install_time: avgInstallTime.trim() || null,
        additional_contacts: additionalContacts.filter(c => c.name.trim()) as any,
        hq_address: areaSettings.hqAddress || null,
        hq_lat: areaSettings.hqLat ?? null,
        hq_lng: areaSettings.hqLng ?? null,
        excluded_areas: areaSettings.excludedAreas as any,
      }).eq("id", newClientId);

      if (updateErr) logger.error("Failed to save extended client fields:", updateErr);

      // Save client_details extras
      const extraDetails: Array<{ client_id: string; field_name: string; field_value: string }> = [];
      if (logoUrl) extraDetails.push({ client_id: newClientId, field_name: "logo_url", field_value: logoUrl });
      if (ownerPhotoUrl) extraDetails.push({ client_id: newClientId, field_name: "owner_photo_url", field_value: ownerPhotoUrl });
      const radius = parseFloat(areaSettings.serviceRadiusMiles);
      if (!isNaN(radius) && radius > 0) extraDetails.push({ client_id: newClientId, field_name: "service_radius_miles", field_value: String(radius) });
      const minPrice = projectMinPrice.replace(/[^0-9.]/g, "").trim();
      if (minPrice) extraDetails.push({ client_id: newClientId, field_name: "project_min_price", field_value: minPrice });
      if (timelineDqThreshold !== "none") extraDetails.push({ client_id: newClientId, field_name: "timeline_dq_threshold", field_value: timelineDqThreshold });
      if (appointmentCalendar.trim()) extraDetails.push({ client_id: newClientId, field_name: "appointment_calendar", field_value: appointmentCalendar.trim() });
      if (rescheduleCalendar.trim()) extraDetails.push({ client_id: newClientId, field_name: "reschedule_calendar", field_value: rescheduleCalendar.trim() });
      if (callbackCalendar.trim()) extraDetails.push({ client_id: newClientId, field_name: "callback_calendar", field_value: callbackCalendar.trim() });

      if (extraDetails.length > 0) {
        const { error: detailsErr } = await supabase.from("client_details").insert(extraDetails);
        if (detailsErr) logger.error("Failed to save some client details:", detailsErr);
      }

      toast.success("Company created successfully");
      navigate(`/client/${newClientId}`);
    } catch (err: any) {
      logger.error("Error creating client:", err);
      toast.error(err.message || "Failed to create client");
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("client-logos").remove(uploadedPaths).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3 max-w-3xl">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-5 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight mb-1">Create New Company</h1>
          <p className="text-sm text-muted-foreground">Fill in the company profile to get started with call scripts</p>
        </div>

        <div className="sticky top-[53px] z-30 -mx-2 px-2 py-2 mb-1 bg-background/95 backdrop-blur-sm flex items-center gap-1 overflow-x-auto">
          {[
            { id: "ob-identity", label: "Identity" },
            { id: "ob-people", label: "People" },
            { id: "ob-services", label: "Services" },
            { id: "ob-area", label: "Area" },
            { id: "ob-links", label: "Links" },
          ].map((sec, i) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <span className="text-[10px] font-semibold text-primary tabular-nums">{i + 1}</span>
              {sec.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">

          {/* 1 · Company Identity */}
          <Card id="ob-identity" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Company Identity</CardTitle>
              <CardDescription>Basic details that identify this company in the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="business-name">Business Name <span className="text-destructive">*</span></Label>
                <Input id="business-name" placeholder="Acme Outdoor Solutions" value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service-type">Service Type <span className="text-destructive">*</span></Label>
                  <Input id="service-type" placeholder="e.g., HVAC, Solar, Roofing" value={serviceType} onChange={e => setServiceType(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="e.g., Phoenix, AZ" value={city} onChange={e => setCity(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Business Address</Label>
                <Input id="address" placeholder="123 Main St, Phoenix, AZ 85001" value={address} onChange={e => setAddress(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Company Logo</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">PNG, JPG, or WEBP — max 5MB</p>
                {logoPreview ? (
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted border border-border">
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(""); }}>
                      <X className="h-3.5 w-3.5 mr-1.5" /> Remove
                    </Button>
                  </div>
                ) : (
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-[10px] hover:bg-muted/60 transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">Upload Logo</span>
                    </div>
                    <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </Label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2 · People */}
          <Card id="ob-people" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>Owner, sales rep, and any additional contacts for setters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="owners-name">Owner's Name</Label>
                  <Input id="owners-name" placeholder="John Smith" value={ownersName} onChange={e => setOwnersName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Owner Photo</Label>
                  <div className="mt-1">
                    {ownerPhotoPreview ? (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-muted border border-border">
                          <img src={ownerPhotoPreview} alt="Owner" className="h-full w-full object-cover" />
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setOwnerPhotoFile(null); setOwnerPhotoPreview(""); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Label htmlFor="owner-photo-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-[10px] hover:bg-muted/60 transition-colors w-fit">
                          <Upload className="h-3.5 w-3.5" />
                          <span className="text-sm font-medium">Upload Photo</span>
                        </div>
                        <input id="owner-photo-upload" type="file" accept="image/*" onChange={handleOwnerPhotoChange} className="hidden" />
                      </Label>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sales-rep-name">Sales Rep Name</Label>
                  <Input id="sales-rep-name" placeholder="Jane Doe" value={salesRepName} onChange={e => setSalesRepName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="sales-rep-phone">Sales Rep Phone</Label>
                  <Input id="sales-rep-phone" type="tel" placeholder="+1 (555) 123-4567" value={salesRepPhone} onChange={e => setSalesRepPhone(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-sm font-medium">Additional Contacts</Label>
                    <p className="text-xs text-muted-foreground">Extra numbers setters may need during a call</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => setAdditionalContacts(p => [...p, { name: "", role: "", phone: "" }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {additionalContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No additional contacts yet.</p>
                )}
                <div className="space-y-2">
                  {additionalContacts.map((c, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="grid grid-cols-3 gap-2 flex-1">
                        <Input placeholder="Name" value={c.name} onChange={e => setAdditionalContacts(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="h-8 text-sm" />
                        <Input placeholder="Role" value={c.role} onChange={e => setAdditionalContacts(p => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className="h-8 text-sm" />
                        <Input placeholder="Phone" type="tel" value={c.phone} onChange={e => setAdditionalContacts(p => p.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} className="h-8 text-sm" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setAdditionalContacts(p => p.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3 · Services & Qualification */}
          <Card id="ob-services" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Services & Qualification</CardTitle>
              <CardDescription>What the company sells, what to avoid, and key info for setters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-sm font-medium">Services Advertised</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">What this client sells — shown in the Info tab during calls</p>
                <TagInput value={servicesAdvertised} onChange={setServicesAdvertised} options={SERVICES_ADVERTISED_OPTIONS} placeholder="Add service..." />
              </div>
              <div>
                <Label htmlFor="services-offered">Services Offered (details)</Label>
                <Textarea id="services-offered" placeholder="e.g., Pergolas, Turf, Pavers, Full Outdoor Remodels" value={servicesOffered} onChange={e => setServicesOffered(e.target.value)} className="mt-1 min-h-[80px] resize-none" />
              </div>
              <div>
                <Label className="text-sm font-medium text-red-700">Hard NOs</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Project types this client will never accept — shown as red pills on every call</p>
                <TagInput value={hardNos} onChange={setHardNos} options={HARD_NO_OPTIONS} placeholder="Add hard NO..." />
              </div>
              <div>
                <Label htmlFor="things-to-know">Things to Know</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Bullet points shown in the left panel during calls — one item per line</p>
                <Textarea id="things-to-know" placeholder={"- Does NOT work with HOAs\n- Minimum $8k project\n- Books out 6 weeks"} value={thingsToKnow} onChange={e => setThingsToKnow(e.target.value)} className="min-h-[80px] resize-none font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="other-key-info">Additional Information</Label>
                <Textarea id="other-key-info" placeholder="Any other important details agents should know..." value={otherKeyInfo} onChange={e => setOtherKeyInfo(e.target.value)} className="mt-1 min-h-[80px] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="financing">Financing Offered</Label>
                  <Input id="financing" placeholder="e.g., 0% for 18 months via Hearth" value={financingOffered} onChange={e => setFinancingOffered(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="install-time">Avg Install Time</Label>
                  <Input id="install-time" placeholder="e.g., 3–5 days" value={avgInstallTime} onChange={e => setAvgInstallTime(e.target.value)} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4 · Service Area */}
          <Card id="ob-area" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Service Area</CardTitle>
              <CardDescription>HQ location, service radius, and excluded zones shown to setters during calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <AreaSettingsEditor value={areaSettings} onChange={setAreaSettings} />
              <div>
                <Label className="text-sm font-medium">Excluded Zip Codes</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Zips the setter should never book into — instant red flag in ZipChecker</p>
                <TagInput value={excludedZips} onChange={setExcludedZips} options={[]} placeholder="Type zip and press Enter..." />
              </div>
            </CardContent>
          </Card>

          {/* 5 · Disqualifier Thresholds */}
          <Card className="border-red-200 bg-red-50/20">
            <CardHeader>
              <CardTitle className="text-red-900">Disqualifier Thresholds</CardTitle>
              <CardDescription>Leads outside these thresholds are flagged as hard DQs during calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Minimum Project Budget</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Any budget below this is shown as a hard DQ during calls</p>
                <div className="relative max-w-[220px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input value={projectMinPrice} onChange={e => setProjectMinPrice(e.target.value)} placeholder="e.g., 15000" className="pl-7" />
                </div>
              </div>
              <div>
                <Label>Max Timeline (DQ Threshold)</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Anything beyond this timeline is flagged as a hard DQ</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[
                    { label: "No Limit", value: "none" },
                    { label: "< 30 days", value: "under_30_days" },
                    { label: "1–3 months", value: "1-3 months" },
                    { label: "3–6 months", value: "3-6 months" },
                    { label: "6+ months", value: "6+ months" },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setTimelineDqThreshold(opt.value)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${timelineDqThreshold === opt.value ? "bg-red-600 border-red-600 text-white" : "bg-white border-border text-foreground hover:border-red-300"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 6 · Links & Calendars */}
          <Card id="ob-links" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Links & Calendars</CardTitle>
              <CardDescription>Website, social media, CRM, and booking calendar links</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" type="url" placeholder="https://example.com" value={website} onChange={e => setWebsite(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="crm">CRM Account</Label>
                  <Input id="crm" type="url" placeholder="https://crm.example.com/account" value={crmAccountLink} onChange={e => setCrmAccountLink(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input id="facebook" type="url" placeholder="https://facebook.com/page" value={facebookPage} onChange={e => setFacebookPage(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" type="url" placeholder="https://instagram.com/profile" value={instagram} onChange={e => setInstagram(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="appointment-cal">Appointment Calendar</Label>
                  <Input id="appointment-cal" type="url" placeholder="https://calendly.com/..." value={appointmentCalendar} onChange={e => setAppointmentCalendar(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="reschedule-cal">Reschedule Calendar</Label>
                  <Input id="reschedule-cal" type="url" placeholder="https://calendly.com/reschedule/..." value={rescheduleCalendar} onChange={e => setRescheduleCalendar(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="callback-cal">Callback Calendar</Label>
                  <Input id="callback-cal" type="url" placeholder="https://calendly.com/callback/..." value={callbackCalendar} onChange={e => setCallbackCalendar(e.target.value)} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleCreate} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Creating Company...</>
            ) : "Create Company"}
          </Button>
        </div>
      </div>
    </div>
  );
}
