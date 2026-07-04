import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    hasInfobipUrl: !!process.env.INFOBIP_BASE_URL,
    hasInfobipKey: !!process.env.INFOBIP_API_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SECRET_KEY,
    infobipUrlLength: process.env.INFOBIP_BASE_URL?.length || 0
  });
}
