import { Download, Copy, Edit2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScriptActionsProps {
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

/**
 * Action buttons for script viewer/editor
 */
export function ScriptActions({
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onCopy,
  onDownload
}: ScriptActionsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {isEditing ? (
        <>
          <Button onClick={onSave} disabled={isSaving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={onCancel} variant="outline" size="sm" disabled={isSaving}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button onClick={onCopy} variant="outline" size="sm">
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button onClick={onDownload} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </>
      )}
    </div>
  );
}
