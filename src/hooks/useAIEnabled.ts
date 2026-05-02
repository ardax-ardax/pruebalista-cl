import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface AIEnabledState {
  aiEnabled: boolean;
  reason?: string;
  loading: boolean;
}

export function useAIEnabled(): AIEnabledState {
  const { user } = useAuth();
  const [state, setState] = useState<AIEnabledState>({ aiEnabled: true, loading: true });

  useEffect(() => {
    if (!user) {
      setState({ aiEnabled: false, reason: "No autenticado", loading: false });
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("ai_enabled, ai_disabled_reason")
        .eq("id", true)
        .maybeSingle();

      if (data && !data.ai_enabled) {
        const reason = data.ai_disabled_reason?.trim()
          ? data.ai_disabled_reason
          : "La generación con IA está temporalmente deshabilitada por el administrador.";
        setState({
          aiEnabled: false,
          reason: `${reason}\n\nTus créditos no se verán afectados y podrás usarlos cuando se reactive.`,
          loading: false,
        });
        return;
      }

      setState({ aiEnabled: true, loading: false });
    };

    check();
  }, [user?.id]);

  return state;
}
