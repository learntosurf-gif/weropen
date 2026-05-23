import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/businesses
// Returns all businesses with their recent reports attached.
export async function GET() {
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .order('name');

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  // Only count reports from the last 24 hours — stale reports shouldn't
  // drive "is it open right now".
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: reports, error: repError } = await supabase
    .from('reports')
    .select('business_id, vote, created_at')
    .gte('created_at', since);

  if (repError) {
    return NextResponse.json({ error: repError.message }, { status: 500 });
  }

  const byBusiness = {};
  for (const r of reports || []) {
    (byBusiness[r.business_id] ||= []).push(r);
  }

  const withReports = businesses.map((b) => ({
    ...b,
    reports: byBusiness[b.id] || [],
  }));

  return NextResponse.json({ businesses: withReports });
}
