import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendTemplateMessage } from '@/services/infobipService';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { targetStatus, templateName } = await req.json();

    if (!targetStatus || !templateName) {
      return NextResponse.json({ error: 'Missing targetStatus or templateName' }, { status: 400 });
    }

    // Find all conversations matching the target status
    let query = supabase.from('Conversation').select('sender_number, contact_name');
    
    if (targetStatus !== 'ALL') {
      query = query.eq('status', targetStatus);
    }

    const { data: contacts, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No contacts found for this audience.' });
    }

    // In a real production system with thousands of contacts, 
    // you would use a background job/queue here (like BullMQ or Inngest).
    // For MVP, we will iterate and send them asynchronously in batches.
    
    let successCount = 0;
    
    // Broadcast the template to everyone
    for (const contact of contacts) {
      try {
        const to = contact.sender_number;
        const name = contact.contact_name || to;
        
        // Use the Infobip Template API
        // For MVP we just use the hardcoded 'registration_confirmation' 
        // with the user's name as the placeholder.
        await sendTemplateMessage(to, templateName, [name]);
        
        // Log the outbound message to the database
        await supabase
          .from('Message')
          .insert({
            id: crypto.randomUUID(),
            sender_number: to,
            direction: 'OUTBOUND',
            message_content: `[Campaign Template Sent: ${templateName}]`,
            timestamp: new Date().toISOString(),
            status: 'SENT'
          });
          
        successCount++;
      } catch (err) {
        console.error(`Failed to send campaign message to ${contact.sender_number}:`, err);
      }
    }

    return NextResponse.json({ success: true, count: successCount });
  } catch (error) {
    console.error('Campaign Error:', error);
    return NextResponse.json({ error: 'Failed to execute campaign' }, { status: 500 });
  }
}
