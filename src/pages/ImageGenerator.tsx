import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Wand2 } from "lucide-react";

const FEATURES = [
  { id: "pergola", label: "Pergola" },
  { id: "pavers", label: "Pavers" },
  { id: "outdoor-kitchen", label: "Outdoor Kitchen" },
  { id: "fire-pit", label: "Fire Pit" },
  { id: "pool", label: "Pool" },
  { id: "deck", label: "Deck" },
  { id: "landscaping", label: "Landscaping" },
  { id: "lighting", label: "Outdoor Lighting" },
];

export default function ImageGenerator() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

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
    setSelectedFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
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
          features: selectedFeatures
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
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
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {FEATURES.map((feature) => (
                    <div key={feature.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={feature.id}
                        checked={selectedFeatures.includes(feature.id)}
                        onCheckedChange={() => toggleFeature(feature.id)}
                      />
                      <Label
                        htmlFor={feature.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {feature.label}
                      </Label>
                    </div>
                  ))}
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
              <CardContent>
                {generatedImageUrl ? (
                  <div className="rounded-lg overflow-hidden shadow-lg">
                    <img
                      src={generatedImageUrl}
                      alt="Generated design"
                      className="w-full h-auto object-cover"
                    />
                  </div>
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
