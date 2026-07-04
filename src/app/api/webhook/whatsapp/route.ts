import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { getAutomatedResponse } from '@/services/chatbotService';
import { sendWhatsAppMessage } from '@/services/infobipService';

const INFOBIP_HMAC_SECRET = process.env.INFOBIP_HMAC_SECRET || 'bunny@6010';

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !INFOBIP_HMAC_SECRET) return false;
  
  const hash = crypto
    .createHmac('sha256', INFOBIP_HMAC_SECRET)
    .update(payload)
    .digest('base64');
    
  return hash === signature;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    
    // Check if the user is passing a token in the URL query parameters
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    // Check headers for HMAC signature
    const signature = req.headers.get('x-hub-signature-256') || req.headers.get('x-hub-signature');

    // Authenticate via URL token OR HMAC signature
    let isAuthenticated = false;
    
    if (token === INFOBIP_HMAC_SECRET) {
      isAuthenticated = true;
    } else if (signature && verifySignature(rawBody, signature)) {
      isAuthenticated = true;
    }

    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Invalid authentication token or signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    
    // Infobip payload structure for incoming messages:
    // { results: [ { messageId, from, to, message: { text } } ] }
    const results = body.results || [];

    for (const msg of results) {
      const senderNumber = msg.from || msg.sender;
      const messageId = msg.messageId;
      
      let textContent = '';
      let mediaUrl = null;
      let mediaType = null;
      
      if (msg.message?.text) {
        textContent = msg.message.text;
      } else if (Array.isArray(msg.content) && msg.content.length > 0) {
        const content = msg.content[0];
        if (content.type === 'TEXT') {
          textContent = content.text || '';
        } else if (content.type === 'IMAGE' || content.type === 'VIDEO' || content.type === 'DOCUMENT' || content.type === 'AUDIO') {
          const infobipUrl = content.url || content.mediaUrl || '';
          mediaType = content.type;
          textContent = content.caption || '';
          
          if (infobipUrl) {
            try {
              // Ensure the bucket exists
              await supabase.storage.createBucket('whatsapp_media', { public: true });
              
              // Fetch the image from Infobip with auth
              const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY || '5fc59d2ed3c46876ecd2914f4c4686af-b1ebcd6b-ce8e-47f5-b56f-340c9d041c4c';
              const mediaRes = await fetch(infobipUrl, {
                headers: { 'Authorization': `App ${INFOBIP_API_KEY}` }
              });

              if (mediaRes.ok) {
                const arrayBuffer = await mediaRes.arrayBuffer();
                const fileName = `${crypto.randomUUID()}`;
                const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
                
                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                  .from('whatsapp_media')
                  .upload(fileName, arrayBuffer, { contentType, upsert: true });

                if (!uploadError) {
                  // Get public URL
                  const { data } = supabase.storage.from('whatsapp_media').getPublicUrl(fileName);
                  mediaUrl = data.publicUrl;
                }
              }
            } catch (err) {
              console.error('Failed to proxy media to Supabase:', err);
            }
          }
        }
      } else if (msg.content?.text) {
        textContent = msg.content.text;
      }

      if (!senderNumber || !messageId) continue;

      // Upsert conversation to update last_interaction_timestamp
      // Upsert conversation to update last_interaction_timestamp
      const { data: existingConv } = await supabase
        .from('Conversation')
        .select('id')
        .eq('sender_number', senderNumber)
        .single();

      if (existingConv) {
        await supabase
          .from('Conversation')
          .update({ last_interaction_timestamp: new Date().toISOString() })
          .eq('sender_number', senderNumber);
      } else {
        await supabase
          .from('Conversation')
          .insert({ sender_number: senderNumber, last_interaction_timestamp: new Date().toISOString() });
      }

      // Insert incoming message
      await supabase
        .from('Message')
        .insert({
          id: crypto.randomUUID(),
          message_id: messageId,
          sender_number: senderNumber,
          direction: 'INBOUND',
          message_content: textContent || (mediaUrl ? '[Media]' : ''),
          media_url: mediaUrl,
          media_type: mediaType,
          timestamp: new Date().toISOString()
        });

      // --- AUTOMATED CHATBOT LOGIC ---
      if (textContent) {
        const autoReply = getAutomatedResponse(textContent);
        if (autoReply) {
          // Send the response immediately back to the user
          // Note: sendWhatsAppMessage already handles creating the 'OUTBOUND' DB record internally
          await sendWhatsAppMessage(senderNumber, autoReply);
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
