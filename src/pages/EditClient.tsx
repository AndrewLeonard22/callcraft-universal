import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, Upload, X, Plus, Trash2 } from "lucide-react";
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

export default function EditClient() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Client basic info
  const [clientName, setClientName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [city, setCity] = useState("");
  
  
  // Business Info
  const [businessName, setBusinessName] = useState("");
  const [ownersName, setOwnersName] = useState("");
  const [salesRepName, setSalesRepName] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [address, setAddress] = useState("");
  const [servicesOffered, setServicesOffered] = useState("");
  const [otherKeyInfo, setOtherKeyInfo] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState("");
  
  // Links
  const [website, setWebsite] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [crmAccountLink, setCrmAccountLink] = useState("");
  const [appointmentCalendar, setAppointmentCalendar] = useState("");
  const [rescheduleCalendar, setRescheduleCalendar] = useState("");
  const [callbackCalendar, setCallbackCalendar] = useState("");

  // New qualification fields (stored on clients table)
  const [hardNos, setHardNos] = useState<string[]>([]);
  const [servicesAdvertised, setServicesAdvertised] = useState<string[]>([]);
  const [excludedZips, setExcludedZips] = useState<string[]>([]);
  const [thingsToKnow, setThingsToKnow] = useState("");
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContact[]>([]);
  const [financingOffered, setFinancingOffered] = useState("");
  const [avgInstallTime, setAvgInstallTime] = useState("");

  // DQ threshold fields
  const [projectMinPrice, setProjectMinPrice] = useState("");
  const [timelineDqThreshold, setTimelineDqThreshold] = useState("none");

  // Area map settings (hq_lat/hq_lng/hq_address/excluded_areas on clients table)
  const [areaSettings, setAreaSettings] = useState<AreaSettings>({
    hqAddress: "",
    hqLat: null,
    hqLng: null,
    serviceRadiusMiles: "",
    excludedAreas: [],
  });

  // Logo and Photos
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState("");
  const [uploadingOwnerPhoto, setUploadingOwnerPhoto] = useState(false);
  const [workPhotos, setWorkPhotos] = useState<string[]>([]);
  const [uploadingWorkPhoto, setUploadingWorkPhoto] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClientData();

      // Set up real-time subscriptions
      const clientChannel = supabase
        .channel('edit-client-changes')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'clients',
          filter: `id=eq.${clientId}`
        }, () => loadClientData())
        .subscribe();

      const detailsChannel = supabase
        .channel('edit-client-details-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'client_details',
          filter: `client_id=eq.${clientId}`
        }, () => loadClientData())
        .subscribe();

      return () => {
        supabase.removeChannel(clientChannel);
        supabase.removeChannel(detailsChannel);
      };
    } else {
      // Invalid or missing client ID - redirect to dashboard
      toast.error("Invalid client ID");
      navigate("/");
    }
  }, [clientId, navigate]);

  const loadClientData = async () => {
    if (!clientId) {
      toast.error("Client ID is missing");
      navigate("/");
      return;
    }
    
    try {
      const [clientResult, detailsResult] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_details").select("*").eq("client_id", clientId),
      ]);

      if (clientResult.error) {
        if (clientResult.error.code === 'PGRST116') {
          toast.error("Client not found");
          navigate("/");
          return;
        }
        throw clientResult.error;
      }
      
      if (!clientResult.data) {
        toast.error("Client data not found");
        navigate("/");
        return;
      }

      setClientName(clientResult.data.name || "");
      setServiceType(clientResult.data.service_type || "");
      setCity(clientResult.data.city || "");

      // New columns on clients table
      setHardNos(clientResult.data.hard_nos || []);
      setServicesAdvertised(clientResult.data.services_advertised || []);
      setExcludedZips(clientResult.data.excluded_zips || []);
      setThingsToKnow(clientResult.data.things_to_know || "");
      setFinancingOffered(clientResult.data.financing_offered || "");
      setAvgInstallTime(clientResult.data.avg_install_time || "");
      const contacts = clientResult.data.additional_contacts;
      setAdditionalContacts(Array.isArray(contacts) ? (contacts as unknown as AdditionalContact[]) : []);

      // Area map fields (from Pass 1 migration)
      const rawExcluded = (clientResult.data as any).excluded_areas;
      setAreaSettings({
        hqAddress: (clientResult.data as any).hq_address || "",
        hqLat: (clientResult.data as any).hq_lat ?? null,
        hqLng: (clientResult.data as any).hq_lng ?? null,
        serviceRadiusMiles: "",  // filled from detailsMap below
        excludedAreas: Array.isArray(rawExcluded) ? rawExcluded : [],
      });
      
      if (detailsResult.data) {
        const detailsMap = new Map(
          detailsResult.data.map(d => [d.field_name, d.field_value || ""])
        );
        
        setBusinessName(detailsMap.get("business_name") || "");
        setOwnersName(detailsMap.get("owners_name") || "");
        setSalesRepName(detailsMap.get("sales_rep_name") || "");
        setSalesRepPhone(detailsMap.get("sales_rep_phone") || "");
        setAddress(detailsMap.get("address") || "");
        setServicesOffered(detailsMap.get("services_offered") || "");
        setOtherKeyInfo(detailsMap.get("other_key_info") || "");
        setWebsite(detailsMap.get("website") || "");
        setFacebookPage(detailsMap.get("facebook_page") || "");
        setInstagram(detailsMap.get("instagram") || "");
        setCrmAccountLink(detailsMap.get("crm_account_link") || "");
        setAppointmentCalendar(detailsMap.get("appointment_calendar") || "");
        setRescheduleCalendar(detailsMap.get("reschedule_calendar") || "");
        setCallbackCalendar(detailsMap.get("callback_calendar") || "");
        const radiusVal = detailsMap.get("service_radius_miles") || "";
        setServiceRadiusMiles(radiusVal);
        setAreaSettings(prev => ({ ...prev, serviceRadiusMiles: radiusVal }));
        setLogoUrl(detailsMap.get("logo_url") || "");
        setOwnerPhotoUrl(detailsMap.get("owner_photo_url") || "");
        setProjectMinPrice(detailsMap.get("project_min_price") || "");
        setTimelineDqThreshold(detailsMap.get("timeline_dq_threshold") || "none");
        
        // Parse work photos
        const workPhotosRaw = detailsMap.get("work_photos") || "";
        if (workPhotosRaw) {
          try {
            setWorkPhotos(JSON.parse(workPhotosRaw));
          } catch {
            setWorkPhotos(workPhotosRaw.split(",").map(url => url.trim()).filter(Boolean));
          }
        }
      }
    } catch (error) {
      logger.error("Error loading client data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  };

  const saveClientDetailField = async (fieldName: string, fieldValue: string) => {
    if (!clientId) return;

    const trimmed = (fieldValue || "").trim();

    // Find existing row (no unique constraint on client_details, so do manual upsert)
    const { data: existing, error: existingError } = await supabase
      .from("client_details")
      .select("id")
      .eq("client_id", clientId)
      .eq("field_name", fieldName)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!trimmed) {
      if (existing?.id) {
        const { error } = await supabase.from("client_details").delete().eq("id", existing.id);
        if (error) throw error;
      }
      return;
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("client_details")
        .update({ field_value: trimmed })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("client_details")
        .insert({ client_id: clientId, field_name: fieldName, field_value: trimmed });
      if (error) throw error;
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      toast.success("Logo uploaded successfully!");
    } catch (error) {
      logger.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleOwnerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploadingOwnerPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `owner-${clientId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      setOwnerPhotoUrl(publicUrl);
      await saveClientDetailField("owner_photo_url", publicUrl);
      toast.success("Owner photo uploaded!");
    } catch (error) {
      logger.error("Error uploading owner photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingOwnerPhoto(false);
      // allow re-uploading the same file
      e.target.value = "";
    }
  };

  const handleWorkPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingWorkPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `work-${clientId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      setWorkPhotos(prev => [...prev, publicUrl]);
      toast.success("Work photo added!");
    } catch (error) {
      logger.error("Error uploading work photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingWorkPhoto(false);
    }
  };

  const removeWorkPhoto = (index: number) => {
    setWorkPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validate required fields
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (clientName.length > 200) {
      toast.error("Client name must be less than 200 characters");
      return;
    }
    
    if (!serviceType.trim()) {
      toast.error("Service type is required");
      return;
    }

    setSaving(true);
    try {
      // Update basic client info first
      const { data: updatedClient, error: clientError } = await supabase
        .from("clients")
        .update({
          name: clientName.trim(),
          service_type: serviceType.trim(),
          city: city.trim(),
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select()
        .single();

      if (clientError) throw clientError;
      if (!updatedClient) throw new Error("Client update returned no data");

      // Build new details array
      const managedFields = [
        "logo_url",
        "business_name",
        "owners_name",
        "sales_rep_name",
        "sales_rep_phone",
        "address",
        "services_offered",
        "other_key_info",
        "website",
        "facebook_page",
        "instagram",
        "crm_account_link",
        "appointment_calendar",
        "reschedule_calendar",
        "callback_calendar",
        "service_radius_miles",
        "owner_photo_url",
        "work_photos",
        "project_min_price",
        "timeline_dq_threshold",
      ];
      
      const detailsArray = [] as { client_id: string; field_name: string; field_value: string }[];

      // Build complete details array
      const businessFields = [
        { name: "business_name", value: businessName.trim() },
        { name: "owners_name", value: ownersName.trim() },
        { name: "sales_rep_name", value: salesRepName.trim() },
        { name: "sales_rep_phone", value: salesRepPhone.trim() },
        { name: "address", value: address.trim() },
        { name: "services_offered", value: servicesOffered.trim() },
        { name: "other_key_info", value: otherKeyInfo.trim() },
        { name: "project_min_price", value: projectMinPrice.replace(/[^0-9.]/g, "").trim() },
        { name: "timeline_dq_threshold", value: timelineDqThreshold !== "none" ? timelineDqThreshold : "" },
      ];

      businessFields.forEach(({ name, value }) => {
        if (value) {
          detailsArray.push({
            client_id: clientId as string,
            field_name: name,
            field_value: value,
          });
        }
      });

      // Add links
      const linkFields = [
        { name: "website", value: website.trim() },
        { name: "facebook_page", value: facebookPage.trim() },
        { name: "instagram", value: instagram.trim() },
        { name: "crm_account_link", value: crmAccountLink.trim() },
        { name: "appointment_calendar", value: appointmentCalendar.trim() },
        { name: "reschedule_calendar", value: rescheduleCalendar.trim() },
        { name: "callback_calendar", value: callbackCalendar.trim() },
      ];

      linkFields.forEach(({ name, value }) => {
        if (value) {
          detailsArray.push({
            client_id: clientId as string,
            field_name: name,
            field_value: value,
          });
        }
      });

      // Add logo URL
      if (logoUrl) {
        detailsArray.push({
          client_id: clientId as string,
          field_name: "logo_url",
          field_value: logoUrl,
        });
      }
      
      const radiusSave = areaSettings.serviceRadiusMiles || serviceRadiusMiles;
      if (radiusSave) {
        const radiusNumber = parseFloat(radiusSave);
        if (!isNaN(radiusNumber)) {
          detailsArray.push({
            client_id: clientId as string,
            field_name: "service_radius_miles",
            field_value: String(radiusNumber),
          });
        }
      }
      
      // Add owner photo URL
      if (ownerPhotoUrl) {
        detailsArray.push({
          client_id: clientId as string,
          field_name: "owner_photo_url",
          field_value: ownerPhotoUrl,
        });
      }
      
      // Add work photos as JSON array
      if (workPhotos.length > 0) {
        detailsArray.push({
          client_id: clientId as string,
          field_name: "work_photos",
          field_value: JSON.stringify(workPhotos),
        });
      }
      
      // Robust per-field upsert: update/insert non-empty values, delete empties
      // Always process managed fields so clearing a value removes it in DB
      {
        // Fetch existing rows for managed fields
        const { data: existingRows } = await supabase
          .from("client_details")
          .select("id, field_name")
          .eq("client_id", clientId)
          .in("field_name", managedFields);

        const existingMap = new Map((existingRows || []).map(r => [r.field_name as string, r.id as string]));

        const operations: Promise<any>[] = [];

        // Build a lookup of desired values for each managed field
        const desiredMap = new Map<string, string | null>();
        managedFields.forEach((name) => {
          const item = detailsArray.find(d => d.field_name === name);
          desiredMap.set(name, item ? item.field_value : null);
        });

        for (const fieldName of managedFields) {
          const value = desiredMap.get(fieldName);
          const existingId = existingMap.get(fieldName);

          if (value && value.trim()) {
            if (existingId) {
              operations.push(
                (async () => {
                  const { error } = await supabase
                    .from("client_details")
                    .update({ field_value: value.trim() })
                    .eq("id", existingId)
                    .select();
                  if (error) throw error;
                })()
              );
            } else {
              operations.push(
                (async () => {
                  const { error } = await supabase
                    .from("client_details")
                    .insert({ client_id: clientId as string, field_name: fieldName, field_value: value.trim() });
                  if (error) throw error;
                })()
              );
            }
          } else if (existingId) {
            operations.push(
              (async () => {
                const { error } = await supabase
                  .from("client_details")
                  .delete()
                  .eq("id", existingId)
                  .select();
                if (error) throw error;
              })()
            );
          }
        }

        if (operations.length > 0) {
          const results = await Promise.allSettled(operations);
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            throw new Error(`Failed to save ${failures.length} detail field(s). Please try again.`);
          }
        }
      }

      toast.success("Client information updated successfully");
      navigate(`/client/${clientId}`);
    } catch (error: any) {
      logger.error("Error updating client:", error);
      toast.error(error.message || "Failed to update client. Please try again.");
      // Keep user on page so they don't lose their changes
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading client data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3 max-w-3xl">
          <Link to={`/client/${clientId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Scripts
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-5 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight mb-1">Edit Client Information</h1>
          <p className="text-sm text-muted-foreground">Update company profile, qualification data, and links</p>
        </div>

        <div className="space-y-6">

          {/* 1 · Company Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Company Identity</CardTitle>
              <CardDescription>Basic details that identify this company in the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="business-name">Business Name</Label>
                <Input id="business-name" placeholder="Acme Outdoor Solutions" value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="client-name">Display Name</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">Internal label used in the dashboard</p>
                <Input id="client-name" placeholder="Client name" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service-type">Service Type</Label>
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
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">JPG/PNG — max 2MB</p>
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                      <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
                    </div>
                  )}
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-[10px] hover:bg-muted/60 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">{uploading ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}</span>
                    </div>
                    <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2 · People */}
          <Card>
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
                  <div className="mt-1 flex items-center gap-3">
                    {ownerPhotoUrl && (
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-muted border border-border shrink-0">
                        <img src={ownerPhotoUrl} alt="Owner" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <Label htmlFor="owner-photo-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-[10px] hover:bg-muted/60 transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">{uploadingOwnerPhoto ? "Uploading..." : ownerPhotoUrl ? "Change" : "Upload Photo"}</span>
                      </div>
                      <input id="owner-photo-upload" type="file" accept="image/*" onChange={handleOwnerPhotoUpload} className="hidden" disabled={uploadingOwnerPhoto} />
                    </Label>
                    {ownerPhotoUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerPhotoUrl("")} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
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
                    onClick={() => setAdditionalContacts(prev => [...prev, { name: "", role: "", phone: "" }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {additionalContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No additional contacts yet.</p>
                )}
                <div className="space-y-2">
                  {additionalContacts.map((contact, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="grid grid-cols-3 gap-2 flex-1">
                        <Input placeholder="Name" value={contact.name} onChange={e => setAdditionalContacts(prev => prev.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))} className="h-8 text-sm" />
                        <Input placeholder="Role" value={contact.role} onChange={e => setAdditionalContacts(prev => prev.map((c, idx) => idx === i ? { ...c, role: e.target.value } : c))} className="h-8 text-sm" />
                        <Input placeholder="Phone" type="tel" value={contact.phone} onChange={e => setAdditionalContacts(prev => prev.map((c, idx) => idx === i ? { ...c, phone: e.target.value } : c))} className="h-8 text-sm" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setAdditionalContacts(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3 · Services & Qualification */}
          <Card>
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
                <Textarea id="things-to-know" placeholder={"- Does NOT work with HOAs\n- Minimum $8k project\n- Books out 6 weeks"} value={thingsToKnow} onChange={e => setThingsToKnow(e.target.value)} className="min-h-[96px] resize-none font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="other-key-info">Additional Information</Label>
                <Textarea id="other-key-info" placeholder="Important notes agents should know about this client" value={otherKeyInfo} onChange={e => setOtherKeyInfo(e.target.value)} className="mt-1 min-h-[80px] resize-none" />
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
          <Card>
            <CardHeader>
              <CardTitle>Service Area</CardTitle>
              <CardDescription>HQ location, service radius, and excluded zones shown to setters during calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <AreaSettingsEditor
                value={areaSettings}
                onChange={v => {
                  setAreaSettings(v);
                  setServiceRadiusMiles(v.serviceRadiusMiles);
                }}
              />
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
                {timelineDqThreshold !== "none" && (
                  <p className="text-xs text-red-600 mt-2">
                    Anything beyond "{timelineDqThreshold === "under_30_days" ? "< 30 days" : timelineDqThreshold}" will appear as → DQ in the script
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 6 · Links & Calendars */}
          <Card>
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
                  <Label htmlFor="appointment-calendar">Appointment Calendar</Label>
                  <Input id="appointment-calendar" type="url" placeholder="https://calendly.com/..." value={appointmentCalendar} onChange={e => setAppointmentCalendar(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="reschedule-calendar">Reschedule Calendar</Label>
                  <Input id="reschedule-calendar" type="url" placeholder="https://calendly.com/reschedule/..." value={rescheduleCalendar} onChange={e => setRescheduleCalendar(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="callback-calendar">Callback Calendar</Label>
                  <Input id="callback-calendar" type="url" placeholder="https://calendly.com/callback/..." value={callbackCalendar} onChange={e => setCallbackCalendar(e.target.value)} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7 · Work Photos */}
          <Card>
            <CardHeader>
              <CardTitle>Work Photos</CardTitle>
              <CardDescription>Sample photos of completed projects — max 5MB each</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {workPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group">
                    <img src={photo} alt={`Work photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeWorkPhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Label htmlFor="work-photo-upload" className="cursor-pointer">
                  <div className="aspect-square rounded-lg border-2 border-dashed border-input hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors">
                    {uploadingWorkPhoto ? (
                      <span className="text-xs text-muted-foreground">Uploading...</span>
                    ) : (
                      <>
                        <Plus className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Add Photo</span>
                      </>
                    )}
                  </div>
                  <input id="work-photo-upload" type="file" accept="image/*" onChange={handleWorkPhotoUpload} className="hidden" disabled={uploadingWorkPhoto} />
                </Label>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
