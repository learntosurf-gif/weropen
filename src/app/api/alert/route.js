import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error || !alerts) {
    return NextResponse.json({ alert: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const now = new Date();
  const active = alerts.find(a => {
    const afterStart = !a.starts_at || new Date(a.starts_at) <= now;
    const beforeEnd  = !a.ends_at   || new Date(a.ends_at)   >= now;
    return afterStart && beforeEnd;
  }) || null;

  return NextResponse.json({ alert: active }, { headers: { 'Cache-Control': 'no-store' } });
}
