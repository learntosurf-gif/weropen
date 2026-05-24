// Derives the displayed status for a business by combining the owner's
// update (authoritative, if recent) with community reports (fallback).

export function deriveStatus(business, reports) {
  // Deduplicate by reporter_token — each token's most recent vote wins
  // (from Part 2: prevents flip-flop gaming).
  // Future enhancement: weight votes by "trusted reporter" status here.
  const latestByToken = new Map();
  for (const r of reports) {
    const key = r.reporter_token || `anon-${r.id}`;
    const existing = latestByToken.get(key);
    if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
      latestByToken.set(key, r);
    }
  }
  const deduped = Array.from(latestByToken.values());

  // Most recent report timestamp (for recency display).
  const lastReportedAt = deduped.length > 0
    ? new Date(Math.max(...deduped.map((r) => new Date(r.created_at).getTime())))
    : null;

  const openVotes   = deduped.filter((r) => r.vote === 'open').length;
  const closedVotes = deduped.filter((r) => r.vote === 'closed').length;
  const total = openVotes + closedVotes;

  // Confidence tier based on how many distinct reporters agree.
  function confidence(agreeing) {
    if (total === 0) return 'none';
    if (total === 1) return 'low';
    if (agreeing / total >= 0.75 && total >= 4) return 'high';
    return 'medium';
  }

  // ── Owner status ──────────────────────────────────────────────────────────
  if (business.owner_status) {
    const ownerAgeMs = business.owner_updated_at
      ? Date.now() - new Date(business.owner_updated_at).getTime()
      : Infinity;
    const ownerIsStale = ownerAgeMs > 24 * 60 * 60 * 1000; // older than 24 h

    // Surface disagreement when: owner update is stale AND 3+ fresh reports
    // majority-disagree with it. Shows both signals rather than hiding tension.
    const communityMajority = openVotes > closedVotes ? 'open'
      : closedVotes > openVotes ? 'closed' : null;
    const communityDisagrees =
      ownerIsStale &&
      total >= 3 &&
      communityMajority !== null &&
      communityMajority !== business.owner_status;

    return {
      status: business.owner_status,
      reason: business.owner_reason || labelFor(business.owner_status),
      source: 'owner',
      confidence: 'high',
      lastReportedAt,
      ownerIsStale,
      communityDisagrees,
      openVotes,
      closedVotes,
      total,
    };
  }

  // ── Community reports ─────────────────────────────────────────────────────
  if (total === 0) {
    return {
      status: 'uncertain',
      reason: 'No recent reports',
      source: 'none',
      confidence: 'none',
      lastReportedAt: null,
      ownerIsStale: false,
      communityDisagrees: false,
      openVotes: 0,
      closedVotes: 0,
      total: 0,
    };
  }

  if (openVotes > closedVotes) {
    const reason = total === 1 ? '1 person reported open' : `${openVotes} of ${total} say open`;
    return {
      status: 'open', reason, source: 'community',
      confidence: confidence(openVotes),
      lastReportedAt, ownerIsStale: false, communityDisagrees: false,
      openVotes, closedVotes, total,
    };
  }

  if (closedVotes > openVotes) {
    const reason = total === 1 ? '1 person reported closed' : `${closedVotes} of ${total} say closed`;
    return {
      status: 'closed', reason, source: 'community',
      confidence: confidence(closedVotes),
      lastReportedAt, ownerIsStale: false, communityDisagrees: false,
      openVotes, closedVotes, total,
    };
  }

  return {
    status: 'uncertain',
    reason: 'Reports are mixed — check back',
    source: 'community',
    confidence: 'mixed',
    lastReportedAt,
    ownerIsStale: false,
    communityDisagrees: false,
    openVotes,
    closedVotes,
    total,
  };
}

export function labelFor(status) {
  if (status === 'open') return 'Open';
  if (status === 'closed') return 'Closed';
  return 'Uncertain';
}

// Returns a human-readable "X min ago" string for a date.
export function timeAgo(date) {
  if (!date) return null;
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ago`;
}

// A stable-ish per-browser token used for light report de-duplication.
// Not security — just reduces obvious double-taps. Real abuse prevention
// lives in the IP-based rate limit on the server (reports/route.js).
export function getReporterToken() {
  if (typeof window === 'undefined') return null;
  let token = window.localStorage.getItem('weropen_token');
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem('weropen_token', token);
  }
  return token;
}
