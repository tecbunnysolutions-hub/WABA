import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { sender_number, contact_name, status, tags, notes, assigned_to, department } = body;

    if (!sender_number) {
      return NextResponse.json({ error: 'Missing sender_number' }, { status: 400 });
    }

    // Build the update object dynamically
    const updateData: any = {};
    if (contact_name !== undefined) updateData.contact_name = contact_name;
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (department !== undefined) updateData.department = department;

    const { data, error } = await supabase
      .from('Conversation')
      .update(updateData)
      .eq('sender_number', sender_number)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, conversation: data });
  } catch (error) {
    console.error('Failed to update conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
