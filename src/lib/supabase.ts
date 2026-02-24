import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://chumnbegvwgrtikteayk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodW1uYmVndndncnRpa3RlYXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTY3NTcsImV4cCI6MjA4NzQ3Mjc1N30.xkuCI4mAl3HcMcZ6hDWJ-btjBHAQHC4XYHrqaZQBv9s';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
