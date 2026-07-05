import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { getAutomatedResponse, analyzeIntent } from '@/services/chatbotService';
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
                const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
                
                const extensionMap: Record<string, string> = {
                  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
                  'video/mp4': '.mp4', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3',
                  'application/pdf': '.pdf', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
                };
                const ext = extensionMap[contentType] || '';
                const fileName = `${crypto.randomUUID()}${ext}`;
                
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
        } else if (content.type === 'LOCATION') {
          textContent = `📍 Location: https://maps.google.com/?q=${content.latitude},${content.longitude} ${content.address ? `(${content.address})` : ''}`;
        } else if (content.type === 'CONTACT' || content.type === 'CONTACTS') {
          const contactName = content.contacts?.[0]?.name?.formattedName || content.contacts?.[0]?.name?.firstName || 'Contact';
          const contactPhone = content.contacts?.[0]?.phones?.[0]?.phone || 'Unknown number';
          textContent = `👤 Contact: ${contactName} (${contactPhone})`;
        } else {
          // Fallback for unknown types (so it doesn't result in an empty bubble)
          textContent = `[${content.type || 'Unknown'}]: ${JSON.stringify(content)}`;
        }
      } else if (msg.content?.text) {
        textContent = msg.content.text;
      }

      if (!senderNumber || !messageId) continue;

      // Extract Ad Attribution if present
      let adSource = null;
      if (msg.context?.referral?.headline) {
        adSource = `Ad: ${msg.context.referral.headline}`;
      } else if (msg.referral?.headline) {
        adSource = `Ad: ${msg.referral.headline}`;
      } else if (msg.context?.referral?.sourceUrl || msg.referral?.sourceUrl) {
        adSource = `Ad Link`;
      }

      // Upsert conversation to update last_interaction_timestamp and optionally ad_source
      const { data: existingConv } = await supabase
        .from('Conversation')
        .select('id, ad_source, last_interaction_timestamp, ai_active, contact_name, deal_value, active_flow')
        .eq('sender_number', senderNumber)
        .single();
        
      const oldLastInteraction = existingConv?.last_interaction_timestamp ? new Date(existingConv.last_interaction_timestamp) : new Date(0);
      const hoursSinceLastMessage = (new Date().getTime() - oldLastInteraction.getTime()) / (1000 * 60 * 60);

      if (existingConv) {
        const updatePayload: any = { last_interaction_timestamp: new Date().toISOString() };
        // Only update ad_source if we found a new one and it was previously empty
        if (adSource && !existingConv.ad_source) {
          updatePayload.ad_source = adSource;
        }
        await supabase
          .from('Conversation')
          .update(updatePayload)
          .eq('sender_number', senderNumber);
      } else {
        await supabase
          .from('Conversation')
          .insert({ 
            sender_number: senderNumber, 
            last_interaction_timestamp: new Date().toISOString(),
            ad_source: adSource
          });
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
        // Check if AI is active for this contact
        const aiActive = existingConv ? existingConv.ai_active !== false : true; // Default true
        
        if (aiActive) {
          // Check 24-hour window
          if (hoursSinceLastMessage > 24) {
            // Firing Meta-approved template because window was closed
            const templateMsg = `Hello ${existingConv?.contact_name || ''}, we saw you're back. Would you like to continue where we left off? Reply YES to resume.`;
            await sendWhatsAppMessage(senderNumber, templateMsg);
            
            // Mark as sent by Admin/System
            await supabase.from('Message').insert({
              id: crypto.randomUUID(),
              sender_number: senderNumber,
              direction: 'OUTBOUND',
              message_content: templateMsg,
              timestamp: new Date().toISOString(),
              status: 'SENT',
              sent_by: 'ADMIN' // Treat system template as ADMIN or SYSTEM
            });
          } else {
            // Window is open. Fetch last 5 messages for context
            const { data: historyData } = await supabase
              .from('Message')
              .select('direction, message_content')
              .eq('sender_number', senderNumber)
              .order('timestamp', { ascending: false })
              .limit(5);
              
            // Get bot's last message for context
            const lastBotMsg = historyData?.find(m => m.direction === 'OUTBOUND')?.message_content || null;
            
            // Reverse so they are chronological
            const history = (historyData || []).reverse();
            
            // 1. Analyze Intent
            const intent = await analyzeIntent(textContent, lastBotMsg);
            
            let currentFlow = existingConv?.active_flow;
            
            if (intent === 'OPT_OUT') {
              // Pause AI and acknowledge
              await supabase.from('Conversation').update({ ai_active: false }).eq('sender_number', senderNumber);
              const optOutMsg = "Understood. I will pause automated messages. Let me know if you need anything else.";
              await sendWhatsAppMessage(senderNumber, optOutMsg);
              await supabase.from('Message').insert({
                id: crypto.randomUUID(), sender_number: senderNumber, direction: 'OUTBOUND',
                message_content: optOutMsg, timestamp: new Date().toISOString(), status: 'SENT', sent_by: 'ADMIN'
              });
              continue; // Move to next message
            } else if (intent === 'PROPERTY_INQUIRY') {
              currentFlow = 'Property Inquiry Flow';
              await supabase.from('Conversation').update({ active_flow: currentFlow }).eq('sender_number', senderNumber);
            } else if (intent === 'TECH_SERVICES') {
              currentFlow = 'Tech Services Flow';
              await supabase.from('Conversation').update({ active_flow: currentFlow }).eq('sender_number', senderNumber);
            }
            
            // 2. Generate Contextual Response
            const autoReply = await getAutomatedResponse(
              textContent,
              history,
              {
                name: existingConv?.contact_name,
                dealValue: existingConv?.deal_value,
                activeFlow: currentFlow
              }
            );
            
            if (autoReply) {
              await sendWhatsAppMessage(senderNumber, autoReply);
              
              // Ensure we log the AI's response in the DB
              await supabase.from('Message').insert({
                id: crypto.randomUUID(),
                sender_number: senderNumber,
                direction: 'OUTBOUND',
                message_content: autoReply,
                timestamp: new Date().toISOString(),
                status: 'SENT',
                sent_by: 'AI'
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
