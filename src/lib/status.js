// Derives the displayed status for a business by combining the owner's
// update (authoritative, if recent) with community reports (fallback).

export function deriveStatus(business, reports) {
  // If an owner posted a status, that wins.
  if (business.owner_status) {
    return {
      status: business.owner_status,
      reason: business.owner_reason || labelFor(business.owner_status),
      source: 'owner',
    };
  }

  // Otherwise, infer from community reports.
  const openVotes = reports.filter((r) => r.vote === 'open').length;
  const closedVotes = reports.filter((r) => r.vote === 'closed').length;
  const total = openVotes + closedVotes;

  if (total === 0) {
    return { status: 'uncertain', reason: 'No reports yet', source: 'none' };
  }
  if (openVotes > closedVotes) {
    return { status: 'open', reason: `${openVotes} of ${total} say open`, source: 'community' };
  }
  if (closedVotes > openVotes) {
    return { status: 'closed', reason: `${closedVotes} of ${total} say closed`, source: 'community' };
  }
  return { status: 'uncertain', reason: 'Reports are mixed', source: 'community' };
}

export function labelFor(status) {
  if (status === 'open') return 'Open';
  if (status === 'closed') return 'Closed';
  return 'Uncertain';
}

// A stable-ish per-browser token used for light report de-duplication.
// Not security — just reduces obvious double-taps. Real abuse prevention
// comes with auth later.
export function getReporterToken() {
  if (typeof window === 'undefined') return null;
  let token = window.localStorage.getItem('weropen_token');
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem('weropen_token', token);
  }
  return token;
}
