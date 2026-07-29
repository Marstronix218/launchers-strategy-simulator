export const platformConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
};

export const isCloudConfigured = Boolean(
  platformConfig.supabaseUrl && platformConfig.supabasePublishableKey,
);
