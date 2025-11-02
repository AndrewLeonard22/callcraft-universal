import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServiceAreaMap from "@/components/ServiceAreaMap";

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
  const [otherKeyInfo, setOtherKeyInfo] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState("");
  
  // Links
  const [website, setWebsite] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [crmAccountLink, setCrmAccountLink] = useState("");
  const [appointmentCalendar, setAppointmentCalendar] = useState("");
  const [rescheduleCalendar, setRescheduleCalendar] = useState("");
  
  // Logo
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

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
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      const [clientResult, detailsResult] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_details").select("*").eq("client_id", clientId),
      ]);

      if (clientResult.error) throw clientResult.error;

      setClientName(clientResult.data.name);
      setServiceType(clientResult.data.service_type);
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
        setOtherKeyInfo(detailsMap.get("other_key_info") || "");
        setWebsite(detailsMap.get("website") || "");
        setFacebookPage(detailsMap.get("facebook_page") || "");
        setInstagram(detailsMap.get("instagram") || "");
        setCrmAccountLink(detailsMap.get("crm_account_link") || "");
        setAppointmentCalendar(detailsMap.get("appointment_calendar") || "");
        setRescheduleCalendar(detailsMap.get("reschedule_calendar") || "");
        setServiceRadiusMiles(detailsMap.get("service_radius_miles") || "");
        setLogoUrl(detailsMap.get("logo_url") || "");
      }
    } catch (error) {
      console.error("Error loading client data:", error);
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
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };


  const handleSave = async () => {
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    setSaving(true);
    try {
      // Update basic client info
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          name: clientName,
          service_type: serviceType,
          city: city,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId);

      if (clientError) throw clientError;

      // Update client details
      // Delete only fields managed here to preserve script-specific details
      const managedFields = [
        "logo_url",
        "business_name",
        "owners_name",
        "sales_rep_name",
        "sales_rep_phone",
        "address",
        "other_key_info",
        "website",
        "facebook_page",
        "instagram",
        "crm_account_link",
        "appointment_calendar",
        "reschedule_calendar",
        "service_radius_miles",
      ];
      await supabase
        .from("client_details")
        .delete()
        .eq("client_id", clientId)
        .in("field_name", managedFields);
      
      const detailsArray = [] as { client_id: string; field_name: string; field_value: string }[];

      // Add business info
      const businessFields = [
        { name: "business_name", value: businessName },
        { name: "owners_name", value: ownersName },
        { name: "sales_rep_name", value: salesRepName },
        { name: "sales_rep_phone", value: salesRepPhone },
        { name: "address", value: address },
        { name: "other_key_info", value: otherKeyInfo },
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
        { name: "website", value: website },
        { name: "facebook_page", value: facebookPage },
        { name: "instagram", value: instagram },
        { name: "crm_account_link", value: crmAccountLink },
        { name: "appointment_calendar", value: appointmentCalendar },
        { name: "reschedule_calendar", value: rescheduleCalendar },
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

      // Add numeric service radius
      const radiusNumber = parseFloat(serviceRadiusMiles);
      if (!isNaN(radiusNumber)) {
        detailsArray.push({
          client_id: clientId as string,
          field_name: "service_radius_miles",
          field_value: String(radiusNumber),
        });
      }

      if (detailsArray.length > 0) {
        const { error: detailsError } = await supabase
          .from("client_details")
          .insert(detailsArray);

        if (detailsError) throw detailsError;
      }

      toast.success("Client information updated successfully!");
      navigate(`/client/${clientId}`);
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast.error(error.message || "Failed to update client");
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
                    <div>
                      <Label htmlFor="appointment">Appointment Calendar</Label>
                      <Input
                        id="appointment"
                        type="url"
                        placeholder="https://calendly.com/yourlink"
                        value={appointmentCalendar}
                        onChange={(e) => setAppointmentCalendar(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reschedule">Reschedule Calendar</Label>
                      <Input
                        id="reschedule"
                        type="url"
                        placeholder="https://calendly.com/reschedule"
                        value={rescheduleCalendar}
                        onChange={(e) => setRescheduleCalendar(e.target.value)}
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
