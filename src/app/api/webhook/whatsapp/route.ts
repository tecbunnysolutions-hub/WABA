import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getAutomatedResponse } from '@/services/chatbotService';
import { sendWhatsAppMessage } from '@/services/infobipService';

const prisma = new PrismaClient();
const INFOBIP_HMAC_SECRET = process.env.INFOBIP_HMAC_SECRET || '';

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
      const senderNumber = msg.from;
      const messageId = msg.messageId;
      const textContent = msg.message?.text || '';

      if (!senderNumber || !messageId) continue;

      // Upsert conversation to update last_interaction_timestamp
      await prisma.conversation.upsert({
        where: { sender_number: senderNumber },
        update: { last_interaction_timestamp: new Date() },
        create: { sender_number: senderNumber }
      });

      // Insert incoming message
      await prisma.message.create({
        data: {
          message_id: messageId,
          sender_number: senderNumber,
          direction: 'INBOUND',
          message_content: textContent
        }
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
