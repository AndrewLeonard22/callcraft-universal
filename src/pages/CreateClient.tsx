import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, User, Phone, MapPin, Globe, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CreateClient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Business Info
  const [businessName, setBusinessName] = useState("");
  const [ownersName, setOwnersName] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [otherKeyInfo, setOtherKeyInfo] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState<string>("");
  
  // Links
  const [website, setWebsite] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [crmAccountLink, setCrmAccountLink] = useState("");

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      toast.error("Please provide a business name");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { 
          business_info: {
            business_name: businessName,
            owners_name: ownersName,
            sales_rep_phone: salesRepPhone,
            address,
            service_area: serviceArea,
            other_key_info: otherKeyInfo,
          },
          links: {
            website,
            facebook_page: facebookPage,
            instagram,
            crm_account_link: crmAccountLink,
          }
        },
      });

      if (error) throw error;

      toast.success("Company created successfully!");
      const newClientId = data.client_id as string;

      // Save numeric service radius for accurate map rendering
      const radiusNumber = parseFloat(serviceRadiusMiles);
      if (!isNaN(radiusNumber)) {
        await supabase.from("client_details").insert({
          client_id: newClientId,
          field_name: "service_radius_miles",
          field_value: String(radiusNumber),
        });
      }

      navigate(`/client/${newClientId}`);
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast.error(error.message || "Failed to create client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 max-w-4xl">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 hover:bg-muted/50 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Create New Company</h1>
            <p className="text-muted-foreground">
              Add a new company profile to get started with call scripts
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Company Information
              </CardTitle>
              <CardDescription>
                Fill in the details to create your company profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="business" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="business" className="gap-2 data-[state=active]:shadow-sm">
                    <Building2 className="h-4 w-4" />
                    Business Info
                  </TabsTrigger>
                  <TabsTrigger value="links" className="gap-2 data-[state=active]:shadow-sm">
                    <Link2 className="h-4 w-4" />
                    Links
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="business" className="space-y-5 mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="business-name" className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Business Name *
                    </Label>
                    <Input
                      id="business-name"
                      placeholder="Acme Corp"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owners-name" className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Owner's Name
                    </Label>
                    <Input
                      id="owners-name"
                      placeholder="John Smith"
                      value={ownersName}
                      onChange={(e) => setOwnersName(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sales-rep" className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Sales Rep Phone
                    </Label>
                    <Input
                      id="sales-rep"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={salesRepPhone}
                      onChange={(e) => setSalesRepPhone(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Address
                    </Label>
                    <Input
                      id="address"
                      placeholder="123 Main St, City, State ZIP"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="service-area" className="text-sm font-medium">
                        Service Area
                      </Label>
                      <Input
                        id="service-area"
                        type="text"
                        placeholder="County, neighborhoods"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service-radius" className="text-sm font-medium">
                        Service Radius (miles)
                      </Label>
                      <Input
                        id="service-radius"
                        type="number"
                        min={1}
                        placeholder="30"
                        value={serviceRadiusMiles}
                        onChange={(e) => setServiceRadiusMiles(e.target.value)}
                        className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="other-info" className="text-sm font-medium">
                      Additional Information
                    </Label>
                    <Textarea
                      id="other-info"
                      placeholder="Any other important details..."
                      value={otherKeyInfo}
                      onChange={(e) => setOtherKeyInfo(e.target.value)}
                      className="min-h-[120px] bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors resize-none"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="links" className="space-y-5 mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://example.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebook" className="text-sm font-medium">
                      Facebook Page
                    </Label>
                    <Input
                      id="facebook"
                      type="url"
                      placeholder="https://facebook.com/yourpage"
                      value={facebookPage}
                      onChange={(e) => setFacebookPage(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instagram" className="text-sm font-medium">
                      Instagram
                    </Label>
                    <Input
                      id="instagram"
                      type="url"
                      placeholder="https://instagram.com/yourprofile"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="crm" className="text-sm font-medium">
                      CRM Account Link
                    </Label>
                    <Input
                      id="crm"
                      type="url"
                      placeholder="https://crm.example.com/account"
                      value={crmAccountLink}
                      onChange={(e) => setCrmAccountLink(e.target.value)}
                      className="h-11 bg-background shadow-sm border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-primary/90 gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Company...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create Company
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
