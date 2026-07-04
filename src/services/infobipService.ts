import { supabase } from '@/lib/supabase';

const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL || 'w4pz8r.api.infobip.com';
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY || '5fc59d2ed3c46876ecd2914f4c4686af-b1ebcd6b-ce8e-47f5-b56f-340c9d041c4c';
const SYSTEM_NUMBER = process.env.SYSTEM_NUMBER || '15558835946';
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'hello_world';
const TEMPLATE_LANGUAGE = process.env.INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE || 'en';

async function sendInfobipRequest(endpoint: string, payload: any) {
  const url = `https://${INFOBIP_BASE_URL}${endpoint}`;
  
  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `App ${INFOBIP_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return { success: true, data };
      }

      if (response.status >= 500 && response.status < 600) {
        attempt++;
        if (attempt >= maxRetries) {
          // Log failed API call manually to DB
          await logFailedCall(payload, `Status: ${response.status} - ${JSON.stringify(data)}`);
          return { success: false, error: data, status: response.status };
        }
        // Wait before retry (exponential backoff could be added here)
        await new Promise(res => setTimeout(res, 1000 * attempt));
        continue;
      }
      
      // Client error (4xx) or other non-retriable error
      return { success: false, error: data, status: response.status };

    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        await logFailedCall(payload, error.message);
        return { success: false, error: error.message };
      }
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
}

async function logFailedCall(payload: any, errorMsg: string) {
  try {
    await supabase.from('FailedApiCall').insert({
      payload: JSON.stringify(payload),
      error: errorMsg,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log API call', err);
  }
}

export async function sendWhatsAppMessage(to: string, text: string) {
  // Check the conversation for 24-hour rule
  const { data: conversation } = await supabase
    .from('Conversation')
    .select('last_interaction_timestamp')
    .eq('sender_number', to)
    .single();

  const now = new Date();
  const isOutside24h = !conversation || (now.getTime() - new Date(conversation.last_interaction_timestamp).getTime()) > 24 * 60 * 60 * 1000;

  if (isOutside24h) {
    // Send a Template message instead
    return sendTemplateMessage(to, TEMPLATE_NAME);
  }

  const payload = {
    from: SYSTEM_NUMBER,
    to: to,
    content: {
      text: text
    }
  };

  const response = await sendInfobipRequest('/whatsapp/1/message/text', payload);
  if (response?.success) {
    // Optionally insert outbound message to database here or let webhook handle it
    const msgId = response.data?.messages?.[0]?.messageId;
    const crypto = require('crypto');
    await supabase.from('Message').insert({
      id: crypto.randomUUID(),
      message_id: msgId,
      sender_number: to,
      direction: 'OUTBOUND',
      message_content: text,
      timestamp: new Date().toISOString()
    });
  }

  return response;
}

export async function sendTemplateMessage(to: string, templateName: string, placeholders: string[] = []) {
  const payload = {
    messages: [
      {
        from: SYSTEM_NUMBER,
        to: to,
        content: {
          templateName: templateName,
          templateData: {
            body: {
              placeholders: placeholders
            }
          },
          language: TEMPLATE_LANGUAGE
        }
      }
    ]
  };

  const response = await sendInfobipRequest('/whatsapp/1/message/template', payload);
  if (response?.success) {
    const crypto = require('crypto');
    const msgId = response.data?.messages?.[0]?.messageId;
    await supabase.from('Message').insert({
      id: crypto.randomUUID(),
      message_id: msgId,
      sender_number: to,
      direction: 'OUTBOUND',
      message_content: `[Template: ${templateName}]`,
      timestamp: new Date().toISOString()
    });
  }

  return response;
}

export async function sendWhatsAppMedia(to: string, type: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, caption?: string) {
  const payload: any = {
    from: SYSTEM_NUMBER,
    to: to,
    content: { mediaUrl: mediaUrl }
  };
  
  if (caption) {
    payload.content.caption = caption;
  }

  const response = await sendInfobipRequest(`/whatsapp/1/message/${type}`, payload);
  
  if (response?.success) {
    const msgId = response.data?.messages?.[0]?.messageId;
    const crypto = require('crypto');
    await supabase.from('Message').insert({
      id: crypto.randomUUID(),
      message_id: msgId,
      sender_number: to,
      direction: 'OUTBOUND',
      message_content: caption || '[Media]',
      media_url: mediaUrl,
      media_type: type.toUpperCase(),
      timestamp: new Date().toISOString()
    });
  }
  return response;
}

export async function sendWhatsAppLocation(to: string, latitude: number, longitude: number, name?: string, address?: string) {
  const payload: any = {
    from: SYSTEM_NUMBER,
    to: to,
    content: { latitude, longitude }
  };
  
  if (name) payload.content.name = name;
  if (address) payload.content.address = address;

  const response = await sendInfobipRequest(`/whatsapp/1/message/location`, payload);
  
  if (response?.success) {
    const msgId = response.data?.messages?.[0]?.messageId;
    const crypto = require('crypto');
    await supabase.from('Message').insert({
      id: crypto.randomUUID(),
      message_id: msgId,
      sender_number: to,
      direction: 'OUTBOUND',
      message_content: `📍 Location: https://maps.google.com/?q=${latitude},${longitude} ${address ? `(${address})` : ''}`,
      timestamp: new Date().toISOString()
    });
  }
  return response;
}
