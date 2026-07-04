import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppLocation } from '@/services/infobipService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversation');

    if (conversationId) {
      const { data: messages, error } = await supabase
        .from('Message')
        .select('*')
        .eq('sender_number', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ messages: messages || [] });
    }

    // Note: Since Prisma's relation 'messages' was used, we fetch conversations, then fetch latest message for each.
    const { data: conversations, error: convError } = await supabase
      .from('Conversation')
      .select('*')
      .order('last_interaction_timestamp', { ascending: false });

    if (convError) throw convError;

    // Fetch the latest message for each conversation
    const conversationsWithMessages = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { data: latestMessages } = await supabase
          .from('Message')
          .select('*')
          .eq('sender_number', conv.sender_number)
          .order('timestamp', { ascending: false })
          .limit(1);

        return {
          ...conv,
          messages: latestMessages || []
        };
      })
    );

    return NextResponse.json({ conversations: conversationsWithMessages });

  } catch (error) {
    console.error('Failed to fetch messages', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, text, location } = body;

    if (!to) {
      return NextResponse.json({ error: 'Missing "to"' }, { status: 400 });
    }

    let result;
    if (location) {
      result = await sendWhatsAppLocation(to, location.latitude, location.longitude, location.name, location.address);
    } else if (text) {
      result = await sendWhatsAppMessage(to, text);
    } else {
      return NextResponse.json({ error: 'Missing "text" or "location"' }, { status: 400 });
    }
    
    if (result?.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result?.error || 'Failed to send' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Failed to send message', error);
    return NextResponse.json({ error: error.message || 'Failed to send message', stack: error.stack }, { status: 500 });
  }
}
