import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// How the client IP is obtained on Vercel:
// Vercel sets x-forwarded-for to the real client IP (or a comma-separated
// list if behind additional proxies — we take the first entry).
async function getHashedIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const raw = forwarded.split(',')[0].trim() || 'unknown';
  if (raw === 'unknown') return 'unknown';
  // Hash the IP so we never store a raw address in the database.
  // 16 hex chars (64 bits) is enough to identify the same source for rate-limiting.
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate-limit thresholds — generous for real use, meaningful for spam.
// If real abuse appears and these need tightening, adjust here first before
// reaching for CAPTCHAs or account requirements (next-tier lever).
const LIMITS = {
  perTokenPerBusiness: 1,  // 1 report per browser token per business per hour (existing)
  perIpPerBusiness:    3,  // 3 reports per IP per business per hour (covers household re-votes)
  perIpGlobal:        20,  // 20 reports per IP per hour across all businesses (storm reporting)
};

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

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const hashedIp = await getHashedIp(request);

  // ── 1. Per-token per-business limit (existing) ───────────────────────────
  if (reporterToken) {
    const { count } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('reporter_token', reporterToken)
      .gte('created_at', hourAgo);

    if ((count || 0) >= LIMITS.perTokenPerBusiness) {
      return NextResponse.json(
        { error: 'You already reported this business recently. Thanks!' },
        { status: 429 }
      );
    }
  }

  // ── 2. Per-IP per-business limit (new) ───────────────────────────────────
  if (hashedIp !== 'unknown') {
    const { count: ipBizCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('reporter_ip', hashedIp)
      .gte('created_at', hourAgo);

    if ((ipBizCount || 0) >= LIMITS.perIpPerBusiness) {
      return NextResponse.json(
        { error: 'Too many reports for this business from your location. Try again in an hour!' },
        { status: 429 }
      );
    }

    // ── 3. Per-IP global limit (new) ─────────────────────────────────────
    const { count: ipGlobalCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_ip', hashedIp)
      .gte('created_at', hourAgo);

    if ((ipGlobalCount || 0) >= LIMITS.perIpGlobal) {
      return NextResponse.json(
        { error: "You've submitted a lot of reports recently — thanks! Try again in an hour." },
        { status: 429 }
      );
    }
  }

  // ── Insert the report ────────────────────────────────────────────────────
  const { error } = await supabase
    .from('reports')
    .insert({
      business_id:    businessId,
      vote,
      reporter_token: reporterToken,
      reporter_ip:    hashedIp,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
