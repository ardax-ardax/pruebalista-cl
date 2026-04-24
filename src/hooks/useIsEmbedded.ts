import { useEffect, useState } from "react";

/**
 * Returns true when the app is running inside an iframe (e.g. embedded in WordPress).
 */
export const useIsEmbedded = () => {
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      // Cross-origin access throws — that itself means we're embedded.
      setIsEmbedded(true);
    }
  }, []);

  return isEmbedded;
};

export const PUBLIC_APP_URL = "https://pruebas-nlc.lovable.app";

export const openInNewTab = (path = "/") => {
  const url = `${PUBLIC_APP_URL}${path}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
