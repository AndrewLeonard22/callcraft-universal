// Centralized image helper utilities
// Reduces code duplication across components

import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";
import { supabase } from "@/integrations/supabase/client";

/**
 * Get appropriate logo based on service type
 * Centralized to prevent duplication
 */
export const getClientLogo = (serviceType: string, customLogoUrl?: string): string => {
  if (customLogoUrl) return customLogoUrl;
  
  const type = serviceType.toLowerCase();
  
  if (type.includes("pergola")) return logoPergola;
  if (type.includes("hvac") || type.includes("heating") || type.includes("cooling")) return logoHvac;
  if (type.includes("solar") || type.includes("panel")) return logoSolar;
  if (type.includes("landscape") || type.includes("lawn") || type.includes("garden")) return logoLandscaping;
  
  return logoDefault;
};

/**
 * Resolve storage paths to public URLs
 * Optimized for caching
 */
const urlCache = new Map<string, string>();

export const resolveStoragePublicUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  
  // Check cache first
  if (urlCache.has(url)) {
    return urlCache.get(url);
  }
  
  const parts = url.split("/");
  if (parts.length > 1) {
    const bucket = parts[0];
    const path = parts.slice(1).join("/");
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    urlCache.set(url, data.publicUrl);
    return data.publicUrl;
  } else {
    const { data } = supabase.storage.from("template-images").getPublicUrl(url);
    urlCache.set(url, data.publicUrl);
    return data.publicUrl;
  }
};
