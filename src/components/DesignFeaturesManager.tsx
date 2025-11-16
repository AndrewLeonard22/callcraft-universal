import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";

interface DesignFeature {
  id: string;
  feature_name: string;
  feature_label: string;
  display_order: number;
  options: Array<{ id: string; label: string }>;
  is_active: boolean;
}

export function DesignFeaturesManager() {
  const [features, setFeatures] = useState<DesignFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;

      setOrganizationId(membership.organization_id);

      const { data, error } = await supabase
        .from("design_features")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("display_order");

      if (error) throw error;
      setFeatures((data || []).map(f => ({
        ...f,
        options: f.options as Array<{ id: string; label: string }>,
      })));
    } catch (error) {
      console.error("Error fetching features:", error);
      toast.error("Failed to load design features");
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    const newFeature: DesignFeature = {
      id: `temp-${Date.now()}`,
      feature_name: "",
      feature_label: "",
      display_order: features.length,
      options: [],
      is_active: true,
    };
    setFeatures([...features, newFeature]);
  };

  const updateFeature = (id: string, field: keyof DesignFeature, value: any) => {
    setFeatures(features.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const deleteFeature = async (id: string) => {
    if (id.startsWith("temp-")) {
      setFeatures(features.filter(f => f.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from("design_features")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setFeatures(features.filter(f => f.id !== id));
      toast.success("Feature deleted");
    } catch (error) {
      console.error("Error deleting feature:", error);
      toast.error("Failed to delete feature");
    }
  };

  const addOption = (featureId: string) => {
    const feature = features.find(f => f.id === featureId);
    if (!feature) return;

    const newOptions = [...feature.options, { id: `opt-${Date.now()}`, label: "" }];
    updateFeature(featureId, "options", newOptions);
  };

  const updateOption = (featureId: string, optionId: string, label: string) => {
    const feature = features.find(f => f.id === featureId);
    if (!feature) return;

    const newOptions = feature.options.map(opt => 
      opt.id === optionId ? { ...opt, label } : opt
    );
    updateFeature(featureId, "options", newOptions);
  };

  const deleteOption = (featureId: string, optionId: string) => {
    const feature = features.find(f => f.id === featureId);
    if (!feature) return;

    const newOptions = feature.options.filter(opt => opt.id !== optionId);
    updateFeature(featureId, "options", newOptions);
  };

  const saveFeatures = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      // Validate all features
      for (const feature of features) {
        if (!feature.feature_label.trim()) {
          toast.error("All features must have a label");
          return;
        }
      }

      // Upsert all features
      const operations = features.map(async (feature) => {
        const featureName = feature.feature_label.toLowerCase().replace(/\s+/g, "-");
        
        if (feature.id.startsWith("temp-")) {
          // Insert new feature
          const { error } = await supabase
            .from("design_features")
            .insert({
              organization_id: organizationId,
              feature_name: featureName,
              feature_label: feature.feature_label,
              display_order: feature.display_order,
              options: feature.options,
              is_active: feature.is_active,
            });
          if (error) throw error;
        } else {
          // Update existing feature
          const { error } = await supabase
            .from("design_features")
            .update({
              feature_name: featureName,
              feature_label: feature.feature_label,
              display_order: feature.display_order,
              options: feature.options,
              is_active: feature.is_active,
            })
            .eq("id", feature.id);
          if (error) throw error;
        }
      });

      await Promise.all(operations);
      toast.success("Features saved successfully");
      await fetchFeatures(); // Reload to get proper IDs
    } catch (error) {
      console.error("Error saving features:", error);
      toast.error("Failed to save features");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Design Features Configuration</CardTitle>
        <CardDescription>
          Customize the features available in the design generator for your industry
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {features.map((feature, index) => (
          <Card key={feature.id}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-4">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                <div className="flex-1 space-y-4">
                  <div>
                    <Label htmlFor={`feature-${feature.id}`}>Feature Name</Label>
                    <Input
                      id={`feature-${feature.id}`}
                      value={feature.feature_label}
                      onChange={(e) => updateFeature(feature.id, "feature_label", e.target.value)}
                      placeholder="e.g., Pergola, Pavers, Deck"
                    />
                  </div>
                  
                  <div>
                    <Label>Options</Label>
                    <div className="space-y-2 mt-2">
                      {feature.options.map((option) => (
                        <div key={option.id} className="flex gap-2">
                          <Input
                            value={option.label}
                            onChange={(e) => updateOption(feature.id, option.id, e.target.value)}
                            placeholder="Option label"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteOption(feature.id, option.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(feature.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteFeature(feature.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-2">
          <Button variant="outline" onClick={addFeature}>
            <Plus className="h-4 w-4 mr-2" />
            Add Feature
          </Button>
          <Button onClick={saveFeatures} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save All Features"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}