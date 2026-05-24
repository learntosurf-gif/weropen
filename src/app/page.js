'use client';

import { useEffect, useState, useMemo } from 'react';
import { deriveStatus, labelFor, timeAgo, getReporterToken } from '@/lib/status';

const CATEGORIES = ['All', 'Grocery', 'Restaurant', 'Pharmacy', 'Gas Station', 'Coffee'];
const PAGE_SIZE = 24;

export default function Home() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [zip, setZip] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('find');
  const [voted, setVoted] = useState({});
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const [bizRes, alertRes] = await Promise.all([
        fetch('/api/businesses'),
        fetch('/api/alert'),
      ]);
      const bizData = await bizRes.json();
      if (!bizRes.ok) throw new Error(bizData.error || 'Failed to load');
      setBusinesses(bizData.businesses);
      const alertData = await alertRes.json();
      setAlert(alertData.alert);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function vote(businessId, voteValue) {
    if (voted[businessId]) return;
    setVoted((v) => ({ ...v, [businessId]: voteValue }));
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          vote: voteValue,
          reporterToken: getReporterToken(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not submit report');
      } else {
        showToast(voteValue === 'open' ? 'Thanks! Reported as open.' : 'Thanks! Reported as closed.');
        load();
      }
    } catch {
      showToast('Network error — try again');
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return businesses.filter((b) => {
      const matchQ = !q || b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
      const matchCat = category === 'All' || b.category === category;
      const matchZip = !zip || b.zip_code === zip;
      return matchQ && matchCat && matchZip;
    });
  }, [businesses, query, category, zip]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [query, category, zip]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Header />
      <AlertBanner alert={alert} />

      <div className="flex gap-2 border-b border-black/10 mb-6">
        <TabButton active={tab === 'find'} onClick={() => setTab('find')}>
          Find a business
        </TabButton>
        <TabButton active={tab === 'owner'} onClick={() => setTab('owner')}>
          I own a business
        </TabButton>
      </div>

      {tab === 'find' ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <input
              className="flex-1 px-4 py-2.5 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              placeholder="Search businesses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <input
              className="w-full sm:w-32 px-4 py-2.5 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              placeholder="Zip code"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
            />
            <select
              className="px-4 py-2.5 rounded-lg border border-black/10 bg-white"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {loading && <p className="text-black/50 py-8 text-center">Loading nearby businesses…</p>}
          {error && (
            <p className="text-red-700 bg-red-50 rounded-lg p-4 text-sm">
              {error} — check your Supabase setup in SETUP.md.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {paginated.map((b) => (
              <BusinessCard key={b.id} business={b} voted={voted[b.id]} onVote={vote} />
            ))}
          </div>
          {!loading && filtered.length === 0 && (
            <p className="text-black/50 py-8 text-center">No businesses match your search.</p>
          )}
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0); }}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-black/10 text-sm text-black/60 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-black/50">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <button
                onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-black/10 text-sm text-black/60 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <OwnerPanel businesses={businesses} onUpdated={load} showToast={showToast} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--brand-dark)] text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function Header() {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[var(--brand)] flex items-center justify-center text-white text-xl">
          ⌂
        </div>
        <span className="display text-2xl font-bold tracking-tight">
          We<span className="text-[var(--brand)]">R</span>open
        </span>
      </div>
      <p className="text-sm text-black/55 mt-1">
        Real-time business status during storms, holidays &amp; closures
      </p>
    </div>
  );
}

