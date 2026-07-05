import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { data: templates, error } = await supabase.from('Template').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    
    // Seed templates if empty for demo purposes
    if (!templates || templates.length === 0) {
      const demoTemplates = [
        { id: crypto.randomUUID(), name: 'welcome_message', content: 'Hello {{1}}, welcome to our service! How can we help you today?' },
        { id: crypto.randomUUID(), name: 'appointment_reminder', content: 'Hi {{1}}, this is a reminder for your appointment tomorrow at {{2}}.' },
        { id: crypto.randomUUID(), name: 'out_of_office', content: 'Thank you for your message. We are currently out of the office. We will reply when we return.' }
      ];
      await supabase.from('Template').insert(demoTemplates);
      return NextResponse.json({ templates: demoTemplates });
    }

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, content, language } = await req.json();
    const id = crypto.randomUUID();
    const { data, error } = await supabase.from('Template').insert({ id, name, content, language: language || 'en' }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
