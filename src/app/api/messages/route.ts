import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendWhatsAppMessage } from '@/services/infobipService';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversation');

    if (conversationId) {
      const messages = await prisma.message.findMany({
        where: { sender_number: conversationId },
        orderBy: { timestamp: 'asc' }
      });
      return NextResponse.json({ messages });
    }

    const conversations = await prisma.conversation.findMany({
      orderBy: { last_interaction_timestamp: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    return NextResponse.json({ conversations });

  } catch (error) {
    console.error('Failed to fetch messages', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, text } = body;

    if (!to || !text) {
      return NextResponse.json({ error: 'Missing "to" or "text"' }, { status: 400 });
    }

    const result = await sendWhatsAppMessage(to, text);
    
    if (result?.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result?.error || 'Failed to send' }, { status: 500 });
    }

  } catch (error) {
    console.error('Failed to send message', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
