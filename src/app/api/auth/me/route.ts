import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/waba_agent_id=([^;]+)/);
    const agentId = match ? match[1] : null;

    if (!agentId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const { data: user } = await supabase.from('User').select('*').eq('id', agentId).single();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
