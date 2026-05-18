import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/utils/logger";

export default function ClientScripts() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [noScripts, setNoScripts] = useState(false);

  useEffect(() => {
    if (!clientId) {
      navigate("/");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        supabase
          .from("clients")
          .update({ last_accessed_at: new Date().toISOString() })
          .eq("id", clientId)
          .then();

        const { data, error } = await supabase
          .from("scripts")
          .select("id")
          .eq("client_id", clientId)
          .eq("is_template", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (data?.id) {
          navigate(`/script/${data.id}`, { replace: true });
        } else {
          setNoScripts(true);
        }
      } catch (err) {
        logger.error("ClientScripts redirect error:", err);
        toast.error("Failed to load scripts");
        if (!cancelled) navigate("/");
      }
    })();

    return () => { cancelled = true; };
  }, [clientId, navigate]);

  if (!noScripts) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground text-sm">No scripts yet for this company.</p>
      <Link to={`/create-script/${clientId}`}>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create First Script
        </Button>
      </Link>
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
