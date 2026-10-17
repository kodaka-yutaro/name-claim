// Public settings. The anon key is safe to publish: the page can only call the
// nc_propose / nc_stats functions defined in supabase/schema.sql.
window.NAMEIT_CONFIG = {
  supabaseUrl: 'https://hktjyaqdjboqghbzincb.supabase.co',
  supabaseAnonKey: 'sb_publishable_l3Wce5v_mFsQ2I-stQR32Q_PsXPg2TD',
  // Google AdSense. Leave empty until the site is approved; then fill in both.
  adsenseClient: '', // e.g. 'ca-pub-1234567890123456'
  adsenseSlot: '',   // the ad unit's data-ad-slot number
};
