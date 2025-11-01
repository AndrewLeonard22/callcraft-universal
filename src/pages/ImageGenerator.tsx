import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Wand2, ChevronDown, ChevronRight, ArrowLeft, Save } from "lucide-react";

interface FeatureOption {
  id: string;
  label: string;
  options?: { id: string; label: string }[];
}

const FEATURES: FeatureOption[] = [
  { 
    id: "pergola", 
    label: "Pergola",
    options: [
      { id: "wood", label: "Wood" },
      { id: "aluminum", label: "Aluminum" },
      { id: "vinyl", label: "Vinyl" },
    ]
  },
  { 
    id: "pavers", 
    label: "Pavers",
    options: [
      { id: "concrete", label: "Concrete" },
      { id: "brick", label: "Brick" },
      { id: "natural-stone", label: "Natural Stone" },
      { id: "travertine", label: "Travertine" },
    ]
  },
  { 
    id: "outdoor-kitchen", 
    label: "Outdoor Kitchen",
    options: [
      { id: "basic", label: "Basic (Grill)" },
      { id: "standard", label: "Standard (Grill + Counter)" },
      { id: "premium", label: "Premium (Full Kitchen)" },
    ]
  },
  { 
    id: "fire-pit", 
    label: "Fire Pit",
    options: [
      { id: "round", label: "Round" },
      { id: "square", label: "Square" },
      { id: "linear", label: "Linear" },
    ]
  },
  { 
    id: "pool", 
    label: "Pool",
    options: [
      { id: "rectangular", label: "Rectangular" },
      { id: "freeform", label: "Freeform" },
      { id: "lap", label: "Lap Pool" },
    ]
  },
  { 
    id: "deck", 
    label: "Deck",
    options: [
      { id: "wood", label: "Wood" },
      { id: "composite", label: "Composite" },
      { id: "pvc", label: "PVC" },
    ]
  },
  { 
    id: "landscaping", 
    label: "Landscaping",
    options: [
      { id: "tropical", label: "Tropical" },
      { id: "desert", label: "Desert/Xeriscaping" },
      { id: "traditional", label: "Traditional" },
    ]
  },
  { 
    id: "lighting", 
    label: "Outdoor Lighting",
    options: [
      { id: "path", label: "Path Lights" },
      { id: "ambient", label: "Ambient/String Lights" },
      { id: "accent", label: "Accent/Uplighting" },
    ]
  },
];

