import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing email or name' }, { status: 400 });
    }

    // Check if user exists in DB
    let { data: user } = await supabase.from('User').select('*').eq('email', email).maybeSingle();

    if (!user) {
      // Create new user
      const newId = crypto.randomUUID();
      const { data: newUser, error } = await supabase.from('User').insert({ id: newId, email, name }).select().single();
      if (error) throw error;
      user = newUser;
    }

    // Create a simple response and set an HTTP-only cookie for the MVP Auth
    const response = NextResponse.json({ success: true, user });
    
    // In a real production app you'd sign a JWT. Here we just set the user ID for the MVP.
    response.cookies.set({
      name: 'waba_agent_id',
      value: user.id,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
