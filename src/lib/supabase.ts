import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
// We use the SECRET_KEY (Service Role) because this is only running in secure Next.js API Routes / backend services
// This allows us to bypass Row Level Security since we haven't configured it for this prototype.
const supabaseKey = process.env.SUPABASE_SECRET_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
