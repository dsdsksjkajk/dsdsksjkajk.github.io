/* Same Supabase project as Idle MMO, so the same usernames/passwords work here.
   The anon key is MEANT to be public; the rules in setup.sql decide who can upload/delete. */
window.ART_CONFIG = {
  url: 'https://irpmgvoficvjnkqkojxg.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycG1ndm9maWN2am5rcWtvanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5OTMxNzEsImV4cCI6MjEwODU2OTE3MX0.wjUzhC-CUTO8K_9vLSGhxPEwD0t3uzYWkwcSEqBFz80',
  bucket: 'art',
  maxBytes: 8 * 1024 * 1024,
};
