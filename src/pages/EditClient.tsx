import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, Upload, X, Plus, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServiceAreaMap from "@/components/ServiceAreaMap";
import { logger } from "@/utils/logger";

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
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clients' }, (payload) => {
          if ((payload.new as any).id === clientId) {
            loadClientData();
          }
        })
        .subscribe();

      const detailsChannel = supabase
        .channel('edit-client-details-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_details' }, (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          if (newData?.client_id === clientId || oldData?.client_id === clientId) {
            loadClientData();
          }
        })
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
        setServiceRadiusMiles(detailsMap.get("service_radius_miles") || "");
        setLogoUrl(detailsMap.get("logo_url") || "");
        setOwnerPhotoUrl(detailsMap.get("owner_photo_url") || "");
        
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
      toast.success("Owner photo uploaded!");
    } catch (error) {
      logger.error("Error uploading owner photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingOwnerPhoto(false);
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
        "service_radius_miles",
        "owner_photo_url",
        "work_photos",
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
      
      if (serviceRadiusMiles) {
        const radiusNumber = parseFloat(serviceRadiusMiles);
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
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link to={`/client/${clientId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Scripts
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Edit Client Information</h1>
          <p className="text-muted-foreground">
            Update client business information and links
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update the client's basic details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client name"
                />
              </div>
              <div>
                <Label htmlFor="service-type">Service Type</Label>
                <Input
                  id="service-type"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="e.g., HVAC, Plumbing, Solar"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  {logoUrl && (
                    <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted border border-border">
                      <img 
                        src={logoUrl} 
                        alt="Company logo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {uploading ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                      </span>
                    </div>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Upload a company logo (max 2MB, JPG/PNG)
                </p>
              </div>
              
              {/* Owner Photo Upload */}
              <div>
                <Label>Business Owner Photo</Label>
                <div className="flex items-center gap-4 mt-2">
                  {ownerPhotoUrl && (
                    <div className="h-20 w-20 rounded-full overflow-hidden bg-muted border border-border">
                      <img 
                        src={ownerPhotoUrl} 
                        alt="Owner photo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <Label htmlFor="owner-photo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {uploadingOwnerPhoto ? "Uploading..." : ownerPhotoUrl ? "Change Photo" : "Upload Photo"}
                      </span>
                    </div>
                    <input
                      id="owner-photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleOwnerPhotoUpload}
                      className="hidden"
                      disabled={uploadingOwnerPhoto}
                    />
                  </Label>
                  {ownerPhotoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOwnerPhotoUrl("")}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Upload a photo of the business owner (max 2MB, JPG/PNG)
                </p>
              </div>
              
              {/* Work Photos Upload */}
              <div>
                <Label>Photos of Work</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Upload sample photos of completed projects (max 5MB each)
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {workPhotos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group">
                      <img 
                        src={photo} 
                        alt={`Work photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeWorkPhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
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
                    <input
                      id="work-photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleWorkPhotoUpload}
                      className="hidden"
                      disabled={uploadingWorkPhoto}
                    />
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Area Map</CardTitle>
              <CardDescription>
                View and validate addresses within the service area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceAreaMap city={city} serviceArea={serviceType} address={address} radiusMiles={parseFloat(serviceRadiusMiles) || undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>
                Edit the business info and links
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="business" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="business">Business Info</TabsTrigger>
                  <TabsTrigger value="links">Links</TabsTrigger>
                </TabsList>
                
                <TabsContent value="business">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="business-name">Business Name</Label>
                      <Input
                        id="business-name"
                        placeholder="Business Name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="owners-name">Owner's Name</Label>
                      <Input
                        id="owners-name"
                        placeholder="Owner's Name"
                        value={ownersName}
                        onChange={(e) => setOwnersName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sales-rep-name">Sales Rep Name</Label>
                      <Input
                        id="sales-rep-name"
                        placeholder="Jane Doe"
                        value={salesRepName}
                        onChange={(e) => setSalesRepName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sales-rep">Sales Rep Phone</Label>
                      <Input
                        id="sales-rep"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={salesRepPhone}
                        onChange={(e) => setSalesRepPhone(e.target.value)}
                      />
                </div>
                <div>
                  <Label htmlFor="service-radius">Service Radius (miles)</Label>
                  <Input
                    id="service-radius"
                    type="number"
                    min={1}
                    placeholder="e.g., 30"
                    value={serviceRadiusMiles}
                    onChange={(e) => setServiceRadiusMiles(e.target.value)}
                  />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St, City, State ZIP"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="services-offered">Services Offered</Label>
                      <Textarea
                        id="services-offered"
                        placeholder="e.g., Pergolas, Turf, Pavers, Full Outdoor Remodels"
                        value={servicesOffered}
                        onChange={(e) => setServicesOffered(e.target.value)}
                        className="min-h-[100px] resize-none"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="links">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://example.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="facebook">Facebook Page</Label>
                      <Input
                        id="facebook"
                        type="url"
                        placeholder="https://facebook.com/yourpage"
                        value={facebookPage}
                        onChange={(e) => setFacebookPage(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        type="url"
                        placeholder="https://instagram.com/yourprofile"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="crm">CRM Account Link</Label>
                      <Input
                        id="crm"
                        type="url"
                        placeholder="https://crm.example.com/account"
                        value={crmAccountLink}
                        onChange={(e) => setCrmAccountLink(e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
