import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMedia } from '@/services/infobipService';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const to = formData.get('to') as string;
    const type = formData.get('type') as 'image' | 'video' | 'audio' | 'document';

    if (!file || !to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Ensure bucket exists
    await supabase.storage.createBucket('whatsapp_media', { public: true }).catch(() => {});

    // Generate unique filename preserving extension
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    const fileName = `outbound_${crypto.randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('whatsapp_media')
      .upload(fileName, buffer, { 
        contentType: file.type, 
        upsert: true 
      });

    if (uploadError) {
      throw new Error(`Supabase Upload Error: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from('whatsapp_media').getPublicUrl(fileName);
    const mediaUrl = data.publicUrl;

    // Dispatch to Infobip
    const response = await sendWhatsAppMedia(to, type, mediaUrl);

    if (response?.success) {
      return NextResponse.json({ success: true, mediaUrl });
    } else {
      return NextResponse.json({ error: 'Failed to send media to Infobip', details: response?.error }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Media upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
