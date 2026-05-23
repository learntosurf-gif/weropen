import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// POST /api/reports
// Body: { businessId, vote, reporterToken }
// Submits one anonymous community report.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { businessId, vote, reporterToken } = body;

  if (!businessId || !['open', 'closed'].includes(vote)) {
    return NextResponse.json(
      { error: 'businessId and a valid vote (open|closed) are required' },
      { status: 400 }
    );
  }

  // Light rate limit: one report per token per business per hour.
  if (reporterToken) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('reporter_token', reporterToken)
      .gte('created_at', hourAgo);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: 'You already reported this business recently. Thanks!' },
        { status: 429 }
      );
    }
  }

  const { error } = await supabase
    .from('reports')
    .insert({ business_id: businessId, vote, reporter_token: reporterToken });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
