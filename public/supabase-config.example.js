// ---------------------------------------------------------------------------
// Supabase configuration TEMPLATE.
//
// 1. Copy this file to "supabase-config.js" (same folder).
// 2. Paste your Project URL and the public "anon" key (Project Settings -> API).
//    The anon key is designed to ship in client apps; the row-level-security
//    policies in supabase/schema.sql are what actually control access.
// 3. Restart the dev server. If left blank, the game still plays fully — only
//    the online leaderboard is unavailable.
//
// Loaded as a plain <script> before the bundle (see index.html) so the same
// build artifact can be pointed at different projects without rebuilding.
// ---------------------------------------------------------------------------
window.SUPABASE_CONFIG = {
  url: '', // e.g. 'https://abcdefgh.supabase.co'
  anonKey: '' // public anon key
};