export default function ImageGenerator() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [featureOptions, setFeatureOptions] = useState<Record<string, string>>({});
  const [featureSize, setFeatureSize] = useState<string>("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string; business_name?: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .neq('id', '00000000-0000-0000-0000-000000000001')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch business names from client_details
      const { data: businessNamesData } = await supabase
        .from('client_details')
        .select('client_id, field_value')
        .eq('field_name', 'business_name');

      const businessNamesMap = new Map(
        (businessNamesData || []).map(d => [d.client_id, d.field_value])
      );

      const clientsWithNames = (clientsData || []).map(client => ({
        id: client.id,
        name: client.name,
        business_name: businessNamesMap.get(client.id),
      }));
      
      setClients(clientsWithNames);
      if (clientsWithNames.length > 0) {
        setSelectedClientId(clientsWithNames[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load companies");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedImageUrl(null);
    }
  };

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev => {
      const isSelected = prev.includes(featureId);
      if (isSelected) {
        // Remove feature and its option
        const newOptions = { ...featureOptions };
        delete newOptions[featureId];
        setFeatureOptions(newOptions);
        setExpandedFeatures(exp => exp.filter(id => id !== featureId));
        return prev.filter(id => id !== featureId);
      } else {
        // Add feature and expand if it has options
        const feature = FEATURES.find(f => f.id === featureId);
        if (feature?.options && feature.options.length > 0) {
          setExpandedFeatures(exp => [...exp, featureId]);
          // Set default option
          setFeatureOptions(opts => ({ ...opts, [featureId]: feature.options![0].id }));
        }
        return [...prev, featureId];
      }
    });
  };

  const toggleExpanded = (featureId: string) => {
    setExpandedFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const setFeatureOption = (featureId: string, optionId: string) => {
    setFeatureOptions(prev => ({ ...prev, [featureId]: optionId }));
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      toast.error("Please upload a backyard image first");
      return;
    }

    if (selectedFeatures.length === 0) {
      toast.error("Please select at least one feature");
      return;
    }

    setIsGenerating(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.readAsDataURL(selectedFile);
      });

      const imageBase64 = await base64Promise;

      const { data, error } = await supabase.functions.invoke('generate-backyard-image', {
        body: {
          imageBase64,
          features: selectedFeatures,
          featureOptions,
          featureSize
        }
      });

      if (error) throw error;

      if (data.image) {
        setGeneratedImageUrl(data.image);
        toast.success("Image generated successfully!");
      } else {
        throw new Error("No image returned from generation");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async () => {
    if (!generatedImageUrl) {
      toast.error("No image to save");
      return;
    }

    if (!selectedClientId) {
      toast.error("Please select a company");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert base64 to blob
      const base64Data = generatedImageUrl.split(',')[1];
      const blob = await fetch(`data:image/png;base64,${base64Data}`).then(res => res.blob());
      
      // Upload to storage
      const fileName = `${selectedClientId}/${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated-backyards')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('generated-backyards')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('generated_images')
        .insert({
          client_id: selectedClientId,
          image_url: publicUrl,
          features: selectedFeatures,
          feature_options: featureOptions,
          feature_size: featureSize,
          created_by: user.id
        });

      if (dbError) throw dbError;

      toast.success("Image saved to company successfully!");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save image");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Backyard Design Generator
          </h1>
          <p className="text-muted-foreground">
            Upload your backyard photo and select features to see AI-generated design concepts
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload and Options */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Your Backyard</CardTitle>
                <CardDescription>Upload a photo of your backyard (max 10MB)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WEBP up to 10MB
                    </p>
                  </label>
                </div>

                {previewUrl && (
                  <div className="rounded-lg overflow-hidden">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Select Features</CardTitle>
                <CardDescription>Choose what you'd like to add to your backyard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Size Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Feature Size</Label>
                  <RadioGroup value={featureSize} onValueChange={setFeatureSize}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="small" id="size-small" />
                      <Label htmlFor="size-small" className="text-sm cursor-pointer font-normal">
                        Small - Compact, space-efficient designs
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medium" id="size-medium" />
                      <Label htmlFor="size-medium" className="text-sm cursor-pointer font-normal">
                        Medium - Balanced, standard sizing
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="large" id="size-large" />
                      <Label htmlFor="size-large" className="text-sm cursor-pointer font-normal">
                        Large - Spacious, prominent features
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="border-t pt-6">
                  <Label className="text-sm font-semibold mb-3 block">Features to Add</Label>
                  <div className="space-y-3">
                  {FEATURES.map((feature) => {
                    const isSelected = selectedFeatures.includes(feature.id);
                    const isExpanded = expandedFeatures.includes(feature.id);
                    const hasOptions = feature.options && feature.options.length > 0;

                    return (
                      <div key={feature.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={feature.id}
                            checked={isSelected}
                            onCheckedChange={() => toggleFeature(feature.id)}
                          />
                          <Label
                            htmlFor={feature.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {feature.label}
                          </Label>
                          {hasOptions && isSelected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleExpanded(feature.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>

                        {isSelected && hasOptions && isExpanded && (
                          <div className="ml-7 pl-3 border-l-2 border-border">
                            <RadioGroup
                              value={featureOptions[feature.id]}
                              onValueChange={(value) => setFeatureOption(feature.id, value)}
                            >
                              {feature.options!.map((option) => (
                                <div key={option.id} className="flex items-center space-x-2 py-1">
                                  <RadioGroupItem value={option.id} id={`${feature.id}-${option.id}`} />
                                  <Label
                                    htmlFor={`${feature.id}-${option.id}`}
                                    className="text-sm cursor-pointer"
                                  >
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={!selectedFile || selectedFeatures.length === 0 || isGenerating}
              className="w-full h-12 text-base"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Generate Design
                </>
              )}
            </Button>
          </div>

          {/* Generated Result */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Generated Design</CardTitle>
                <CardDescription>Your AI-generated backyard design will appear here</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedImageUrl ? (
                  <>
                    <div className="rounded-lg overflow-hidden shadow-lg">
                      <img
                        src={generatedImageUrl}
                        alt="Generated design"
                        className="w-full h-auto object-cover"
                      />
                    </div>
                    
                    {/* Save to Company Section */}
                    <div className="space-y-3 pt-4 border-t">
                      <Label htmlFor="company-select" className="text-sm font-semibold">
                        Save to Company
                      </Label>
                      <div className="flex gap-2">
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                          <SelectTrigger id="company-select" className="flex-1">
                            <SelectValue placeholder="Select a company" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.business_name || client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleSaveImage}
                          disabled={!selectedClientId || isSaving}
                          size="default"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
                    <div className="text-center text-muted-foreground">
                      <Wand2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>Upload an image and select features to generate</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
