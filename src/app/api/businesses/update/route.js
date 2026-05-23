import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// POST /api/businesses/update
// Body: { businessId, status, reason, note, backToNormal }
// Lets an owner post/refresh their authoritative status.
// NOTE: v1 has no auth, so this trusts the caller. When you add auth,
// verify the user owns this business before allowing the update.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { businessId, status, reason, note, backToNormal } = body;

  if (!businessId || !['open', 'closed', 'uncertain'].includes(status)) {
    return NextResponse.json(
      { error: 'businessId and a valid status (open|closed|uncertain) are required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      owner_status: status,
      owner_reason: reason || null,
      owner_note: note || null,
      owner_back_to_normal: backToNormal || null,
      owner_updated_at: new Date().toISOString(),
    })
    .eq('id', businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
