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
      // Check global setting
      const { data: globalData } = await supabase
        .from("global_settings")
        .select("ai_enabled")
        .eq("id", true)
        .maybeSingle();

      if (globalData && !globalData.ai_enabled) {
        setState({
          aiEnabled: false,
          reason: "La generación con IA está deshabilitada globalmente por el administrador.",
          loading: false,
        });
        return;
      }

      // Check per-user setting
      const { data: usageData } = await supabase
        .from("user_usage")
        .select("ai_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (usageData && !usageData.ai_enabled) {
        setState({
          aiEnabled: false,
          reason: "La generación con IA está deshabilitada para tu cuenta. Contacta al administrador.",
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