function AlertBanner({ alert }) {
  if (!alert) return null;
  const isWarning = alert.type === 'warning';
  return (
    <div className={`${isWarning ? 'bg-amber-300/70' : 'bg-blue-100'} rounded-lg px-4 py-2.5 flex items-center gap-2.5 mb-6`}>
      <span className="text-lg">{alert.emoji || (isWarning ? '⚠️' : 'ℹ️')}</span>
      <p className={`text-sm ${isWarning ? 'text-amber-950' : 'text-blue-900'}`}>
        <strong>{alert.title}</strong>
        {alert.message && <span className="font-normal"> {alert.message}</span>}
      </p>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
        active
          ? 'border-[var(--brand)] text-[var(--brand)] font-semibold'
          : 'border-transparent text-black/55 hover:text-black'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const styles = {
    open: 'bg-green-100 text-green-800',
    closed: 'bg-red-100 text-red-800',
    uncertain: 'bg-amber-100 text-amber-800',
  };
  const dot = { open: 'bg-green-600', closed: 'bg-red-500', uncertain: 'bg-amber-500' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />
      {labelFor(status)}
    </span>
  );
}

function BusinessCard({ business, voted, onVote }) {
  const { status, reason, source, confidence, lastReportedAt, ownerIsStale, communityDisagrees, openVotes, closedVotes, total } =
    deriveStatus(business, business.reports || []);
  const ago = timeAgo(lastReportedAt);

  const confidenceLabel = {
    high:   { text: 'High confidence', color: 'text-green-700' },
    medium: { text: 'Medium confidence', color: 'text-amber-700' },
    low:    { text: 'Low confidence', color: 'text-black/40' },
    mixed:  { text: 'Mixed reports', color: 'text-amber-700' },
    none:   null,
  }[confidence];

  return (
    <div className="bg-white border border-black/10 rounded-xl p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-[15px] flex items-center gap-1.5">
            {business.name}
            {business.owner_verified && <span title="Owner verified" className="text-[var(--brand)] text-sm">✓</span>}
          </div>
          <div className="text-xs text-black/50 mt-0.5">{business.category}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Reason + recency */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-black/60">{reason}</p>
        {ago && <span className="text-[10px] text-black/35 ml-2 shrink-0">{ago}</span>}
      </div>

      {/* Confidence indicator */}
      {confidenceLabel && (
        <p className={`text-[10px] mb-2 ${confidenceLabel.color}`}>
          {confidenceLabel.text}
        </p>
      )}

      {/* Owner note */}
      {business.owner_note && source === 'owner' && (
        <div className="text-xs text-black/60 bg-black/[0.03] rounded-md px-2.5 py-1.5 mb-2">
          {business.owner_note}
        </div>
      )}

      {/* Owner staleness warning */}
      {communityDisagrees && (
        <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-2 text-amber-800">
          ⚠️ Owner update is older than 24 h — {total} recent report{total !== 1 ? 's' : ''} suggest{total === 1 ? 's' : ''}{' '}
          {openVotes > closedVotes ? 'open' : 'closed'}
        </div>
      )}

      {business.usual_hours && (
        <div className="text-xs text-black/50 mb-3">🕐 {business.usual_hours}</div>
      )}

      <div className="flex items-center justify-between border-t border-black/10 pt-2.5">
        <span className="text-xs text-black/50">
          {total} distinct report{total !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onVote(business.id, 'open')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              voted === 'open'
                ? 'bg-green-100 text-green-800 border-green-600 font-medium'
                : 'bg-black/[0.03] text-black/55 border-black/15 hover:bg-green-50 hover:text-green-800'
            }`}
          >
            Yes, open
          </button>
          <button
            onClick={() => onVote(business.id, 'closed')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              voted === 'closed'
                ? 'bg-red-100 text-red-800 border-red-500 font-medium'
                : 'bg-black/[0.03] text-black/55 border-black/15 hover:bg-red-50 hover:text-red-800'
            }`}
          >
            Still closed
          </button>
        </div>
      </div>
    </div>
  );
}

function OwnerPanel({ businesses, onUpdated, showToast }) {
  const [businessId, setBusinessId] = useState('');
  const [status, setStatus] = useState(null);
  const [reason, setReason] = useState('Ice storm / road conditions');
  const [note, setNote] = useState('');
  const [backToNormal, setBackToNormal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!businessId) return showToast('Select your business first.');
    if (!status) return showToast('Pick a status.');
    setSubmitting(true);
    try {
      const res = await fetch('/api/businesses/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status, reason, note, backToNormal }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Update failed');
      } else {
        showToast('Status updated! Customers can see it now.');
        setStatus(null);
        setNote('');
        setBackToNormal('');
        onUpdated();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const statusOpts = [
    { key: 'open', label: 'Open', emoji: '🟢' },
    { key: 'closed', label: 'Closed', emoji: '🔴' },
    { key: 'uncertain', label: 'Uncertain', emoji: '🟡' },
  ];

  return (
    <div className="bg-white border border-black/10 rounded-xl p-5">
      <h3 className="display text-lg font-bold mb-1">Update your business status</h3>
      <p className="text-sm text-black/55 mb-5">
        Let customers know in real time. Updates appear instantly on WeRopen.
      </p>

      <label className="block text-xs font-medium text-black/60 mb-1.5">Your business</label>
      <select
        className="w-full px-3 py-2.5 rounded-lg border border-black/10 bg-white mb-4 text-sm"
        value={businessId}
        onChange={(e) => setBusinessId(e.target.value)}
      >
        <option value="">Select…</option>
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <label className="block text-xs font-medium text-black/60 mb-1.5">Current status</label>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {statusOpts.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={`rounded-lg border py-2.5 text-center transition ${
              status === s.key ? 'border-[var(--brand)] bg-[var(--brand)]/10' : 'border-black/15 hover:border-black/30'
            }`}
          >
            <div className="text-lg">{s.emoji}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-black/60 mb-1.5">Reason</label>
          <select
            className="w-full px-3 py-2.5 rounded-lg border border-black/10 bg-white text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option>Ice storm / road conditions</option>
            <option>Holiday hours</option>
            <option>Staff shortage</option>
            <option>Power outage</option>
            <option>Flood / water damage</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-black/60 mb-1.5">Back to normal</label>
          <input
            className="w-full px-3 py-2.5 rounded-lg border border-black/10 bg-white text-sm"
            placeholder="e.g. Tomorrow @ 10am"
            value={backToNormal}
            onChange={(e) => setBackToNormal(e.target.value)}
          />
        </div>
      </div>

      <label className="block text-xs font-medium text-black/60 mb-1.5">Note for customers (optional)</label>
      <textarea
        className="w-full px-3 py-2.5 rounded-lg border border-black/10 bg-white text-sm min-h-[70px] mb-4"
        placeholder="e.g. Curbside pickup available. Call ahead to confirm orders."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-medium transition disabled:opacity-50"
      >
        {submitting ? 'Posting…' : 'Post status update'}
      </button>
    </div>
  );
}
