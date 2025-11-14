import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, GripVertical } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WheelSegment {
  id: string;
  label: string;
  color: string;
  display_order: number;
}

interface WheelSegmentsAdminProps {
  organizationId: string | null;
}

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#10b981", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#6b7280", label: "Gray" },
];

export default function WheelSegmentsAdmin({ organizationId }: WheelSegmentsAdminProps) {
  const [segments, setSegments] = useState<WheelSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<WheelSegment | null>(null);
  const [formData, setFormData] = useState({ label: "", color: "#3b82f6" });

  useEffect(() => {
    if (organizationId) {
      loadSegments();
    }
  }, [organizationId]);

  const loadSegments = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from("wheel_segments")
        .select("*")
        .eq("organization_id", organizationId)
        .order("display_order");

      if (error) throw error;
      setSegments(data || []);
    } catch (error) {
      console.error("Error loading wheel segments:", error);
      toast.error("Failed to load wheel segments");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organizationId || !formData.label.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingSegment) {
        const { error } = await supabase
          .from("wheel_segments")
          .update({
            label: formData.label,
            color: formData.color,
          })
          .eq("id", editingSegment.id);

        if (error) throw error;
        toast.success("Wheel segment updated successfully");
      } else {
        const maxOrder = segments.length > 0 
          ? Math.max(...segments.map(s => s.display_order))
          : -1;

        const { error } = await supabase
          .from("wheel_segments")
          .insert({
            organization_id: organizationId,
            label: formData.label,
            color: formData.color,
            display_order: maxOrder + 1,
          });

        if (error) throw error;
        toast.success("Wheel segment added successfully");
      }

      setDialogOpen(false);
      setEditingSegment(null);
      setFormData({ label: "", color: "#3b82f6" });
      loadSegments();
    } catch (error) {
      console.error("Error saving wheel segment:", error);
      toast.error("Failed to save wheel segment");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this segment?")) return;

    try {
      const { error } = await supabase
        .from("wheel_segments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Wheel segment deleted successfully");
      loadSegments();
    } catch (error) {
      console.error("Error deleting wheel segment:", error);
      toast.error("Failed to delete wheel segment");
    }
  };

  const handleEdit = (segment: WheelSegment) => {
    setEditingSegment(segment);
    setFormData({ label: segment.label, color: segment.color });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading wheel segments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Spin the Wheel Segments</CardTitle>
            <CardDescription>
              Configure the options for the spin the wheel game
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingSegment(null);
                  setFormData({ label: "", color: "#3b82f6" });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Segment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSegment ? "Edit" : "Add"} Wheel Segment</DialogTitle>
                <DialogDescription>
                  {editingSegment ? "Update" : "Create"} a segment for the spin the wheel
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Label *</Label>
                  <Input
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Free Coffee, $50 Bonus"
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        className={`h-12 rounded-md border-2 transition-all ${
                          formData.color === color.value
                            ? "border-primary ring-2 ring-primary ring-offset-2"
                            : "border-border hover:border-primary/50"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingSegment ? "Update" : "Add"} Segment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {segments.length > 0 ? (
          <div className="space-y-2">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  <div
                    className="w-8 h-8 rounded-md border"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="font-medium">{segment.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(segment)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(segment.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">
            No wheel segments yet. Add your first segment to get started!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
