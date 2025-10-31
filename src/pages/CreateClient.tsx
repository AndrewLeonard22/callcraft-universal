import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
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
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [isScriptDragging, setIsScriptDragging] = useState(false);
  
  // Business Info
  const [businessName, setBusinessName] = useState("");
  const [ownersName, setOwnersName] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [otherKeyInfo, setOtherKeyInfo] = useState("");
  
  // Links
  const [website, setWebsite] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [crmAccountLink, setCrmAccountLink] = useState("");
  const [appointmentCalendar, setAppointmentCalendar] = useState("");
  const [rescheduleCalendar, setRescheduleCalendar] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setScriptTemplate(text);
      toast.success("Script uploaded successfully");
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
    }
  };

  const handleScriptDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsScriptDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      setScriptTemplate(text);
      toast.success("Script uploaded successfully");
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGenerate = async () => {
    if (!scriptTemplate.trim()) {
      toast.error("Please provide a script template");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { 
          use_template: true,
          template_script: scriptTemplate,
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
            appointment_calendar: appointmentCalendar,
            reschedule_calendar: rescheduleCalendar,
          }
        },
      });

      if (error) throw error;

      toast.success("Client and script created successfully!");
      navigate(`/client/${data.client_id}`);
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Client</h1>
          <p className="text-muted-foreground">
            Upload your script template and provide client data to generate a customized call script
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Script Template</CardTitle>
              <CardDescription>
                Upload or paste your base script that will be customized for this client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="script-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm font-medium">Upload Script File</span>
                  </div>
                  <input
                    id="script-upload"
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </Label>
                {scriptTemplate && (
                  <span className="text-sm text-muted-foreground">
                    ✓ Script loaded ({scriptTemplate.length} characters)
                  </span>
                )}
              </div>
              
              <div 
                className={`relative border-2 border-dashed rounded-lg transition-colors ${
                  isScriptDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDrop={handleScriptDrop}
                onDragOver={handleDragOver}
                onDragEnter={() => setIsScriptDragging(true)}
                onDragLeave={() => setIsScriptDragging(false)}
              >
                <Label htmlFor="script-template" className="text-sm font-medium">
                  Or paste/drag your script here
                </Label>
                <Textarea
                  id="script-template"
                  placeholder="Paste your script template here or drag a file..."
                  className="min-h-[200px] font-mono text-sm mt-2 border-0 focus-visible:ring-0"
                  value={scriptTemplate}
                  onChange={(e) => setScriptTemplate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>
                Provide the client data that will be used to customize the script
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="business" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="business">Business Info</TabsTrigger>
                  <TabsTrigger value="additional">Additional Info</TabsTrigger>
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
                      <Label htmlFor="sales-rep">Sales Rep #</Label>
                      <Input
                        id="sales-rep"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={salesRepPhone}
                        onChange={(e) => setSalesRepPhone(e.target.value)}
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
                      <Label htmlFor="service-area">Service Area (miles radius)</Label>
                      <Input
                        id="service-area"
                        type="text"
                        placeholder="e.g., 50 miles, 30-mile radius, Entire county"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="additional">
                  <div>
                    <Label htmlFor="other-info">Additional Information</Label>
                    <Textarea
                      id="other-info"
                      placeholder="Any other important information about the business..."
                      value={otherKeyInfo}
                      onChange={(e) => setOtherKeyInfo(e.target.value)}
                      className="min-h-[200px]"
                    />
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
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Generating Script..." : "Generate Customized Script"}
          </Button>
        </div>
      </div>
    </div>
  );
}
