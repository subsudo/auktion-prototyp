// Bietlogik als reine Funktionen, ohne DOM und ohne Systemzeit. Vorlage für die spätere PHP-Domain-Klasse.
// Alle Beträge in Rappen, alle Zeiten in Millisekunden.
(function (root) {
  const SOFT_CLOSE_MS = 5 * 60 * 1000;

  function createLot({ start, inc, buyNow = null, endsAt }) {
    return { start, inc, buyNow, endsAt, originalEndsAt: endsAt, sold: false, entries: [], log: [], keys: [] };
  }

  // Aktuelles Maximum pro Person, höchstes zuerst, bei Gleichstand das frühere.
  function standings(lot) {
    const current = new Map();
    for (const e of lot.entries) if (!e.cancelled) current.set(e.bidder, e);
    return [...current.values()].sort((a, b) => b.max - a.max || a.at - b.at);
  }

  function compute(lot) {
    if (lot.sold) return { price: lot.buyNow, leader: lot.soldTo };
    const s = standings(lot);
    if (s.length === 0) return { price: lot.start, leader: null };
    if (s.length === 1) return { price: lot.start, leader: s[0].bidder };
    return { price: Math.min(s[0].max, s[1].max + lot.inc), leader: s[0].bidder };
  }

  function ownMax(lot, bidder) {
    const own = standings(lot).find((e) => e.bidder === bidder);
    return own ? own.max : null;
  }

  function minBid(lot, bidder) {
    const { price, leader } = compute(lot);
    if (leader === null) return lot.start;
    if (leader === bidder) return Math.max(price + lot.inc, ownMax(lot, bidder) + 100);
    return price + lot.inc;
  }

  function isOpen(lot, now) {
    return !lot.sold && now < lot.endsAt;
  }

  function buyNowAvailable(lot, now) {
    return lot.buyNow !== null && isOpen(lot, now) && compute(lot).price < lot.buyNow;
  }

  function place(lot, bidder, amount, now, key) {
    if (key && lot.keys.includes(key)) return { ok: true, duplicate: true, outcome: 'duplicate' };
    if (!isOpen(lot, now)) return { ok: false, code: 'closed' };
    if (!Number.isInteger(amount) || amount % 100 !== 0) return { ok: false, code: 'not_whole' };
    if (lot.buyNow !== null && amount >= lot.buyNow && buyNowAvailable(lot, now)) return buyNow(lot, bidder, now, key);
    const min = minBid(lot, bidder);
    if (amount < min) return { ok: false, code: 'too_low', min, price: compute(lot).price };

    const before = compute(lot);
    const previousMax = before.leader === null ? null : ownMax(lot, before.leader);
    lot.entries.push({ bidder, max: amount, at: now });
    if (key) lot.keys.push(key);
    const after = compute(lot);

    let outcome;
    if (before.leader === bidder) {
      outcome = 'raised';
    } else if (after.leader === bidder) {
      outcome = 'leading';
      if (before.leader !== null && previousMax > before.price) {
        lot.log.push({ bidder: before.leader, amount: previousMax, kind: 'proxy', at: now });
      }
      lot.log.push({ bidder, amount: after.price, kind: 'manual', at: now });
    } else {
      outcome = 'outbid';
      lot.log.push({ bidder, amount, kind: 'manual', at: now });
      lot.log.push({ bidder: after.leader, amount: after.price, kind: 'proxy', at: now });
    }

    const changed = before.price !== after.price || before.leader !== after.leader;
    let extended = false;
    if (changed && lot.endsAt - now < SOFT_CLOSE_MS) {
      lot.endsAt = now + SOFT_CLOSE_MS;
      extended = true;
    }
    return { ok: true, outcome, extended, price: after.price, leader: after.leader };
  }

  function buyNow(lot, bidder, now, key) {
    if (!buyNowAvailable(lot, now)) return { ok: false, code: 'no_buy_now' };
    if (key) lot.keys.push(key);
    lot.sold = true;
    lot.soldTo = bidder;
    lot.log.push({ bidder, amount: lot.buyNow, kind: 'buy_now', at: now });
    return { ok: true, outcome: 'bought', price: lot.buyNow, leader: bidder };
  }

  // Storno: Der Eintrag fällt weg, der Zustand folgt aus den übrigen Einträgen. Das Ende bleibt unverändert.
  function cancelEntry(lot, entry, reason, now) {
    entry.cancelled = true;
    entry.cancelledReason = reason;
    for (const row of lot.log) if (row.at >= entry.at) row.cancelled = true;
    const state = compute(lot);
    if (state.leader !== null) lot.log.push({ bidder: state.leader, amount: state.price, kind: 'recalc', at: now });
    return state;
  }

  function pseudonym(lot, bidder) {
    const order = [...new Set([...lot.entries.map((e) => e.bidder), ...lot.log.map((r) => r.bidder)])];
    return 'Bieter ' + (order.indexOf(bidder) + 1);
  }

  const api = { SOFT_CLOSE_MS, createLot, standings, compute, ownMax, minBid, isOpen, buyNowAvailable, place, buyNow, cancelEntry, pseudonym };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bidding = api;
})(typeof window !== 'undefined' ? window : globalThis);
