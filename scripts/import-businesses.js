#!/usr/bin/env node
/**
 * scripts/import-businesses.js
 *
 * Pulls real Austin-area businesses from Google Places into the WeRopen
 * businesses table. DRY_RUN = true by default — shows a cost estimate and
 * stops without spending anything. Flip to false to actually fetch and insert.
 *
 * Run: node scripts/import-businesses.js
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════
// CONFIGURATION — edit these before each run
// ═══════════════════════════════════════════════════════════

const DRY_RUN = true; // ← flip to false when ready to actually insert

const MAX_PER_QUERY = 20; // results per zip+category (1–20; Google max per page)

const ZIP_CODES = [
  '78746', '78745', '78749', '78739', '78748',
];

// WeRopen category label → Google Places type
const CATEGORIES = {
  'Grocery':      'supermarket',
  'Pharmacy':     'pharmacy',
  'Gas Station':  'gas_station',
  'Restaurant':   'restaurant',
  'Coffee':       'cafe',
};

// ═══════════════════════════════════════════════════════════
// COST CONSTANTS  (Google Places API Text Search pricing)
// ═══════════════════════════════════════════════════════════

const COST_PER_REQUEST    = 0.032; // $32 per 1,000 requests
const FREE_MONTHLY_CREDIT = 200;   // Google's free $200/month credit

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function parseAddress(formatted) {
  // Typical format: "123 Main St, Austin, TX 78704, USA"
  const parts = formatted.split(',').map(s => s.trim());
  const street = parts[0] || '';
  let city = 'Austin', region = 'TX', zip = null;
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^([A-Z]{2})\s+(\d{5})/);
    if (m) { region = m[1]; zip = m[2]; city = parts[i - 1] || city; break; }
  }
  return { street, city, region, zip };
}

function displayName(placeName, street) {
  // Keep the full street address including the number so two locations on the
  // same road are distinguishable: "Chevron — 2901 Bee Caves Rd" vs "Chevron — 4701 Bee Caves Rd".
  return street ? `${placeName} — ${street}` : placeName;
}

function formatHours(opening_hours) {
  if (!opening_hours?.weekday_text?.length) return null;
  return opening_hours.weekday_text.join(' | ');
}

async function placesTextSearch(query, type, apiKey) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('type', type);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`);
  }
  return data.results || [];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const totalQueries    = ZIP_CODES.length * Object.keys(CATEGORIES).length;
  const maxResults      = totalQueries * MAX_PER_QUERY;
  const estimatedCost   = totalQueries * COST_PER_REQUEST;
  const creditRemaining = FREE_MONTHLY_CREDIT - estimatedCost;

  console.log('\n══════════════════════════════════════════════');
  console.log('  WeRopen — Business Import');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN  (no API calls, nothing charged)' : '🚀 LIVE RUN'}`);
  console.log('══════════════════════════════════════════════\n');

  console.log('CONFIGURATION');
  console.log(`  Zip codes   : ${ZIP_CODES.length}  (${ZIP_CODES[0]} … ${ZIP_CODES[ZIP_CODES.length - 1]})`);
  console.log(`  Categories  : ${Object.keys(CATEGORIES).join(', ')}`);
  console.log(`  Max/query   : ${MAX_PER_QUERY} results`);
  console.log('');
  console.log('COST ESTIMATE');
  console.log(`  API queries      : ${totalQueries}  (${ZIP_CODES.length} zips × ${Object.keys(CATEGORIES).length} categories)`);
  console.log(`  Max results      : up to ${maxResults.toLocaleString()} businesses`);
  console.log(`  Estimated cost   : $${estimatedCost.toFixed(2)}  (@ $32 per 1,000 requests)`);
  console.log(`  Monthly credit   : $${FREE_MONTHLY_CREDIT.toFixed(2)}  (Google free tier)`);
  console.log(`  Credit remaining : $${creditRemaining.toFixed(2)}  after this run`);
  console.log(`  % of credit used : ${((estimatedCost / FREE_MONTHLY_CREDIT) * 100).toFixed(1)}%`);
  console.log('');

  if (DRY_RUN) {
    console.log('✅ DRY RUN COMPLETE — nothing charged, nothing written.');
    console.log('');
    console.log('   When you are ready to run for real, tell Claude Code to');
    console.log('   flip DRY_RUN to false and run the script again.');
    console.log('');
    return;
  }

  // ── LIVE RUN ─────────────────────────────────────────────

  if (!GOOGLE_API_KEY) { console.error('❌ Missing GOOGLE_MAPS_API_KEY in .env.local'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase env vars in .env.local'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const toInsert = [];
  let apiCallsMade = 0;

  for (const zip of ZIP_CODES) {
    for (const [weropenCategory, googleType] of Object.entries(CATEGORIES)) {
      const query = `${googleType} in ${zip} Austin TX`;
      process.stdout.write(`  Searching ${zip} / ${weropenCategory}… `);
      try {
        const results = await placesTextSearch(query, googleType, GOOGLE_API_KEY);
        apiCallsMade++;
        const capped = results.slice(0, MAX_PER_QUERY);
        console.log(`${capped.length} results`);
        for (const place of capped) {
          const { street, city, region } = parseAddress(place.formatted_address || '');
          toInsert.push({
            name:        displayName(place.name, street),
            category:    weropenCategory,
            address:     street,
            city,
            region,
            zip_code:    zip,
            place_id:    place.place_id,
            usual_hours: formatHours(place.opening_hours),
          });
        }
      } catch (err) {
        console.log(`⚠️  ${err.message}`);
      }
      await sleep(200); // stay well under rate limits
    }
  }

  // Deduplicate by place_id — a business near a zip boundary can appear in
  // multiple zip searches; keeping one copy avoids a PostgreSQL upsert error.
  const seen = new Set();
  const deduped = toInsert.filter(b => {
    if (seen.has(b.place_id)) return false;
    seen.add(b.place_id);
    return true;
  });

  console.log(`\n  Found ${toInsert.length} businesses (${deduped.length} unique). Inserting…\n`);

  // Batch upsert — on place_id conflict, update name/hours; on name+address
  // conflict (manually-added row), skip gracefully.
  const BATCH_SIZE = 25;
  let inserted = 0;
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('businesses')
      .upsert(batch, { onConflict: 'place_id', ignoreDuplicates: false })
      .select('id');
    if (error) console.error(`  ⚠️  Batch error: ${error.message}`);
    else inserted += data?.length ?? 0;
  }

  const skipped = toInsert.length - inserted;
  const actualCost = (apiCallsMade * COST_PER_REQUEST).toFixed(2);

  console.log('══════════════════════════════════════════════');
  console.log('  IMPORT COMPLETE');
  console.log('══════════════════════════════════════════════');
  console.log(`  Businesses found   : ${toInsert.length}`);
  console.log(`  New rows inserted  : ${inserted}`);
  console.log(`  Duplicates skipped : ${skipped}`);
  console.log(`  API calls made     : ${apiCallsMade}`);
  console.log(`  Actual cost        : ~$${actualCost}`);
  console.log('');
  console.log('  ✅ Open https://weropen.vercel.app to see the new businesses.');
  console.log('  ℹ️  Hours shown are normal hours from Google — real-time changes');
  console.log('     come from owner updates and community reports on WeRopen.');
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
