'use client';

import { useEffect, useState, useMemo } from 'react';
import { deriveStatus, labelFor, getReporterToken } from '@/lib/status';

const CATEGORIES = ['All', 'Grocery', 'Restaurant', 'Pharmacy', 'Gas Station', 'Coffee'];

export default function Home() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [tab, setTab] = useState('find');
  const [voted, setVoted] = useState({});
  const [toast, setToast] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/businesses');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setBusinesses(data.businesses);
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
      return matchQ && matchCat;
    });
  }, [businesses, query, category]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Header />
      <AlertBanner />

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
            {filtered.map((b) => (
              <BusinessCard key={b.id} business={b} voted={voted[b.id]} onVote={vote} />
            ))}
          </div>
          {!loading && filtered.length === 0 && (
            <p className="text-black/50 py-8 text-center">No businesses match your search.</p>
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

function AlertBanner() {
  return (
    <div className="bg-amber-300/70 rounded-lg px-4 py-2.5 flex items-center gap-2.5 mb-6">
      <span className="text-lg">❄️</span>
      <p className="text-sm text-amber-950">
        <strong>Ice Storm Warning — Austin, TX</strong>{' '}
        <span className="font-normal">
          Road conditions critical. Hours are affected. Reports below are community-sourced.
        </span>
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
  const { status, reason, source } = deriveStatus(business, business.reports || []);
  const total = (business.reports || []).length;

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

      <p className="text-xs text-black/60 mb-2">{reason}</p>

      {business.owner_note && source === 'owner' && (
        <div className="text-xs text-black/60 bg-black/[0.03] rounded-md px-2.5 py-1.5 mb-2">
          {business.owner_note}
        </div>
      )}

      {business.usual_hours && (
        <div className="text-xs text-black/50 mb-3">🕐 {business.usual_hours}</div>
      )}

      <div className="flex items-center justify-between border-t border-black/10 pt-2.5">
        <span className="text-xs text-black/50">
          {total} report{total !== 1 ? 's' : ''}
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
