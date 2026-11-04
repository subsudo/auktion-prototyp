// Klickbarer Prototyp: alles läuft im Browser, Gebote bleiben auf diesem Gerät.
(function () {
  const B = window.Bidding;
  const WERKE = window.WERKE;
  const MIN = 60000;
  const ME = 'me';
  const STORE = 'auktion-prototyp-v20';
  const AUCTION_END = Date.UTC(2027, 5, 20, 16, 0, 0); // 20. Juni 2027, 18:00 in Luzern, für alle Bilder gleich
  const byId = new Map(WERKE.map((w) => [w.id, w]));
  const WERKE_BASE = JSON.parse(JSON.stringify(WERKE));
  const CAT_DEFAULT = { perPage: 4, kind: 'all', order: 'harmony', cover: true, heading: 'Kopfstillstand', subheading: 'Benedikt Notter. Kornschütte Luzern, 3. bis 20. Juni 2027', number: true, title: true, size: true, technique: false, start: true, buy: true, qr: true, pages: true, cellBox: true };
  const QR_DEFAULT = { size: 3, perPage: 12, kind: 'all', from: 1, to: WERKE.length, number: true, title: true, hint: true, image: false, cut: true, marks: true };

  const TYPE = { original: 'Originalzeichnung', original_framed: 'Gerahmte Bleistiftzeichnung', print_aluminium: 'Druck auf Aluminium' };
  const NAMES = { r1: 'Anna Keller', r2: 'Marco Frei', r3: 'Lea Wyss', r4: 'Thomas Bühler', r5: 'Sandra Roth', r6: 'Nina Graf', r7: 'Jonas Meier', r8: 'Claudia Huber', r9: 'Reto Amrein', r10: 'Mirjam Steiner', r11: 'David Bucher', r12: 'Eva Zemp', r13: 'Luca Moser', r14: 'Regula Felder' };
  const FORMATS = ['Klein', 'Mittel', 'Gross'];
  const FAMILY = { Rot: '#b8312f', Orange: '#e07b1f', Gelb: '#e8c82e', Grün: '#5c9a4a', Türkis: '#2f9a8c', Blau: '#2d6f9f', Violett: '#7d4a9c', Pink: '#d8437f', Grau: '#8b8b85' };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chf = (r) => 'CHF ' + Math.round(r / 100).toLocaleString('de-CH');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clock = (t) => new Date(t).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cm = (value) => String(Math.round(value * 10) / 10).replace('.', ',');
  const sizeText = (w) => (w.sizeCm[0] > 0 && w.sizeCm[1] > 0 ? `${cm(w.sizeCm[0])} × ${cm(w.sizeCm[1])} cm` : 'Masse fehlen');

  /* ---------- Zustand ---------- */

  function seed() {
    const now = Date.now();
    const lots = {};
    for (const w of WERKE) {
      if (w.mode !== 'auction') continue;
      const lot = B.createLot({ start: w.start * 100, inc: w.inc * 100, buyNow: w.buyNow * 100, endsAt: AUCTION_END });
      for (const [who, max, ago] of w.seedBids) {
        const r = B.place(lot, who, max * 100, now - ago * MIN - 10000);
        if (!r.ok) console.warn('Beispielgebot abgelehnt', w.title, who, r);
      }
      if (w.boughtBy) B.buyNow(lot, w.boughtBy, now - 45 * MIN);
      lots[w.id] = lot;
    }
    // Beispielzahlen für das Atelier: Aufrufe insgesamt und davon per QR-Code vor Ort
    const views = {};
    for (const w of WERKE) {
      const total = 4 + (w.id * 13) % 34 + (lots[w.id] ? lots[w.id].log.length * 6 : 0);
      views[w.id] = { total, qr: Math.round(total * (0.2 + (w.id % 4) * 0.1)) };
    }
    // Zum Vorzeigen: Ein paar Bilder ohne Gebote sind noch nicht fertig erfasst
    const gaps = [{ title: '' }, { start: null, buyNow: null }, { sizeCm: [0, 0] }, { technique: '' }, { buyNow: null }, { title: '', start: null, buyNow: null }, { sizeCm: [0, 0], start: null }, { inc: null }, { technique: '', buyNow: null }];
    const heroes = ['bilder/047.jpg', 'bilder/013.jpg', 'bilder/004.jpg'];
    const drafts = WERKE.filter((w) => w.mode === 'auction' && !w.seedBids.length && !w.boughtBy && !heroes.includes(w.img)).filter((_, i) => i % 17 === 3).slice(0, gaps.length);
    const edits = {};
    drafts.forEach((w, i) => { edits[w.id] = gaps[i]; });
    return { lots, me: null, edits, qr: { ...QR_DEFAULT }, cat: { ...CAT_DEFAULT }, views, scans: [], frames: {}, favs: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ohne Speicher läuft die Demo trotzdem */ }
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* siehe load */ }
  }

  let S = load();
  // Im Cockpit gespeicherte Änderungen über die Beispieldaten legen
  function applyEdits() {
    for (const [id, edit] of Object.entries(S.edits || {})) Object.assign(byId.get(Number(id)), edit);
  }
  applyEdits();
  function resetState() {
    WERKE_BASE.forEach((base) => {
      const w = byId.get(base.id);
      Object.keys(w).forEach((k) => delete w[k]);
      Object.assign(w, JSON.parse(JSON.stringify(base)));
    });
    S = seed();
    applyEdits();
  }
  const lotOf = (w) => S.lots[w.id];
  const filter = { type: null, format: null, family: null, sort: 'harmony' };
  let filtersOpen = false;

  /* ---------- Ableitungen ---------- */

  function statusOf(lot, now = Date.now()) {
    if (lot.sold) return { label: 'Verkauft', cls: 'sold' };
    if (now >= lot.endsAt) return B.compute(lot).leader ? { label: 'Verkauft', cls: 'sold' } : { label: 'Beendet', cls: 'neutral' };
    if (lot.endsAt > lot.originalEndsAt) return { label: 'Verlängert', cls: 'alert' };
    if (lot.endsAt - now < 60 * MIN) return { label: 'Endet bald', cls: 'alert' };
    return { label: 'Läuft', cls: '' };
  }

  function formatLeft(ms) {
    if (ms <= 0) return 'Beendet';
    const s = Math.ceil(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const pad = (n) => String(n).padStart(2, '0');
    if (d > 0) return `${d} ${d === 1 ? 'Tag' : 'Tage'} ${h} Std.`;
    if (h > 0) return `${h}:${pad(m)}:${pad(s % 60)}`;
    return `${pad(m)}:${pad(s % 60)}`;
  }

  const bidCount = (lot) => lot.log.filter((r) => !r.cancelled && r.kind !== 'recalc').length;
  // Wer eingeloggt ist, sieht sich immer als «Du». Alle anderen sind pro Bild durchnummeriert («Bieter 3»):
  // Die Nummer gilt nur für dieses Bild, so lässt sich niemand über mehrere Bilder hinweg verfolgen.
  const whoLabel = (lot, bidder) => (bidder === ME ? 'Du' : B.pseudonym(lot, bidder));
  const lastActivity = (lot) => Math.max(0, ...lot.log.map((r) => r.at));

  // Für alle sichtbar: verkauft per Sofortkauf oder am Auktionsende
  function soldPrice(w) {
    if (w.mode !== 'auction') return null;
    const lot = lotOf(w);
    const { price, leader } = B.compute(lot);
    return lot.sold || (Date.now() >= lot.endsAt && leader) ? price : null;
  }
  const isSold = (w) => soldPrice(w) !== null;

  function priceLine(w) {
    if (isSold(w)) return `<span class="sold-mark">Verkauft</span> · ${chf(soldPrice(w))}`;
    if (w.mode === 'not_for_sale') return 'Nur zum Anschauen';
    const lot = lotOf(w);
    const { price } = B.compute(lot);
    const n = bidCount(lot);
    if (Date.now() >= lot.endsAt) return `<span class="tile-price">${chf(price)}</span> · beendet`;
    const line = `<span class="tile-price">${chf(price)}</span> · ${n === 0 ? 'Startpreis' : n === 1 ? '1 Gebot' : n + ' Gebote'}`;
    return B.buyNowAvailable(lot, Date.now()) ? `${line}<br><span class="tile-buy">Sofort ${chf(lot.buyNow)}</span>` : line;
  }

  const landscape = (w) => w.sizeCm[1] > w.sizeCm[0];
  // Ähnliches Format: Bis 1 cm Abweichung sieht man von Auge kaum
  const sameSize = (a, b) => Math.abs(a.sizeCm[0] - b.sizeCm[0]) <= 1 && Math.abs(a.sizeCm[1] - b.sizeCm[1]) <= 1;
  const available = (w) => !isSold(w) && w.mode === 'auction' && B.isOpen(lotOf(w), Date.now());

  /* ---------- Was passt zusammen: vorberechneter Prozent-Match ---------- */

  // Bildtafeln sind nach Farbe verglichen, Zeichnungen nach Thema und Bildaufbau (werkzeuge/build_catalog.py)
  const matchGroup = (w) => (w.type === 'print_aluminium' ? 'color' : 'pencil');
  const matchIndex = {};
  for (const [group, table] of Object.entries(window.MATCHES)) matchIndex[group] = new Map(table.ids.map((id, i) => [id, i]));
  function matchPct(a, b) {
    const group = matchGroup(a);
    if (group !== matchGroup(b)) return 0;
    return window.MATCHES[group].rows[matchIndex[group].get(a.id)][matchIndex[group].get(b.id)];
  }
  // Für Vorschläge zählt bei Bildtafeln der Farbmix: harmonisch, aber nicht derselbe Ton
  function suggestPct(a, b) {
    const table = window.MATCHES[matchGroup(a)];
    const index = matchIndex[matchGroup(a)];
    return (table.mix || table.rows)[index.get(a.id)][index.get(b.id)];
  }

  // Mit ?match=1 in der Adresse zeigt der Prototyp die Prozente, damit man die Vorschläge beurteilen kann
  const showMatch = new URLSearchParams(location.search).has('match');
  const matchNote = (a, b) => (showMatch ? ` · ${suggestPct(a, b)} %` : '');

  const suggestState = { work: null, count: 4 };

  // Vorschläge lassen sich laufend erweitern, bis alle Bilder gezeigt sind
  function suggestionsHtml(w) {
    if (suggestState.work !== w.id) Object.assign(suggestState, { work: w.id, count: 4 });
    const total = WERKE.filter((x) => isShown(x) && x.id !== w.id && matchGroup(x) === matchGroup(w)).length;
    return `${masonry(suggestions(w, suggestState.count), (x) => `${sameSize(w, x) ? 'Ähnliches Format, ' : ''}${sizeText(x)}${matchNote(w, x)}`)}
      ${suggestState.count < total ? `<button type="button" class="btn ghost suggest-more" data-act="suggest-more" data-work="${w.id}">Weitere Vorschläge</button>` : ''}`;
  }

  // Der Reihe nach das Beste wählen und dabei Wiederholungen bestrafen: So mischen sich Farben, Themen und Formate.
  function suggestions(w, count = 4) {
    const rest = WERKE.filter((x) => isShown(x) && x.id !== w.id && matchGroup(x) === matchGroup(w));
    const chosen = [];
    while (chosen.length < count && rest.length) {
      let best = 0, bestScore = -Infinity;
      rest.forEach((x, i) => {
        const repeats = chosen.length ? Math.max(...chosen.map((c) => matchPct(c, x))) : 0;
        const sameFormat = chosen.filter((c) => sameSize(c, x)).length;
        const score = suggestPct(w, x) + (available(x) ? 5 : -30) - 0.35 * repeats - 7 * sameFormat - (sameSize(w, x) ? 3 : 0);
        if (score > bestScore) { bestScore = score; best = i; }
      });
      chosen.push(rest.splice(best, 1)[0]);
    }
    return chosen;
  }


  /* ---------- Bausteine ---------- */

  // Originale gibt es nur einmal, das soll man sofort sehen
  const isOriginal = (w) => w.type === 'original' || w.type === 'original_framed';
  // Was fehlt noch? Erst wenn nichts mehr fehlt, erscheint ein Bild öffentlich.
  function missingFields(w) {
    const list = [];
    if (!String(w.title || '').trim()) list.push('Name');
    if (!(w.sizeCm[0] > 0 && w.sizeCm[1] > 0)) list.push('Masse');
    if (!String(w.technique || '').trim()) list.push('Technik');
    if (w.mode === 'auction') {
      if (!(w.start > 0)) list.push('Startpreis');
      if (!(w.buyNow > 0)) list.push('Sofortpreis');
      if (!(w.inc > 0)) list.push('Bietschritt');
    }
    return list;
  }
  const isShown = (w) => !w.hidden && !missingFields(w).length;
  // Eigene Hülle für Zeichnungen, damit Rahmen, Passepartout und Schnittkante einzeln gestaltet werden können
  const MAT_CM = 5, FRAME_CM = 1.7;
  const matCm = (w) => (w.matCm === undefined ? MAT_CM : w.matCm);
  const frameCm = (w) => (w.frameCm === undefined ? FRAME_CM : w.frameCm);
  // Rahmen und Passepartout im echten Verhältnis zur Zeichnung: Prozente beziehen sich auf die jeweilige Gesamtbreite
  function artStyle(w) {
    const width = w.sizeCm[1], mat = matCm(w), frame = frameCm(w);
    const framed = width + 2 * mat + 2 * frame, matted = width + 2 * mat;
    const pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;
    return `--frame-p:${pct(frame, framed)};--mat-p:${pct(mat, matted)}`;
  }
  const art = (w, img) => (isOriginal(w) ? `<span class="art" style="${artStyle(w)}"><span class="art-mat"><span class="art-window">${img}</span></span></span>` : img);
  const uniqueLabel = (w) => `${TYPE[w.type]}, Einzelstück`;

  // Rahmen sind weiss oder aus hellem Holz, immer mit Passepartout
  const FRAMES = {
    none: { label: 'Ohne', add: 0, cls: '' },
    mat: { label: 'Passepartout', add: 40, cls: ' mat' },
    white: { label: 'Weisser Rahmen', add: 100, cls: ' framed' },
    wood: { label: 'Holzrahmen', add: 100, cls: ' framed wood' },
  };
  const frameOf = (w) => FRAMES[S.frames[w.id]] || FRAMES.none;
  const frameClass = (w) => {
    if (w.type === 'original_framed') return ` framed${w.id % 2 ? ' wood' : ''}`;
    return w.type === 'original' ? frameOf(w).cls : '';
  };

  function frameOptions(w) {
    if (w.type !== 'original' || !available(w)) return '';
    const current = S.frames[w.id] || 'none';
    return `<div class="frame-options">
      <h3>Passepartout oder Rahmen dazu?</h3>
      <div class="frame-pick">
        <div class="frame-mini${frameClass(w)}" id="frame-mini" aria-hidden="true">${art(w, `<img src="${w.img}" alt="" width="${w.w}" height="${w.h}" loading="lazy">`)}</div>
        <div class="chips">${Object.entries(FRAMES).map(([key, f]) => `<button type="button" class="chip" data-act="frame" data-work="${w.id}" data-frame="${key}" aria-pressed="${key === current}">${f.label}${f.add ? ` <small>+${chf(f.add * 100)}</small>` : ''}</button>`).join('')}</div>
      </div>
      <p class="note frame-note">Beide Rahmen enthalten das Passepartout, der Preis gilt also für alles zusammen. Probier hier aus, wie es aussehen würde. Der Aufpreis gehört nicht zum Gebot und kommt erst dazu, wenn du dich dafür entscheidest. Wählen kannst du nach der Auktion.</p>
    </div>`;
  }

  // Verkaufte Bildtafeln gibt es weiterhin als Nachdruck, ausserhalb der Auktion
  function soldNote(w) {
    if (!isSold(w)) return '';
    if (w.type !== 'print_aluminium') return '<p class="sold-note">Diese Originalzeichnung gibt es nur einmal. Sie hat ein neues Zuhause gefunden.</p>';
    return `<p class="sold-note"><strong>Verkauft, aber nicht verloren:</strong> Auf Wunsch bekommst du dieses Bild als Nachdruck. Der gehört nicht mehr zur Auktion, es gelten die <a href="https://benediktnotter.ch/bilder-kaufen" target="_blank" rel="noopener">offiziellen Preise auf der Webseite</a>.</p>`;
  }

  // Wie die Bildtafel gemacht ist: gross auf der Startseite, klein am Schluss der Bildseite
  const CRAFT_FRONT = 'Lichtechter Pigmentdruck auf hochwertigem Hahnemühlepapier, aufgezogen auf eine Aluminiumplatte.';
  const CRAFT_BACK = 'Auf der Rückseite sind zwei Aufhängeschienen befestigt. Damit steht die Tafel leicht von der Wand ab.';

  // Zeichnung und Bildtafel gehören zusammen, wenn der Titel gleich ist. Gross- und Kleinschreibung, Leerzeichen und Satzzeichen zählen nicht.
  const titleKey = (title) => String(title || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  function siblingOf(w) {
    const key = titleKey(w.title);
    if (!key) return null;
    const isPrint = w.type === 'print_aluminium';
    return WERKE.find((x) => x.id !== w.id && isShown(x) && (x.type === 'print_aluminium') !== isPrint && titleKey(x.title) === key) || null;
  }

  const SIBLING_LABEL = { original: 'Originalzeichnung', original_framed: 'gerahmte Bleistiftzeichnung', print_aluminium: 'Bildtafel' };

  function siblingLink(w) {
    const x = siblingOf(w);
    return x ? `<p class="sibling"><a href="#/werk/${x.slug}">Dieses Motiv gibt es auch als ${SIBLING_LABEL[x.type]}</a></p>` : '';
  }

  function craftHome() {
    return `<section class="craft">
      <h2>So sind die Bildtafeln gemacht</h2>
      <div class="craft-grid">
        <figure><img src="bilder/machart-vorne.jpg?v=2" alt="Bildtafel in der Hand, von vorne" loading="lazy"><figcaption>${CRAFT_FRONT}</figcaption></figure>
        <figure><img src="bilder/machart-rueckseite.jpg?v=2" alt="Rückseite der Bildtafel mit zwei Aufhängeschienen" loading="lazy"><figcaption>${CRAFT_BACK}</figcaption></figure>
      </div>
    </section>`;
  }

  function craftSection(w) {
    if (w.type !== 'print_aluminium') return '';
    return `<section class="craft-small">
      <img src="bilder/machart-vorne.jpg?v=2" alt="" loading="lazy">
      <img src="bilder/machart-rueckseite.jpg?v=2" alt="" loading="lazy">
      <p><strong>So ist die Bildtafel gemacht.</strong> ${CRAFT_FRONT} ${CRAFT_BACK}</p>
    </section>`;
  }

  // Gleichstand: Jemand anderes führt, und der Preis entspricht genau dem eigenen Gebot.
  // Das heisst immer: gleich hohes Maximum, die andere Person hat den Betrag früher erreicht.
  const isTied = (lot) => {
    const { price, leader } = B.compute(lot);
    return leader !== null && leader !== ME && B.ownMax(lot, ME) === price;
  };

  // Hat das eigene Maximum zuletzt automatisch auf ein fremdes Gebot reagiert? Dann soll man das sehen und den höheren Preis verstehen.
  function autoRaise(lot) {
    const rows = lot.log.filter((r) => !r.cancelled && r.kind !== 'recalc');
    const last = rows[rows.length - 1];
    const rival = rows[rows.length - 2];
    if (!last || !rival || last.kind !== 'proxy' || last.bidder !== ME || rival.bidder === ME || B.compute(lot).leader !== ME) return null;
    return { rival, price: last.amount, max: B.ownMax(lot, ME) };
  }

  function myTag(w) {
    if (w.mode !== 'auction' || B.ownMax(lotOf(w), ME) === null || !B.isOpen(lotOf(w), Date.now())) return '';
    return B.compute(lotOf(w)).leader === ME ? '<span class="my-tag lead">Du führst</span>' : (isTied(lotOf(w)) ? '<span class="my-tag lost">Gleich hoch</span>' : '<span class="my-tag lost">Überboten</span>');
  }

  /* ---------- Favoriten ---------- */

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.6-4.7-9.7-9.3C.9 8 3 4.7 6.4 4.7c2.2 0 3.9 1.2 5.6 3.4 1.7-2.2 3.4-3.4 5.6-3.4 3.4 0 5.5 3.3 4.1 6.5-2.1 4.6-9.7 9.3-9.7 9.3z"/></svg>';
  const isFav = (w) => S.favs.includes(w.id);
  const favButton = (w, cls) => `<button type="button" class="fav ${cls}" data-act="fav" data-work="${w.id}" aria-pressed="${isFav(w)}" aria-label="${esc(w.title)}: zu den Favoriten" title="Favorit">${HEART}</button>`;

  function toggleFav(id) {
    S.favs = S.favs.includes(id) ? S.favs.filter((x) => x !== id) : [id, ...S.favs];
    save();
    const on = S.favs.includes(id);
    $$(`[data-act="fav"][data-work="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', on));
    updateIdentity();
    if (currentRoute[0] === 'favoriten') route(true);
  }

  function viewFavoriten() {
    const list = S.favs.map((id) => byId.get(id)).filter((w) => w && isShown(w));
    if (!list.length) {
      return `<h1 class="page-title">Favoriten</h1><p class="empty">Noch keine Favoriten. Tippe bei einem Bild auf das Herz, dann findest du es hier wieder.</p><a class="btn" href="#/katalog">Bilder anschauen</a>`;
    }
    return `<h1 class="page-title">Favoriten</h1>
    <p class="note fav-note">${list.length === 1 ? '1 Bild' : `${list.length} Bilder`}. Ein Herz ist kein Gebot und reserviert nichts.</p>
    ${S.me ? '' : `<p class="note fav-hint">Deine Favoriten sind nur in diesem Browser gespeichert. <button type="button" class="fav-login" data-act="fav-login">Anmelden</button>, dann hast du sie auf allen Geräten.</p>`}
    ${masonry(list)}`;
  }

  function tile(w, i = 0, note = '') {
    const soon = w.mode === 'auction' && B.isOpen(lotOf(w), Date.now()) && lotOf(w).endsAt - Date.now() < 60 * MIN;
    // Bild und Text sind zwei Links, damit das Herz direkt unter der Bildkante neben dem Text stehen kann.
    return `<div class="tile-wrap" style="--d:${Math.min(i, 12) * 45}ms;--tint:${w.colors[0][0]}">
      <a class="tile${frameClass(w)}" href="#/werk/${w.slug}">
        ${art(w, `<img src="${w.img}" alt="${esc(w.title)}" width="${w.w}" height="${w.h}" loading="lazy">`)}
        ${isSold(w) ? '<span class="sold-dot" title="Verkauft"></span>' : ''}
      </a>
      <div class="tile-caption">
        <a class="tile tile-text" href="#/werk/${w.slug}" tabindex="-1">
          ${isOriginal(w) ? `<div class="tile-kind">${uniqueLabel(w)}</div>` : ''}
          <h3>${esc(w.title)}</h3>
          <div class="meta"><div data-mytag="${w.id}">${myTag(w)}</div><div data-tile="${w.id}">${priceLine(w)}</div><div class="tile-note">${note || sizeText(w)}</div>${soon ? `<div>Noch <span data-cd="${w.id}"></span></div>` : ''}</div>
        </a>
        ${favButton(w, 'on-tile')}
      </div>
    </div>`;
  }

  const columnCount = () => (innerWidth >= 1100 ? 4 : innerWidth >= 700 ? 3 : 2);

  function masonry(list, noteFor) {
    const buckets = Array.from({ length: columnCount() }, () => ({ h: 0, html: '' }));
    list.forEach((w, i) => {
      const b = buckets.reduce((low, c) => (c.h < low.h ? c : low));
      b.html += tile(w, i, noteFor ? noteFor(w) : '');
      b.h += w.h / w.w + 0.5;
    });
    return `<div class="masonry">${buckets.map((b) => `<div>${b.html}</div>`).join('')}</div>`;
  }

  function row(w, extra) {
    return `<li><a class="row" href="#/werk/${w.slug}">
      <img src="${w.img}" alt="" loading="lazy">
      <div><h3>${esc(w.title)}</h3><div class="meta">${extra}</div></div>
    </a></li>`;
  }

  const endLine = () => `<p class="end-line">Alle Auktionen enden am <strong>20. Juni 2027 um 18:00 Uhr</strong>, noch <span class="cd" data-cd-at="${AUCTION_END}"></span></p>`;

  /* ---------- Seiten ---------- */

  function activeLotsWithBids() {
    const now = Date.now();
    return WERKE.filter((w) => isShown(w) && w.mode === 'auction' && B.isOpen(lotOf(w), now) && bidCount(lotOf(w)) > 0)
      .sort((a, b) => lastActivity(lotOf(b)) - lastActivity(lotOf(a)));
  }

  /* ---------- Einstieg auf der Startseite ---------- */

  // Eine Wand zum Wischen: Das nächste Bild schaut am Rand herein, nichts bewegt sich von selbst.
  const HERO_COUNT = 8;

  // Die Wand passt sich an: abwechselnd das meistgeklickte Bild, das höchste Gebot und die meisten Gebote.
  // Verkaufte Bilder zählen mit. Dasselbe Motiv kommt nur einmal vor, auch wenn es Zeichnung und Bildtafel gibt.
  function heroWorks() {
    const shown = WERKE.filter(isShown);
    const auction = shown.filter((w) => w.mode === 'auction');
    const bids = (w) => bidCount(lotOf(w));
    const price = (w) => B.compute(lotOf(w)).price;
    const hasPrice = (w) => bids(w) > 0 || isSold(w);
    const lists = [
      [...shown].filter((w) => S.views[w.id].total > 0).sort((a, b) => S.views[b.id].total - S.views[a.id].total || a.number - b.number),
      auction.filter(hasPrice).sort((a, b) => price(b) - price(a) || a.number - b.number),
      auction.filter((w) => bids(w) > 0).sort((a, b) => bids(b) - bids(a) || a.number - b.number),
    ];
    const chosen = [];
    const motifs = new Set();
    const take = (w) => {
      if (!w || motifs.has(w.motif) || chosen.length >= HERO_COUNT) return;
      motifs.add(w.motif);
      chosen.push(w);
    };
    // Nur für den Prototyp: Die Zeichnungen sind noch Platzhalter, darum zeigt die Wand fast nur Farbbilder und weit hinten eine Zeichnung.
    const isPrint = (w) => w.type === 'print_aluminium';
    const longest = Math.max(...lists.map((list) => list.length));
    for (let i = 0; i < longest && chosen.length < HERO_COUNT - 1; i++) {
      lists.forEach((list) => { if (list[i] && isPrint(list[i]) && chosen.length < HERO_COUNT - 1) take(list[i]); });
    }
    // Solange es kaum Aufrufe und Gebote gibt, ergänzt eine harmonische Auswahl der Bildtafeln die Wand
    const order = harmonyOrder();
    const prints = shown.filter((w) => w.type === 'print_aluminium' && !isSold(w)).sort((a, b) => order.get(a.id) - order.get(b.id));
    const step = Math.max(1, Math.floor(prints.length / HERO_COUNT));
    const fill = (w) => { if (chosen.length < HERO_COUNT - 1) take(w); };
    prints.filter((_, i) => i % step === 0).forEach(fill);
    prints.forEach(fill);
    const drawing = lists.flat().find((w) => !isPrint(w) && !motifs.has(w.motif));
    if (drawing) chosen.splice(Math.min(HERO_COUNT - 2, chosen.length), 0, drawing);
    else prints.forEach(take);
    return chosen;
  }

  function heroArt() {
    const works = heroWorks();
    return `<div class="hero-art">
      <div class="hero-track" tabindex="0" aria-label="Bilder aus der Auktion">${works.map((w, i) => `<a class="hero-slide" href="#/werk/${w.slug}">
        <span class="hero-pic"><img src="${w.img}" alt="${esc(w.title)}" width="${w.w}" height="${w.h}" ${i ? 'loading="lazy"' : ''}></span>
        <span class="hero-cap">${isSold(w) ? '<span class="sold-mark">Verkauft</span> · ' : ''}${esc(w.title)}</span>
      </a>`).join('')}</div>
      <div class="hero-dots">${works.map((w, i) => `<button type="button" class="strip-dot" data-act="hero-dot" data-i="${i}" aria-label="Bild ${i + 1} von ${works.length}"></button>`).join('')}</div>
      <a class="btn wide hero-all" href="#/katalog">Alle Bilder anschauen</a>
    </div>`;
  }

  function heroGo(index) {
    const track = $('.hero-track');
    const slide = track && track.children[index];
    if (!slide) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  function setupHero() {
    const track = $('.hero-track');
    if (!track) return;
    const current = () => {
      const middle = track.scrollLeft + track.clientWidth / 2 + track.offsetLeft;
      let best = 0;
      [...track.children].forEach((slide, i) => {
        const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
        if (distance < Math.abs(track.children[best].offsetLeft + track.children[best].offsetWidth / 2 - middle)) best = i;
      });
      return best;
    };
    const mark = () => $$('.hero-dots .strip-dot').forEach((d, i) => d.classList.toggle('is-active', i === current()));
    if (!track.dataset.ready) {
      track.dataset.ready = '1';
      track.addEventListener('scroll', () => { track.dataset.left = track.scrollLeft; mark(); }, { passive: true });
      track.addEventListener('load', mark, true); // Erst mit dem Bild steht die Breite fest
    }
    // Nach dem Zurückgehen steht die Reihe wieder beim selben Bild
    if (track.dataset.left) track.scrollLeft = Number(track.dataset.left);
    mark();
  }

  function viewStart() {
    const hot = activeLotsWithBids().slice(0, 4);
    return `<section class="hero">
      <div>
        <p class="kicker">Auktion zur Ausstellung «Kopfstillstand», Kornschütte Luzern, 3. bis 20. Juni 2027</p>
        <h1>Bilder suchen neue Wände.</h1>
        <p class="lead">Hier findest du alle Bilder, die du an der Ausstellung erwerben oder ersteigern kannst. An den Wänden hängen die Originalzeichnungen, alle weiteren Bilder zeigt der Katalog, der vor Ort aufliegt. Scanne einen QR-Code oder stöbere gemütlich von zu Hause aus.</p>
        <p class="lead-small">Wer nicht bis zum Schluss warten mag, kauft zum Sofortpreis. Und zu jeder Originalzeichnung gibt es auf Wunsch ein Passepartout oder einen Rahmen.</p>
        <p class="hero-count"><strong data-cd-at="${AUCTION_END}"></strong><span>bis zum Schluss, am 20. Juni 2027 um 18:00 Uhr</span></p>
        <a class="btn hero-all-text" href="#/katalog">Alle Bilder anschauen</a>
      </div>
      ${heroArt()}
    </section>
    <div class="section-head"><h2>Gerade begehrt</h2><a href="#/begehrt">Alle ansehen</a></div>
    ${masonry(hot)}
    ${craftHome()}`;
  }

  function viewKatalog() {
    const chips = (key, options) => options.map(([val, label]) =>
      `<button type="button" class="chip" data-act="filter" data-key="${key}" data-val="${esc(val)}" aria-pressed="${filter[key] === val}">${esc(label)}</button>`).join('');
    const active = ['type', 'format', 'family'].filter((k) => filter[k]).length;
    return `<h1 class="page-title">Alle Bilder</h1>
    ${endLine()}
    <details class="filters" ${active || filtersOpen ? 'open' : ''}>
      <summary>Filter${active ? ` (${active} aktiv)` : ''}</summary>
      <div class="filter-group"><span>Werktyp</span><div class="chips">${chips('type', Object.entries(TYPE))}</div></div>
      <div class="filter-group"><span>Format</span><div class="chips">${chips('format', FORMATS.map((f) => [f, f]))}</div></div>
      <div class="filter-group"><span>Farben</span><div class="chips">${Object.entries(FAMILY).map(([name, hex]) =>
        `<button type="button" class="swatch" style="background:${hex}" title="${name}" aria-label="${name}" data-act="filter" data-key="family" data-val="${name}" aria-pressed="${filter.family === name}"></button>`).join('')}</div></div>
      ${active ? '<p><button type="button" class="linklike" data-act="clear-filters">Filter zurücksetzen</button></p>' : ''}
    </details>
    <div id="catalog-results">${catalogResults()}</div>`;
  }

  // Abfolge der Bildtafeln: Jedes nächste Bild passt harmonisch zu den letzten drei. Einmal gerechnet, damit nichts springt.
  let harmonyCache = null;
  function harmonyOrder() {
    if (harmonyCache) return harmonyCache;
    const rest = WERKE.filter((w) => matchGroup(w) === 'color');
    const score = (w, others) => others.reduce((sum, o) => sum + suggestPct(o, w), 0) / others.length;
    rest.sort((a, b) => score(b, rest.filter((x) => x !== b)) - score(a, rest.filter((x) => x !== a)));
    const chain = [rest.shift()];
    while (rest.length) {
      const recent = chain.slice(-3);
      let best = 0;
      rest.forEach((w, i) => { if (score(w, recent) > score(rest[best], recent)) best = i; });
      chain.push(rest.splice(best, 1)[0]);
    }
    harmonyCache = new Map(chain.map((w, i) => [w.id, i]));
    return harmonyCache;
  }

  function catalogResults() {
    let list = WERKE.filter((w) => isShown(w) &&
      (!filter.type || w.type === filter.type) &&
      (!filter.format || w.format === filter.format) &&
      (!filter.family || w.families.includes(filter.family)));
    const priceOf = (w) => (w.mode === 'auction' ? B.compute(lotOf(w)).price : 1e12);
    const area = (w) => w.sizeCm[0] * w.sizeCm[1];
    // Beliebtheit: Ein Gebot zählt so viel wie 40 Aufrufe. Verkauftes rückt nach hinten, Unverkäufliches ebenso.
    const popularity = (w) => {
      if (isSold(w) || w.mode === 'not_for_sale') return -1;
      return (w.mode === 'auction' ? bidCount(lotOf(w)) * 40 : 0) + S.views[w.id].total;
    };
    // Harmonie: zuerst die Bildtafeln in stimmiger Abfolge, verkaufte ans Ende, danach die Zeichnungen ungeordnet nach Nummer
    const harmonyRank = (w) => {
      if (matchGroup(w) === 'pencil') return 1e6 + w.number;
      return harmonyOrder().get(w.id) + (isSold(w) ? 1e5 : 0);
    };
    const sorters = {
      harmony: (a, b) => harmonyRank(a) - harmonyRank(b),
      popular: (a, b) => popularity(b) - popularity(a),
      number: (a, b) => a.number - b.number,
      price: (a, b) => priceOf(a) - priceOf(b),
      bids: (a, b) => (b.mode === 'auction' ? bidCount(lotOf(b)) : -1) - (a.mode === 'auction' ? bidCount(lotOf(a)) : -1),
      big: (a, b) => area(b) - area(a),
      small: (a, b) => area(a) - area(b),
    };
    list = [...list].sort(sorters[filter.sort]);
    const opt = (v, l) => `<option value="${v}" ${filter.sort === v ? 'selected' : ''}>${l}</option>`;
    return `<div class="sort-row"><span>${list.length} ${list.length === 1 ? 'Bild' : 'Bilder'}</span>
      <label>Sortieren <select data-act-change="sort">${opt('harmony', 'Harmonie')}${opt('popular', 'Beliebtheit')}${opt('number', 'Nummer')}${opt('price', 'Preis')}${opt('bids', 'Anzahl Gebote')}${opt('big', 'Grösse: gross zuerst')}${opt('small', 'Grösse: klein zuerst')}</select></label></div>
      ${list.length ? masonry(list) : '<p class="empty">Zu dieser Auswahl gibt es kein Bild.</p>'}`;
  }

  // Mit gewähltem Passepartout oder Rahmen steht zusätzlich das Gesamtmass in den Angaben
  function factsHtml(w) {
    const facts = [
      ['Werktyp', TYPE[w.type]],
      ['Technik', w.technique],
      ['Format', `${w.format}, ${sizeText(w)}`],
    ];
    const framed = w.type === 'original_framed' || (w.type === 'original' && ['white', 'wood'].includes(S.frames[w.id]));
    const matted = w.type === 'original' && S.frames[w.id] === 'mat';
    if (framed || matted) {
      const edge = 2 * (matCm(w) + (framed ? frameCm(w) : 0));
      facts.push([framed ? 'Mit Rahmen' : 'Mit Passepartout', `${cm(w.sizeCm[0] + edge)} × ${cm(w.sizeCm[1] + edge)} cm`]);
    }
    return facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  }

  function viewWerk(slug) {
    const w = WERKE.find((x) => x.slug === slug);
    if (!w) return '<h1 class="page-title">Dieses Bild gibt es nicht</h1><p><a href="#/katalog">Zu allen Bildern</a></p>';
    // Auch ein gedruckter QR-Code darf nie auf eine halbfertige Seite führen
    if (!isShown(w) && !cockpitOpen) return '<h1 class="page-title">Dieses Bild kommt bald</h1><p>Es ist noch nicht fertig erfasst. Schau gerne bei den anderen Bildern vorbei.</p><p><a href="#/katalog">Zu allen Bildern</a></p>';
    const previous = WERKE.find((x) => x.slug === workTrail[workTrail.length - 1]);
    return `<nav class="work-nav" aria-label="Zurück">
      ${previous ? `<a class="back back-work" href="#/werk/${previous.slug}">← Zurück zu «${esc(previous.title)}»</a>` : ''}
      <a class="back" href="#/katalog">Zu allen Bildern</a>
    </nav>
    <article class="work">
      <div class="work-media${frameClass(w)}">
        <button type="button" class="work-img" data-act="zoom" data-src="${w.img}" aria-label="Bild vergrössern">
          ${art(w, `<img src="${w.img}" alt="${esc(w.title)}" width="${w.w}" height="${w.h}">`)}
          ${isSold(w) ? '<span class="sold-dot" title="Verkauft"></span>' : ''}
        </button>
        <p class="hint">Tippe aufs Bild zum Zoomen. Die Farben am Bildschirm können leicht vom Original abweichen.</p>
      </div>
      <div>
        <span class="num">Nr. ${w.number}</span>
        <div class="work-title"><h1>${esc(w.title)}</h1>${favButton(w, 'on-work')}</div>
        ${isOriginal(w) ? `<p class="unique-note">${uniqueLabel(w)}. Von Hand mit Bleistift gezeichnet.</p>` : ''}
        <div id="sale-panel" data-work="${w.id}">${salePanel(w)}</div>
        ${frameOptions(w)}
        <dl class="facts" id="work-facts">${factsHtml(w)}</dl>
        ${siblingLink(w)}
        ${w.mode === 'auction' ? `<h2>Gebote</h2><div id="history">${historyHtml(w)}</div>${demoTools(w)}` : ''}
      </div>
    </article>
    <h2>Das könnte dir auch gefallen</h2>
    <div id="suggestions">${suggestionsHtml(w)}</div>
    ${formatsHtml(w)}
    ${craftSection(w)}`;
  }

  function salePanel(w) {
    const now = Date.now();
    if (w.mode === 'not_for_sale') {
      return `<div class="price-card"><span class="badge neutral">Nur zum Anschauen</span><p class="note" style="margin-top:10px">Dieses Bild hängt an der Ausstellung und bleibt bei mir.</p></div>`;
    }
    const lot = lotOf(w);
    const { price, leader } = B.compute(lot);
    const st = statusOf(lot, now);
    const open = B.isOpen(lot, now);
    const n = bidCount(lot);
    const mine = B.ownMax(lot, ME);
    let myState = '';
    if (lot.sold && lot.soldTo === ME) myState = `<div class="my-state lead">Gratulation, das Bild gehört dir!<small>Die Zahlungsangaben und weitere Informationen kommen per Mail.</small></div>`;
    else if (!open && !lot.sold && leader === ME) myState = `<div class="my-state lead">Gratulation, das Bild gehört dir!<small>Du hast die Auktion gewonnen. Die Zahlungsangaben und weitere Informationen kommen per Mail.</small></div>`;
    else if (!open && mine !== null) myState = `<div class="my-state lost">Diesmal hat es nicht gereicht</div>`;
    else if (leader === ME && autoRaise(lot)) {
      const auto = autoRaise(lot);
      myState = `<div class="my-state lead">Du führst weiterhin, automatisch erhöht<small>${esc(whoLabel(lot, auto.rival.bidder))} hat ${chf(auto.rival.amount)} geboten. Dein Maximalgebot von <strong>${chf(auto.max)}</strong> hat dein Gebot deshalb auf <strong>${chf(auto.price)}</strong> erhöht.${auto.max > auto.price ? ` Mehr als ${chf(auto.max)} zahlst du nie.` : ' Dein Maximum ist damit ausgeschöpft.'}</small></div>`;
    } else if (leader === ME) myState = hasReserve(lot)
      ? `<div class="my-state lead">Du führst<small>Dein Maximalgebot: <strong>${chf(mine)}</strong>. Bis dahin wird automatisch für dich geboten. Andere Bietende sehen diesen Betrag nicht.</small></div>`
      : `<div class="my-state lead">Du führst<small>Dein Gebot: <strong>${chf(mine)}</strong>. Wirst du überboten, bekommst du eine Mail.</small></div>`;
    else if (isTied(lot)) myState = `<div class="my-state lost">Gleich hoch, aber später<small>Jemand hat ${chf(mine)} schon vor dir geboten und führt darum. Bei gleichen Beträgen zählt, wer zuerst da war. Das nächste Gebot ist ${chf(B.minBid(lot, ME))}.</small></div>`;
    else if (mine !== null) myState = `<div class="my-state lost">Jemand hat dich überboten<small>Dein letztes Gebot war ${chf(mine)}. Du kannst jederzeit höher gehen.</small></div>`;

    const canBuy = B.buyNowAvailable(lot, now);
    return `<div class="price-card">
      <span class="badge ${st.cls}" data-status="${w.id}">${st.label}</span>
      <div class="price-pair">
        <div>
          <span class="price-label">${n === 0 ? 'Startpreis' : open ? 'Aktuelles Gebot' : 'Endpreis'}</span>
          <span class="price" data-price="${w.id}" data-value="${price}">${chf(price)}</span>
        </div>
        ${canBuy ? `<div class="buy-now">
          <span class="price-label">Sofortpreis</span>
          <span class="price">${chf(lot.buyNow)}</span>
        </div>` : ''}
      </div>
      ${open ? `<div class="time-left"><span class="price-label">Noch</span><span class="countdown" data-cd="${w.id}"></span></div>` : ''}
      <div class="price-sub">
        <span>${n === 0 ? 'Noch kein Gebot' : n === 1 ? '1 Gebot' : n + ' Gebote'}</span>
      </div>
      ${open ? `<p class="next-bid">${nextBidLine(lot)}</p>` : ''}
      ${lot.endsAt > lot.originalEndsAt && open ? '<p class="ext-note" style="margin-bottom:0">Verlängert: Ein Gebot in den letzten 5 Minuten gibt allen nochmals 5 Minuten.</p>' : ''}
      ${myState}
      ${leader === ME ? '' : soldNote(w)}
      ${open ? `<div class="bidbar">
        <button type="button" class="btn" data-act="bid" data-work="${w.id}">${leader === ME ? (hasReserve(lot) ? 'Maximum erhöhen' : 'Automatisch weiterbieten') : mine !== null ? 'Nochmals bieten' : 'Mitbieten'}</button>
        ${canBuy ? `<button type="button" class="btn ghost" data-act="buy-now" data-work="${w.id}">Sofort ${chf(lot.buyNow)}</button>` : ''}
      </div>` : ''}
    </div>`;
  }

  function historyHtml(w) {
    const lot = lotOf(w);
    const rows = lot.log.filter((r) => !r.cancelled).slice().reverse();
    if (!rows.length) return '<p class="note">Noch niemand hat geboten. Du könntest die erste Person sein.</p>';
    const { price, leader } = B.compute(lot);
    const open = B.isOpen(lot, Date.now());
    const name = whoLabel(lot, leader);
    const verb = lot.sold ? (leader === ME ? 'hast sofort gekauft' : 'hat sofort gekauft') : open ? (leader === ME ? 'führst' : 'führt') : (leader === ME ? 'hast den Zuschlag' : 'hat den Zuschlag');
    const n = rows.length;
    const people = new Set(rows.map((r) => r.bidder)).size;
    // Offenes Aufklappen überlebt die Live-Aktualisierung derselben Seite
    const current = $('#history details');
    const wasOpen = current && current.open && current.dataset.work === String(w.id);
    // Das eigene Gebot fällt sofort auf: grün, solange es führt, durchgestrichen, sobald es nicht mehr gilt
    const myLatest = leader === ME ? rows.find((r) => r.bidder === ME) : null;
    const rowClass = (r) => (r.bidder !== ME ? '' : r === myLatest ? ' class="is-me is-leading"' : ' class="is-me is-out"');
    const rowNote = (r) => {
      const auto = r.kind === 'proxy' ? ' <small>automatisch</small>' : '';
      if (r.bidder !== ME) return auto;
      return `${auto} <small>${r === myLatest ? 'führt' : 'gilt nicht mehr'}</small>`;
    };
    return `<div class="bid-now${leader === ME ? ' is-leading' : ''}"><span>${esc(name)} ${verb}</span><span>${chf(price)}</span></div>
      <p class="bid-summary">${n === 1 ? '1 Gebot' : `${n} Gebote`} von ${people === 1 ? '1 Person' : `${people} Personen`}, letztes ${ago(rows[0].at)}</p>
      ${n > 1 ? `<details class="bid-all" data-work="${w.id}"${wasOpen ? ' open' : ''}>
        <summary>Alle Gebote anzeigen</summary>
        <ul class="history">${rows.map((r) => `<li${rowClass(r)}><span>${esc(whoLabel(lot, r.bidder))}, ${ago(r.at)}${rowNote(r)}</span><span class="history-amount">${chf(r.amount)}</span></li>`).join('')}</ul>
      </details>` : ''}`;
  }

  function demoTools(w) {
    if (!B.isOpen(lotOf(w), Date.now())) return '';
    return `<details class="demo-tools"><summary>Demo-Werkzeuge (nur im Prototyp)</summary>
      <p style="margin:8px 0 0">Damit kannst du den Schluss der Auktion und die Verlängerung ausprobieren.</p>
      <div class="chips">
        <button type="button" class="chip" data-act="demo-end" data-work="${w.id}">Ende in 5:30 setzen</button>
        <button type="button" class="chip" data-act="demo-rival" data-work="${w.id}">Fremdes Gebot auslösen</button>
      </div></details>`;
  }

  function viewBegehrt() {
    const list = activeLotsWithBids();
    return `<h1 class="page-title">Gerade begehrt</h1>
    <p>Diese Bilder haben schon mindestens ein Gebot. Was zuletzt Bewegung hatte, steht zuoberst.</p>
    ${list.length ? `<ul class="rows">${list.map((w) => row(w, `<div data-tile="${w.id}">${priceLine(w)}</div>`)).join('')}</ul>` : '<p class="empty">Noch ist es ruhig.</p>'}`;
  }

  function viewMeine() {
    const now = Date.now();
    const mine = WERKE.filter((w) => w.mode === 'auction' && B.ownMax(lotOf(w), ME) !== null);
    const stateOf = (w) => {
      const lot = lotOf(w);
      const { leader } = B.compute(lot);
      if (B.isOpen(lot, now)) return leader === ME ? ['Du führst', 'lead'] : isTied(lot) ? ['Gleich hoch, aber später', 'alert'] : ['Überboten', 'alert'];
      return leader === ME ? ['Gewonnen', 'lead'] : ['Nicht gereicht', 'neutral'];
    };
    if (!mine.length) {
      return `<h1 class="page-title">Meine Gebote</h1><p class="empty">Du hast noch auf kein Bild geboten.</p><a class="btn" href="#/katalog">Bilder anschauen</a>`;
    }
    return `<h1 class="page-title">Meine Gebote</h1>
    <ul class="rows">${mine.map((w) => {
      const [label, cls] = stateOf(w);
      return row(w, `<span class="badge ${cls}">${label}</span>
        <div data-tile="${w.id}">${priceLine(w)}</div>
        <div>${myBidLabel(lotOf(w))}: ${chf(B.ownMax(lotOf(w), ME))}</div>
        ${autoRaise(lotOf(w)) ? `<div class="row-auto">Automatisch auf ${chf(autoRaise(lotOf(w)).price)} erhöht</div>` : ''}`);
    }).join('')}</ul>`;
  }

  function viewRegeln() {
    return `<article class="prose"><h1 class="page-title">Spielregeln</h1>
    <p><span class="badge neutral">Entwurf</span> Der definitive Text folgt und wird noch abgeklärt.</p>
    <h2>So bietest du mit</h2>
    <ul>
      <li>Dein Gebot gilt verbindlich. Wer am Schluss vorne liegt, kauft das Bild.</li>
      <li><strong>Bietschritt:</strong> Das nächste Gebot liegt immer mindestens einen Schritt über dem aktuellen, in der Regel CHF 20. Auf jeder Bildseite und im Bietfenster steht der Mindestbetrag. Darüber ist jeder ganze Frankenbetrag möglich.</li>
      <li><strong>Maximalgebot:</strong> Du nennst den Betrag, den du höchstens zahlen möchtest. Das System bietet nur so weit wie nötig für dich mit. Andere Bietende sehen dein Maximum nie, einsehen kann es nur Benedikt in der Verwaltung.</li>
      <li><strong>Gleich hohe Gebote:</strong> Bieten zwei denselben Betrag, führt, wer ihn zuerst geboten hat. Wer später kommt, muss also mindestens einen Schritt höher gehen.</li>
      <li><strong>Sofortpreis:</strong> Du willst nicht zittern? Dann kaufst du das Bild direkt zum Sofortpreis, und die Auktion für dieses Bild ist fertig.</li>
      <li><strong>Verlängerung:</strong> Kommt in den letzten 5 Minuten ein Gebot, läuft die Auktion für dieses Bild 5 Minuten ab diesem Gebot weiter.</li>
    </ul>
    <h2>Nach der Auktion</h2>
    <ul>
      <li><strong>Passepartout oder Rahmen:</strong> Das Gebot gilt immer für das Bild allein. Bei Originalzeichnungen wählst du nach der Auktion, ob du es ohne, mit Passepartout oder mit Rahmen möchtest. Der Aufpreis kommt dann zum Gebot dazu.</li>
      <li>Du bekommst die Zahlungsangaben per Mail und zahlst innert 10 Tagen per TWINT oder Überweisung.</li>
      <li>Du holst dein Bild an der Finissage ab oder wir finden einen anderen Weg.</li>
      <li>Kommt keine Zahlung, kann das Bild an die zweitbietende Person gehen.</li>
    </ul></article>`;
  }

  function viewDatenschutz() {
    return `<article class="prose"><h1 class="page-title">Datenschutz</h1>
    <p><span class="badge neutral">Entwurf</span> Der definitive Text folgt.</p>
    <p>Dieser Prototyp schickt deine Eingaben an keinen Server. Sie bleiben im Speicher dieses Browsers, und du löschst sie mit «Zurücksetzen» oben auf der Seite. Nur die Schriften lädt er vorläufig von Google Fonts, in der echten Anwendung liegen sie auf dem eigenen Server.</p></article>`;
  }

  /* ---------- Ähnliche Formate ---------- */

  let wallBase = null;
  function formatItem(x, isCurrent) {
    const inner = `${art(x, `<img src="${x.img}" alt="${esc(x.title)}" loading="lazy" width="${x.w}" height="${x.h}">`)}
      ${isSold(x) ? '<span class="sold-dot" title="Verkauft"></span>' : ''}`;
    const frame = x.type === 'original_framed' ? ` framed${x.id % 2 ? ' wood' : ''}` : '';
    return `<div class="format-item${isCurrent ? ' is-current' : ''}">
      ${isCurrent ? `<div class="format-pic${frame}">${inner}</div>` : `<a class="format-pic${frame}" href="#/werk/${x.slug}">${inner}</a>`}
      <h3>${isCurrent ? 'Dieses Bild' : esc(x.title)}</h3>
      ${isCurrent ? '' : `<div class="meta"><div data-tile="${x.id}">${priceLine(x)}</div>${showMatch ? `<div>${suggestPct(wallBase, x)} %</div>` : ''}</div>`}
    </div>`;
  }

  function formatsHtml(w) {
    // Die Ausrichtung ist Pflicht, das Format exakt, der Typ gleich. Verkaufte Bilder kommen ans Ende.
    const sameKind = WERKE.filter((x) => isShown(x) && x.id !== w.id && x.type === w.type && landscape(x) === landscape(w) && x.mode !== 'not_for_sale');
    const exact = sameKind.filter((x) => sameSize(w, x));
    const orientation = landscape(w) ? 'Querformat' : 'Hochformat';
    const items = exact.length ? exact : sameKind;
    if (!items.length) return '';
    // Das Passendste zuerst, verkaufte Bilder ans Ende. Bei vielen Zeichnungen genügt eine Auswahl.
    wallBase = w;
    const byMatch = (a, b) => suggestPct(w, b) - suggestPct(w, a);
    const chain = [...items.filter((x) => !isSold(x)).sort(byMatch), ...items.filter(isSold).sort(byMatch)].slice(0, 24);
    const sortedBy = matchGroup(w) === 'color' ? 'die farblich harmonischsten zuerst' : 'die nach Thema und Bildaufbau passendsten zuerst';
    const lead = exact.length
      ? `${orientation}, ${sizeText(w)}: ${exact.length === 1 ? '1 Bild hat' : `${exact.length} Bilder haben`} ähnliche Masse, mit höchstens 1 cm Unterschied, ${sortedBy}.`
      : `Ein ähnliches Format gibt es hier nicht. Diese Bilder sind ebenfalls im ${orientation}.`;
    return `<section class="formats">
      <h2>${exact.length ? 'Ähnliche Formate' : 'Gleiche Ausrichtung'}</h2>
      <p class="formats-sub">${lead}</p>
      <div class="format-strip">${formatItem(w, true)}${chain.map((x) => formatItem(x, false)).join('')}</div>
      <div class="format-nav" hidden>
        <button type="button" class="strip-arrow" data-act="strip" data-dir="-1" aria-label="Zurück blättern">←</button>
        <span class="strip-dots"></span>
        <button type="button" class="strip-arrow" data-act="strip" data-dir="1" aria-label="Weiter blättern">→</button>
      </div>
    </section>`;
  }

  /* ---------- Bietdialog ---------- */

  const sheet = $('#sheet');
  const flow = { work: null, amount: null, then: null };

  function openSheet(html) {
    parkToasts();
    sheet.innerHTML = `<button type="button" class="sheet-close" data-act="close-sheet" aria-label="Schliessen">×</button>${html}`;
    if (!sheet.open) sheet.showModal();
  }

  function stepRegister() {
    openSheet(`<h2 id="sheet-title">Kurz anmelden</h2>
    <form class="stack" data-form="register">
      <p class="note">Das machst du nur einmal. Ein Passwort brauchst du nicht, du bekommst einen Link per Mail.</p>
      <label>Vorname<input type="text" name="first" required autocomplete="given-name"></label>
      <label>Nachname<input type="text" name="last" required autocomplete="family-name"></label>
      <label>E-Mail<input type="email" name="email" required autocomplete="email"></label>
      <label class="check"><input type="checkbox" required> <span>Ich bin mit den <a href="#/regeln" target="_blank">Spielregeln</a> und der <a href="#/datenschutz" target="_blank">Datenschutzerklärung</a> einverstanden.</span></label>
      <button class="btn wide">Link schicken</button>
      <p class="note">Im Prototyp geht keine Mail raus, und nichts wird übertragen.</p>
    </form>`);
  }

  const DEMO_CODE = '482913';

  function stepMailSent(email, message) {
    flow.email = email;
    openSheet(`<h2 id="sheet-title">Schau in deine Mails</h2>
    <div class="stack">
      <p>Die Mail ist unterwegs zu <strong>${esc(email)}</strong>. Öffne den Link darin oder tippe hier den Code ein. Beides ist 15 Minuten gültig.</p>
      ${message ? `<p class="field-error">${esc(message)}</p>` : ''}
      <form class="stack" data-form="login-code">
        <label>Code aus der Mail<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
        <button class="btn wide">Anmelden</button>
      </form>
      <p class="note">Im Prototyp lautet der Code ${DEMO_CODE}.</p>
      <button type="button" class="btn ghost wide" data-act="magic-link">Prototyp: Link aus der Mail öffnen</button>
    </div>`);
  }

  function finishLogin() {
    S.me = { first: flow.first };
    save();
    toast(`Hallo ${esc(flow.first)}, du bist angemeldet.`);
    if (flow.then) { const next = flow.then; flow.then = null; next(); }
  }

  // Von einem Maximalgebot ist nur die Rede, wenn wirklich etwas über dem Preis liegt. Wer einfach das nächste Gebot abgibt, hat kein Maximum.
  const hasReserve = (lot) => {
    const { price, leader } = B.compute(lot);
    return leader === ME && B.ownMax(lot, ME) > price;
  };
  const myBidLabel = (lot) => (hasReserve(lot) ? 'Dein Maximalgebot' : B.compute(lot).leader === ME ? 'Dein Gebot' : 'Dein letztes Gebot');

  // Unter dem Preis: Was ist als Nächstes möglich?
  function nextBidLine(lot) {
    const min = B.minBid(lot, ME);
    const { leader } = B.compute(lot);
    if (lot.buyNow && min >= lot.buyNow) return `Der nächste Schritt läge über dem Sofortpreis. Du kannst das Bild direkt für <strong>${chf(lot.buyNow)}</strong> kaufen.`;
    if (leader === ME) return `${hasReserve(lot) ? 'Dein Maximum' : 'Dein Gebot'} kannst du ab <strong>${chf(min)}</strong> erhöhen.`;
    return `Nächstes Gebot ab <strong>${chf(min)}</strong>${leader === null ? '' : `, Bietschritt ${chf(lot.inc)}`}`;
  }

  // Warum das nächste Gebot genau so hoch ist, in einem Satz
  function minBidReason(lot) {
    const { price, leader } = B.compute(lot);
    if (leader === null) return 'Das erste Gebot beginnt beim Startpreis.';
    if (leader === ME) return `Das ist mehr als dein bisheriges Gebot, der Preis bleibt dabei bei ${chf(price)}.`;
    return `Das ist das aktuelle Gebot von ${chf(price)} plus der Bietschritt von ${chf(lot.inc)}.`;
  }

  function stepBid(message) {
    const w = byId.get(flow.work);
    const lot = lotOf(w);
    const { price, leader } = B.compute(lot);
    const min = B.minBid(lot, ME);
    const isLeader = leader === ME;
    const canBuy = B.buyNowAvailable(lot, Date.now());
    openSheet(`<h2 id="sheet-title">${esc(w.title)}</h2>
    <div class="stack">
      ${message ? `<p class="field-error">${esc(message)}</p>` : ''}
      <p class="note">${bidCount(lot) ? 'Aktuelles Gebot' : 'Startpreis'}: <strong>${chf(price)}</strong>${isLeader && hasReserve(lot) ? `. Dein Maximalgebot: <strong>${chf(B.ownMax(lot, ME))}</strong>` : ''}</p>
      ${isLeader || (lot.buyNow && min >= lot.buyNow) ? '' : `<button type="button" class="btn wide" data-act="pick" data-amount="${min}">${chf(min)} bieten</button>
      <div class="divider">oder</div>`}
      <p class="min-bid">${lot.buyNow && min >= lot.buyNow ? nextBidLine(lot) : `<strong>Mindestens ${chf(min)}.</strong> ${minBidReason(lot)}`}</p>
      <form class="stack" data-form="max" novalidate>
        <label>${isLeader ? 'Automatisch weiterbieten bis' : 'Automatisch mitbieten bis'}
          <input type="number" name="max" inputmode="numeric" min="${min / 100}" step="1" placeholder="ab ${min / 100}" required>
        </label>
        <p class="note">Sag, wie weit du höchstens gehst. Ab ${chf(min)} ist jeder ganze Frankenbetrag möglich. Wenn jemand dich überbietet, bietet das System automatisch für dich weiter, aber immer nur so viel wie nötig.</p>
        <button class="btn ghost wide">Weiter</button>
      </form>
      ${canBuy ? `<div class="divider">oder</div><button type="button" class="btn ghost wide" data-act="pick-buy">Sofort kaufen für ${chf(lot.buyNow)}</button>` : ''}
    </div>`);
  }

  function stepConfirm(amount, buy) {
    const w = byId.get(flow.work);
    const lot = lotOf(w);
    flow.amount = amount;
    flow.key = 'k' + Date.now() + Math.random();
    const asBuy = buy || amount >= lot.buyNow;
    openSheet(`<h2 id="sheet-title">${asBuy ? 'Sofort kaufen?' : 'Passt das so?'}</h2>
    <div class="stack">
      <p style="margin:0">${esc(w.title)}</p>
      <div class="confirm-amount">${chf(asBuy ? lot.buyNow : amount)}</div>
      <p class="note">${asBuy
        ? (buy ? 'Damit kaufst du das Bild verbindlich, und die Auktion dafür ist fertig.' : `Dein Maximum erreicht den Sofortpreis. Du kaufst das Bild also verbindlich für ${chf(lot.buyNow)}, und die Auktion dafür ist fertig.`)
        : amount === B.minBid(lot, ME) ? 'Dein Gebot gilt verbindlich.' : 'Dein Gebot gilt verbindlich. Du zahlst höchstens diesen Betrag, oft weniger.'}</p>
      <button type="button" class="btn wide" data-act="${buy ? 'confirm-buy' : 'confirm-bid'}">${asBuy ? 'Verbindlich kaufen' : 'Verbindlich bieten'}</button>
      <button type="button" class="btn ghost wide" data-act="bid" data-work="${w.id}">Zurück</button>
    </div>`);
  }

  function stepResult(r) {
    const w = byId.get(flow.work);
    const texts = {
      leading: ['✓', '', 'Du führst', hasReserve(lotOf(w))
        ? `Aktuelles Gebot: ${chf(r.price)}. Bis ${chf(B.ownMax(lotOf(w), ME))} wird automatisch für dich geboten. Andere Bietende sehen dieses Maximum nicht.`
        : `Dein Gebot: ${chf(r.price)}. Wirst du überboten, bekommst du eine Mail.`],
      raised: ['✓', '', 'Maximum erhöht', `Du führst weiterhin, und der Preis bleibt bei ${chf(r.price)}.`],
      outbid: isTied(lotOf(w))
        ? ['!', 'bad', 'Gleich hoch, aber später', `Jemand hat ${chf(r.price)} schon vor dir geboten und führt darum. Bei gleichen Beträgen zählt, wer zuerst da war. Das nächste Gebot ist ${chf(B.minBid(lotOf(w), ME))}.`]
        : ['!', 'bad', 'Sofort überboten', `Jemand hatte schon ein höheres automatisches Gebot. Neues Gebot: ${chf(r.price)}.`],
      bought: ['✓', '', 'Gratulation, das Bild gehört dir!', `Du hast es für ${chf(r.price)} gekauft. Die Zahlungsangaben und weitere Informationen kommen per Mail.`],
    };
    const [icon, cls, title, text] = texts[r.outcome];
    openSheet(`<div class="stack">
      <div class="result-icon ${cls}" aria-hidden="true">${icon}</div>
      <h2 id="sheet-title" style="margin:0">${title}</h2>
      <p style="margin:0">${text}${r.extended ? ' Die Auktion läuft jetzt noch 5 Minuten ab deinem Gebot.' : ''}</p>
      ${r.outcome === 'outbid' ? `<button type="button" class="btn wide" data-act="bid" data-work="${w.id}">Höher bieten</button>` : ''}
      <button type="button" class="btn ghost wide" data-act="close-sheet">Schliessen</button>
    </div>`);
  }

  function withLogin(next) {
    if (S.me) return next();
    flow.then = next;
    stepRegister();
  }

  function submitBid(buy) {
    const w = byId.get(flow.work);
    const lot = lotOf(w);
    const now = Date.now();
    const r = buy ? B.buyNow(lot, ME, now, flow.key) : B.place(lot, ME, flow.amount, now, flow.key);
    if (!r.ok) {
      if (r.code === 'too_low') return stepBid(`Jemand war schneller. Neues Gebot: ${chf(r.price)}`);
      if (r.code === 'closed') return stepBid('Die Auktion für dieses Bild ist fertig.');
      if (r.code === 'no_buy_now') return stepBid('Den Sofortpreis gibt es nicht mehr.');
      return stepBid('Bitte gib einen Betrag in ganzen Franken ein.');
    }
    afterChange(w.id);
    if (!r.duplicate) stepResult(r);
  }

  /* ---------- Live-Aktualisierung ---------- */

  function afterChange(id) {
    save();
    atelierDirty = true;
    const w = byId.get(id);
    const panel = $('#sale-panel');
    if (panel && Number(panel.dataset.work) === id) {
      const old = $(`[data-price="${id}"]`, panel);
      const oldVal = old ? Number(old.dataset.value) : null;
      panel.innerHTML = salePanel(w);
      const hist = $('#history');
      if (hist) hist.innerHTML = historyHtml(w);
      const el = $(`[data-price="${id}"]`, panel);
      if (el && oldVal !== null && oldVal !== Number(el.dataset.value)) rollPrice(el, oldVal, Number(el.dataset.value));
    }
    $$(`[data-tile="${id}"]`).forEach((el) => { el.innerHTML = priceLine(w); });
    $$(`[data-mytag="${id}"]`).forEach((el) => { el.innerHTML = myTag(w); });
    tickCountdowns();
  }

  function rollPrice(el, from, to) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / 600);
      const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
      el.textContent = chf(Math.round(v / 100) * 100);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function tickCountdowns() {
    const now = Date.now();
    $$('[data-cd]').forEach((el) => {
      const lot = S.lots[el.dataset.cd];
      if (!lot) return;
      const left = lot.endsAt - now;
      el.textContent = formatLeft(left);
      el.classList.toggle('urgent', el.classList.contains('countdown') && left > 0 && left < B.SOFT_CLOSE_MS);
    });
    $$('[data-cd-at]').forEach((el) => { el.textContent = formatLeft(Number(el.dataset.cdAt) - now); });
    $$('[data-status]').forEach((el) => {
      const st = statusOf(S.lots[el.dataset.status], now);
      if (el.textContent !== st.label) { el.textContent = st.label; el.className = `badge ${st.cls}`; }
    });
    // Abgelaufene Lose: Bildseite neu aufbauen, damit das Bieten verschwindet
    const panel = $('#sale-panel');
    if (panel && panel.dataset.work) {
      const w = byId.get(Number(panel.dataset.work));
      if (w.mode === 'auction' && !B.isOpen(lotOf(w), now) && $('.bidbar', panel)) afterChange(w.id);
    }
  }

  // Simulierte Mitbietende: reagieren, wenn du führst, und bieten gelegentlich anderswo
  const nextRival = {};
  const RIVAL_FIRST_MS = 90 * 1000, RIVAL_AGAIN_MS = 3 * 60 * 1000, RIVAL_SPREAD_MS = 210 * 1000, RIVAL_CHANCE = 0.5;
  function rivalBid(w, force) {
    const lot = lotOf(w);
    const now = Date.now();
    const { price, leader } = B.compute(lot);
    const others = Object.keys(NAMES).filter((id) => id !== leader);
    const who = others[Math.floor(Math.random() * others.length)];
    const minimum = leader === null ? lot.start : price + lot.inc;
    const amount = minimum + lot.inc * Math.floor(Math.random() * 2);
    if (!force && amount > w.rival * 100) return false;
    if (minimum >= lot.buyNow) return false;
    const r = B.place(lot, who, Math.min(amount, lot.buyNow - 100), now);
    if (!r.ok) return false;
    afterChange(w.id);
    if (isAtelier() && r.outcome !== 'outbid') toast(`Neues Gebot: ${chf(B.compute(lot).price)} auf «${esc(w.title)}»`);
    if (leader === ME && B.compute(lot).leader !== ME) {
      toast(`Jemand hat dich bei «${esc(w.title)}» überboten. <span class="toast-link">Zum Bild</span>`, `#/werk/${w.slug}`);
    } else if (leader === ME && r.outcome === 'outbid') {
      toast(`Bei «${esc(w.title)}» hat jemand geboten. Dein Maximum hat dein Gebot automatisch auf ${chf(B.compute(lot).price)} erhöht, du führst weiterhin. <span class="toast-link">Zum Bild</span>`, `#/werk/${w.slug}`);
    } else if (leader === ME && r.extended) {
      toast(`«${esc(w.title)}» läuft nochmals 5 Minuten.`);
    }
    return true;
  }

  function simulate() {
    const now = Date.now();
    for (const w of WERKE) {
      if (w.mode !== 'auction' || !B.isOpen(lotOf(w), now)) continue;
      if (B.compute(lotOf(w)).leader !== ME) { delete nextRival[w.id]; continue; }
      // Wer führt, hat erst einmal Ruhe: frühestens nach 1,5 bis 5 Minuten kommt jemand, und auch dann nur jedes zweite Mal
      if (!nextRival[w.id]) nextRival[w.id] = now + RIVAL_FIRST_MS + Math.random() * RIVAL_SPREAD_MS;
      if (now >= nextRival[w.id]) {
        nextRival[w.id] = now + RIVAL_AGAIN_MS + Math.random() * RIVAL_SPREAD_MS;
        if (Math.random() < RIVAL_CHANCE) rivalBid(w);
      }
    }
    if (isAtelier() && Math.random() < 1 / 20) atelierPulse(false);
    if (Math.random() < 1 / 45) {
      const pool = activeLotsWithBids().filter((w) => B.compute(lotOf(w)).leader !== ME);
      if (pool.length) rivalBid(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // Mit Ziel ist die ganze Meldung antippbar. Ist ein Dialog offen, zeigt sie sich darin, sonst wäre sie verdeckt und nicht bedienbar.
  function toast(html, href) {
    const box = $('#toasts');
    (sheet.open ? sheet : $('#zoom').open ? $('#zoom') : document.body).append(box);
    const t = document.createElement(href ? 'button' : 'div');
    t.className = href ? 'toast is-link' : 'toast';
    if (href) t.type = 'button';
    t.innerHTML = html;
    if (href) {
      t.addEventListener('click', () => {
        t.remove();
        if (location.hash === href) {
          if (sheet.open) sheet.close();
          if ($('#zoom').open) $('#zoom').close();
          scrollToWork();
          return;
        }
        followedLink = true;
        clickedLink = true;
        location.hash = href;
      });
    }
    box.append(t);
    setTimeout(() => t.remove(), href ? 10000 : 7000);
  }
  // Dialoge ersetzen ihren Inhalt: Die Meldungen ziehen vorher zurück auf die Seite.
  const parkToasts = () => document.body.append($('#toasts'));

  /* ---------- Atelier: Benedikts Übersicht ---------- */

  let atelierDirty = false;
  const isAtelier = () => location.hash.startsWith('#/cockpit');
  let cockpitOpen = false;
  let arrivedByQr = new URLSearchParams(location.search).has('qr');
  let cockpitQuery = '';
  let cockpitOnlyMissing = false;
  const personName = (id) => (id === ME ? (S.me ? S.me.first : 'Du') : NAMES[id] || id);

  function ago(t) {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'gerade eben';
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    return `vor ${Math.round(s / 86400)} Tagen`;
  }

  function atelierEvents() {
    const list = [];
    for (const w of WERKE) {
      if (w.mode !== 'auction') continue;
      const rows = lotOf(w).log.filter((r) => !r.cancelled && r.kind !== 'proxy' && r.kind !== 'recalc');
      rows.forEach((r, i) => list.push({ at: r.at, w, who: r.bidder, amount: r.amount, kind: r.kind === 'buy_now' ? 'bought' : i === 0 ? 'first' : 'bid' }));
    }
    for (const c of S.scans) list.push({ at: c.at, w: byId.get(c.work), kind: 'scan' });
    return list.sort((a, b) => b.at - a.at);
  }

  function feedItem(e, now) {
    const title = `«${esc(e.w.title)}»`;
    const text = {
      first: `Erstes Gebot auf ${title}`,
      bid: `Neues Gebot auf ${title}`,
      bought: `Verkauft: ${title}`,
      scan: `${title} wurde vor Ort gescannt`,
    }[e.kind];
    const meta = e.kind === 'scan' ? ago(e.at) : `${chf(e.amount)} von ${esc(personName(e.who))}, ${ago(e.at)}`;
    return `<li class="${e.kind === 'scan' ? 'is-quiet' : ''}${now - e.at < 6000 ? ' is-new' : ''}"><a href="#/werk/${e.w.slug}">
      <img src="${e.w.img}" alt="">
      <div><div class="what">${text}</div><div class="when">${meta}</div></div></a></li>`;
  }

  function rankItem(w, value, sub, share, toEditor) {
    return `<li><a href="#/${toEditor ? 'cockpit/bild' : 'werk'}/${w.slug}"><img src="${w.img}" alt="" loading="lazy">
      <div>
        <div class="line"><span>${esc(w.title)}</span><b>${value}</b></div>
        ${share === undefined ? '' : `<span class="bar" title="${value}"><i style="width:${Math.max(2, Math.round(share * 100))}%"></i></span>`}
        ${sub ? `<small>${sub}</small>` : ''}
      </div></a></li>`;
  }

  function personEmail(id) {
    const fold = (t) => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/\s+/g, '.');
    return `${fold(personName(id))}@beispiel.ch`;
  }

  // Einnahmen: Was schon verkauft ist, und was dazukäme, wenn jetzt Schluss wäre
  function cockpitMoney() {
    const now = Date.now();
    const open = WERKE.filter((w) => w.mode === 'auction' && B.isOpen(lotOf(w), now));
    const withBids = open.filter((w) => bidCount(lotOf(w)) > 0);
    const sold = WERKE.filter(isSold);
    const revenue = sold.reduce((sum, w) => sum + soldPrice(w), 0);
    const standing = withBids.reduce((sum, w) => sum + B.compute(lotOf(w)).price, 0);
    return { open, withBids, sold, revenue, standing };
  }

  function cockpitShell(tab, body) {
    const tabs = [['', 'Überblick'], ['bilder', 'Bilder'], ['personen', 'Personen'], ['verkaeufe', 'Verkäufe'], ['zahlen', 'Zahlen'], ['qr', 'Druck']];
    return `<div class="cp-head"><h1>Cockpit</h1><button type="button" class="linklike" data-act="cockpit-logout">Abmelden</button></div>
      <nav class="cp-tabs" aria-label="Cockpit">${tabs.map(([id, label]) => `<a href="#/cockpit${id ? '/' + id : ''}"${tab === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      ${body}`;
  }

  function viewCockpitLogin() {
    return `<div class="cp-login"><h1>Cockpit</h1>
      <form class="stack" data-form="cockpit-login">
        <label>Passwort<input type="password" name="password" autocomplete="current-password" required></label>
        <p class="field-error" id="cockpit-error" hidden>Das Passwort stimmt nicht.</p>
        <button class="btn wide">Anmelden</button>
      </form>
      <p class="note">Prototyp: Das Passwort lautet «benedikt» und schützt hier noch nichts. In der echten Anwendung prüft es der Server, dazu kommt ein zweiter Faktor.</p></div>`;
  }

  function viewCockpit(tab = '', arg) {
    if (!cockpitOpen) return viewCockpitLogin();
    if (tab === 'bild') return cockpitShell('bilder', cockpitEditor(arg));
    if (tab === 'bilder') return cockpitShell('bilder', cockpitImages());
    if (tab === 'personen') return cockpitShell('personen', cockpitPeople());
    if (tab === 'verkaeufe') return cockpitShell('verkaeufe', cockpitSales());
    if (tab === 'zahlen') return cockpitShell('zahlen', cockpitNumbers());
    if (tab === 'qr') return cockpitShell('qr', cockpitQr());
    if (tab === 'katalog') return cockpitShell('qr', cockpitCatalog());
    return cockpitShell('', cockpitOverview());
  }

  function cockpitOverview() {
    const now = Date.now();
    const { open, withBids, sold, revenue, standing } = cockpitMoney();
    const events = atelierEvents();
    const bids = events.filter((e) => e.kind === 'first' || e.kind === 'bid');
    const midnight = new Date().setHours(0, 0, 0, 0);
    const hot = [...withBids].sort((a, b) => lastActivity(lotOf(b)) - lastActivity(lotOf(a)));
    const boughtNow = sold.filter((w) => lotOf(w).sold).sort((a, b) => lastActivity(lotOf(b)) - lastActivity(lotOf(a)));
    const shy = open.filter((w) => isShown(w) && bidCount(lotOf(w)) === 0).sort((a, b) => S.views[b.id].total - S.views[a.id].total).slice(0, 4);
    const incomplete = WERKE.filter((w) => missingFields(w).length).length;
    return `${incomplete ? `<a class="cp-todo" href="#/cockpit/bilder" data-act="cp-show-missing"><b>${incomplete} ${incomplete === 1 ? 'Bild braucht' : 'Bilder brauchen'} noch Angaben</b><span>Sie erscheinen erst dann öffentlich.</span></a>` : ''}
    <p class="cp-hello">Hallo Benedikt, heute ${bids.filter((e) => e.at >= midnight).length} Gebote. Noch ${formatLeft(AUCTION_END - now)} bis zum Schluss.</p>
    <section class="cp-money" aria-label="Einnahmen">
      <div><span>Sicher, schon verkauft</span><b>${chf(revenue)}</b><small>${sold.length} ${sold.length === 1 ? 'Bild' : 'Bilder'}</small></div>
      <div><span>Wenn jetzt Schluss wäre</span><b>${chf(revenue + standing)}</b><small>dazu ${withBids.length} Bilder mit Gebot</small></div>
    </section>
    <p class="note cp-note">Einnahmen vor Kosten für Druck und Rahmen, ohne Aufpreise für Passepartout und Rahmen.</p>
    <div class="atelier-grid">
      <section>
        <div class="cp-section-head"><h2>Gerade passiert</h2><button type="button" class="linklike" data-act="demo-pulse">Demo: Gebot auslösen</button></div>
        <ul class="feed">${events.slice(0, 8).map((e) => feedItem(e, now)).join('')}</ul>
      </section>
      <section>
        <h2>Zum Sofortpreis verkauft</h2>
        ${boughtNow.length ? `<ul class="rank">${boughtNow.map((w) => {
          const row = lotOf(w).log.find((r) => r.kind === 'buy_now');
          return rankItem(w, chf(lotOf(w).buyNow), `${esc(personName(row.bidder))}, ${ago(row.at)}`, undefined, true);
        }).join('')}</ul>` : '<p class="note">Noch keines.</p>'}
        <h2>Darauf wird geboten</h2>
        <ul class="rank">${hot.slice(0, 5).map((w) => {
          const { price, leader } = B.compute(lotOf(w));
          return rankItem(w, chf(price), `Es führt ${esc(personName(leader))}`, undefined, true);
        }).join('')}</ul>
        ${shy.length ? `<h2>Viele Blicke, noch kein Gebot</h2>
        <ul class="rank">${shy.map((w) => rankItem(w, S.views[w.id].total, `Aufrufe, Startpreis ${chf(lotOf(w).start)}`, undefined, true)).join('')}</ul>` : ''}
        <p class="proto-note">Prototyp: Namen und Zahlen sind Beispiele.</p>
      </section>
    </div>`;
  }

  function cockpitRow(w) {
    const lot = w.mode === 'auction' ? lotOf(w) : null;
    const missing = missingFields(w);
    const state = w.hidden ? 'Ausgeblendet' : isSold(w) ? '<span class="sold-mark">Verkauft</span>' : !lot ? 'Nur zum Anschauen' : bidCount(lot) ? `${chf(B.compute(lot).price)}, ${bidCount(lot)} Gebote` : 'Noch kein Gebot';
    const title = String(w.title || '').trim() || 'Ohne Namen';
    return `<li data-search="${esc(`${w.number} ${w.title} ${TYPE[w.type]}`.toLowerCase())}"><a href="#/cockpit/bild/${w.slug}"><img src="${w.img}" alt="" loading="lazy">
      <div><div class="line"><span>${w.number}. ${esc(title)}</span></div>
      ${missing.length ? `<small class="cp-missing">Es fehlt: ${missing.join(', ')}</small>` : ''}
      <small>${TYPE[w.type]}, ${sizeText(w)}</small>
      ${missing.length ? '' : `<small>${lot ? `Start ${chf(lot.start)}, Sofort ${chf(lot.buyNow)}. ` : ''}${state}</small>`}</div></a></li>`;
  }

  function cockpitImages() {
    const incomplete = WERKE.filter((w) => missingFields(w).length);
    if (!incomplete.length) cockpitOnlyMissing = false;
    const list = (cockpitOnlyMissing ? incomplete : [...WERKE]).sort((a, b) => (missingFields(b).length ? 1 : 0) - (missingFields(a).length ? 1 : 0) || a.number - b.number);
    return `<p class="note cp-note">Tippe auf ein Bild, um Namen, Preise und Masse zu ändern. Neue Bilder hochladen kommt in der echten Anwendung hierhin.</p>
      <div class="chips cp-filter">
        <button type="button" class="chip" data-act="cp-filter" data-only="0" aria-pressed="${!cockpitOnlyMissing}">Alle (${WERKE.length})</button>
        <button type="button" class="chip" data-act="cp-filter" data-only="1" aria-pressed="${cockpitOnlyMissing}">Fehlende Angaben (${incomplete.length})</button>
      </div>
      <label class="cp-search">Suchen<input type="search" data-act-input="cockpit-search" value="${esc(cockpitQuery)}" placeholder="Name oder Nummer"></label>
      <ul class="rank cp-list" id="cockpit-list">${list.map(cockpitRow).join('')}</ul>`;
  }

  // Maximalgebote eines Bildes. Sie stehen klar getrennt vom Preis, damit sie niemand mit dem aktuellen Gebot verwechselt.
  function cockpitMaxima(lot) {
    const rows = B.standings(lot);
    if (!rows.length) return '';
    const { price, leader } = B.compute(lot);
    return `<section class="cp-maxima">
      <h3>Maximalgebote</h3>
      <p class="note">Nur für dich sichtbar. Das sind Obergrenzen, keine aktuellen Gebote. Der Preis steht bei <strong>${chf(price)}</strong>.</p>
      <ul>${rows.map((e) => `<li><span>${esc(personName(e.bidder))}${e.bidder === leader ? ' <small>führt</small>' : ''}</span><span>Maximum ${chf(e.max)}</span></li>`).join('')}</ul>
    </section>`;
  }

  // Gesamtmass aus Zeichnung und Rand pro Seite. Der Rand zählt oben, unten, links und rechts.
  function frameTotal(height, width, mat, frame) {
    if (!(height > 0 && width > 0)) return 'Das Gesamtmass erscheint, sobald Höhe und Breite eingetragen sind.';
    const m = mat > 0 ? mat : 0, f = frame > 0 ? frame : 0;
    const size = (edge) => `<strong>${cm(height + 2 * edge)} × ${cm(width + 2 * edge)} cm</strong>`;
    return `Gesamtmass mit Passepartout: ${size(m)}. Mit Rahmen: ${size(m + f)}.`;
  }

  function cockpitEditor(slug) {
    const w = WERKE.find((x) => x.slug === slug);
    if (!w) return '<p>Dieses Bild gibt es nicht.</p>';
    const lot = w.mode === 'auction' ? lotOf(w) : null;
    const locked = lot && bidCount(lot) > 0;
    const views = S.views[w.id];
    const lock = locked ? 'disabled' : '';
    const money = (r) => (r === undefined || r === null ? '' : r);
    const missing = missingFields(w);
    const miss = (name) => (missing.includes(name) ? 'class="is-missing"' : '');
    return `<a class="back" href="#/cockpit/bilder">Zu allen Bildern</a>
      ${missing.length ? `<p class="cp-todo cp-todo-static"><b>Es fehlt noch: ${missing.join(', ')}</b><span>Erst dann erscheint das Bild öffentlich.</span></p>` : ''}
      <div class="cp-editor">
        <div><img class="cp-editor-img" src="${w.img}" alt="">
          <dl class="facts cp-facts">
            <dt>Per QR-Code</dt><dd>${views.qr} Aufrufe</dd>
            <dt>Aus der Galerie</dt><dd>${views.total - views.qr} Aufrufe</dd>
            <dt>Gebote</dt><dd>${lot ? bidCount(lot) : 0}</dd>
            ${siblingOf(w) ? `<dt>Gleicher Titel</dt><dd><a href="#/cockpit/bild/${siblingOf(w).slug}">Nr. ${siblingOf(w).number}, ${SIBLING_LABEL[siblingOf(w).type]}</a></dd>` : ''}
            ${lot && B.compute(lot).leader ? `<dt>${isSold(w) ? 'Käufer' : 'Es führt'}</dt><dd>${esc(personName(B.compute(lot).leader))}, ${chf(B.compute(lot).price)}</dd>` : ''}
          </dl>
          ${lot ? cockpitMaxima(lot) : ''}
          <p><a href="#/werk/${w.slug}">Öffentliche Seite ansehen</a></p>
          <section class="qr-single">
            <h3>QR-Code zu diesem Bild</h3>
            <div class="qr-single-row">
              <div class="qr-single-code">${qrSvg(qrUrl(w))}</div>
              <div class="stack">
                <label>Grösse in cm<input type="number" id="qr-single-size" min="1" max="30" step="0.5" value="4"></label>
                <label class="check"><input type="checkbox" id="qr-single-label" checked> <span>Mit Nummer und Name</span></label>
              </div>
            </div>
            <div class="qr-buttons">
              <button type="button" class="btn ghost" data-act="qr-png" data-work="${w.id}">Als PNG speichern</button>
              <button type="button" class="btn ghost" data-act="qr-svg" data-work="${w.id}">Als SVG speichern</button>
            </div>
          </section>
        </div>
        <form class="stack cp-form" data-form="work-edit" data-work="${w.id}">
          <label ${miss('Name')}>Name<input type="text" name="title" value="${esc(w.title)}"></label>
          ${w.type !== 'print_aluminium' ? `<label>Werktyp<select name="type">
            <option value="original" ${w.type === 'original' ? 'selected' : ''}>${TYPE.original}</option>
            <option value="original_framed" ${w.type === 'original_framed' ? 'selected' : ''}>${TYPE.original_framed}</option></select></label>` : `<p class="note">${TYPE[w.type]}</p>`}
          <div class="cp-two">
            <label ${miss('Masse')}>Höhe in cm<input type="number" name="height" min="1" step="0.1" value="${w.sizeCm[0] || ''}"></label>
            <label ${miss('Masse')}>Breite in cm<input type="number" name="width" min="1" step="0.1" value="${w.sizeCm[1] || ''}"></label>
          </div>
          <label ${miss('Technik')}>Technik<input type="text" name="technique" value="${esc(w.technique)}"></label>
          ${isOriginal(w) ? `<div class="cp-two">
            <label>Passepartout-Rand pro Seite in cm<input type="number" name="matCm" min="0" max="40" step="0.5" value="${matCm(w)}" required></label>
            <label>Rahmenleiste pro Seite in cm<input type="number" name="frameCm" min="0" max="20" step="0.1" value="${frameCm(w)}" required></label>
          </div>
          <p class="note cp-frame-total" id="cp-frame-total" aria-live="polite">${frameTotal(w.sizeCm[0], w.sizeCm[1], matCm(w), frameCm(w))}</p>
          <label class="check"><input type="checkbox" name="applyAll"> <span>Diese beiden Randmasse für alle Zeichnungen übernehmen</span></label>` : ''}
          ${lot ? `<div class="cp-two">
            <label ${miss('Startpreis')}>Startpreis in CHF<input type="number" name="start" min="1" step="1" value="${money(w.start)}" ${lock}></label>
            <label ${miss('Sofortpreis')}>Sofortpreis in CHF<input type="number" name="buyNow" min="1" step="1" value="${money(w.buyNow)}" ${lock}></label>
          </div>
          <label ${miss('Bietschritt')}>Bietschritt in CHF<input type="number" name="inc" min="1" step="1" value="${money(w.inc)}" ${lock}></label>
          ${locked ? '<p class="note">Sobald jemand geboten hat, bleiben die Preise fest. Das ist fair gegenüber den Bietenden.</p>' : ''}` : ''}
          <label class="check"><input type="checkbox" name="visible" ${w.hidden ? '' : 'checked'}> <span>In der Galerie zeigen</span></label>
          <p class="field-error" id="edit-error" hidden></p>
          <button class="btn wide">Speichern</button>
        </form>
      </div>`;
  }

  function cockpitPeople() {
    const now = Date.now();
    const people = new Map();
    const get = (id) => {
      if (!people.has(id)) people.set(id, { id, bids: 0, items: new Map() });
      return people.get(id);
    };
    for (const w of WERKE) {
      if (w.mode !== 'auction') continue;
      const lot = lotOf(w);
      for (const r of lot.log) {
        if (r.cancelled || (r.kind !== 'manual' && r.kind !== 'buy_now')) continue;
        const p = get(r.bidder);
        p.bids += 1;
        p.items.set(w.id, w);
      }
    }
    const rows = [...people.values()].map((p) => {
      const items = [...p.items.values()].map((w) => {
        const { price, leader } = B.compute(lotOf(w));
        const open = B.isOpen(lotOf(w), now);
        const state = leader !== p.id ? 'überboten' : open ? 'führt' : 'gekauft';
        return { w, price, state };
      });
      const leading = items.filter((i) => i.state === 'führt');
      const won = items.filter((i) => i.state === 'gekauft');
      const value = [...leading, ...won].reduce((sum, i) => sum + i.price, 0);
      return { p, items, leading, won, value };
    }).sort((a, b) => b.value - a.value || b.p.bids - a.p.bids);
    return `<p class="note cp-note">${rows.length} Personen haben geboten. Namen und Maximalgebote siehst nur du. Das Maximalgebot ist die Obergrenze einer Person, gezahlt wird nur der Preis.</p>
      <div class="cp-people">${rows.map(({ p, items, leading, won, value }) => `<details>
        <summary><span><b>${esc(personName(p.id))}</b><small>${p.bids} ${p.bids === 1 ? 'Gebot' : 'Gebote'}${leading.length ? `, führt bei ${leading.length}` : ''}${won.length ? `, ${won.length} gekauft` : ''}</small></span><b>${value ? chf(value) : ''}</b></summary>
        <p class="cp-mail"><a href="mailto:${personEmail(p.id)}">${personEmail(p.id)}</a></p>
        <ul class="history cp-person-items">${items.map((i) => {
          const max = B.ownMax(lotOf(i.w), p.id);
          return `<li><span><a href="#/cockpit/bild/${i.w.slug}">${esc(i.w.title)}</a>, ${i.state}${max !== null ? `<small class="cp-max-label">Maximalgebot ${chf(max)}</small>` : ''}</span><span>Preis ${chf(i.price)}</span></li>`;
        }).join('')}</ul>
      </details>`).join('')}</div>`;
  }

  // Verlauf des Gebotsstands: Jedes Gebot ersetzt den bisherigen Preis seines Bildes
  function standingSeries() {
    const rows = [];
    for (const w of WERKE) {
      if (w.mode !== 'auction') continue;
      lotOf(w).log.filter((r) => !r.cancelled).forEach((r) => rows.push({ at: r.at, id: w.id, amount: r.amount }));
    }
    rows.sort((a, b) => a.at - b.at);
    const current = new Map();
    let total = 0;
    return rows.map((r) => {
      total += r.amount - (current.get(r.id) || 0);
      current.set(r.id, r.amount);
      return { at: r.at, total };
    });
  }

  const shortDate = (t) => new Date(t).toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' });
  let salesPoints = [];

  function salesLineChart(series) {
    const W = 640, H = 200, left = 8, right = 8, top = 16, bottom = 24;
    if (series.length < 2) return '<p class="note">Sobald mehr Gebote da sind, erscheint hier der Verlauf.</p>';
    const now = Date.now();
    const t0 = series[0].at, t1 = Math.max(now, series[series.length - 1].at);
    const max = series[series.length - 1].total > 0 ? Math.max(...series.map((p) => p.total)) : 1;
    const x = (t) => left + (t - t0) / Math.max(1, t1 - t0) * (W - left - right);
    const y = (v) => top + (1 - v / max) * (H - top - bottom);
    const points = [...series, { at: t1, total: series[series.length - 1].total }];
    salesPoints = points.map((p) => ({ x: x(p.at), y: y(p.total), label: `${shortDate(p.at)}: ${chf(p.total)}` }));
    let line = `M${x(points[0].at).toFixed(1)} ${y(points[0].total).toFixed(1)}`;
    for (let i = 1; i < points.length; i++) line += `H${x(points[i].at).toFixed(1)}V${y(points[i].total).toFixed(1)}`;
    const area = `${line}V${H - bottom}H${x(t0).toFixed(1)}Z`;
    const last = salesPoints[salesPoints.length - 1];
    return `<div class="sales-chart" data-chart="sales">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stand aller Gebote im Zeitverlauf, aktuell ${chf(points[points.length - 1].total)}">
        <line x1="${left}" x2="${W - right}" y1="${H - bottom}" y2="${H - bottom}" class="sales-axis"/>
        <path d="${area}" class="sales-area"/>
        <path d="${line}" class="sales-line"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" class="sales-dot"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" class="sales-hover" hidden/>
        <text x="${left}" y="${H - 7}" class="sales-tick">${shortDate(t0)}</text>
        <text x="${W - right}" y="${H - 7}" text-anchor="end" class="sales-tick">heute</text>
      </svg>
      <div class="sales-tip" hidden></div>
    </div>`;
  }

  function salesBars() {
    const day = 86400000;
    const today = new Date().setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => ({ start: today - (6 - i) * day, n: 0 }));
    for (const e of atelierEvents()) {
      if (e.kind !== 'first' && e.kind !== 'bid' && e.kind !== 'bought') continue;
      const hit = days.find((d) => e.at >= d.start && e.at < d.start + day);
      if (hit) hit.n += 1;
    }
    const max = Math.max(1, ...days.map((d) => d.n));
    return `<div class="sales-bars">${days.map((d) => `<div class="sales-bar" title="${shortDate(d.start)}: ${d.n} ${d.n === 1 ? 'Gebot' : 'Gebote'}">
      <span class="sales-bar-n">${d.n || ''}</span>
      <i style="height:${d.n ? Math.max(4, Math.round(d.n / max * 100)) : 0}%"></i>
      <span class="sales-bar-day">${shortDate(d.start)}</span></div>`).join('')}</div>`;
  }

  function salesByType() {
    const groups = [
      ['Bildtafeln', (w) => w.type === 'print_aluminium'],
      ['Zeichnungen', (w) => w.type === 'original'],
      ['Gerahmte Zeichnungen', (w) => w.type === 'original_framed'],
    ].map(([label, test]) => {
      const list = WERKE.filter((w) => test(w) && w.mode === 'auction');
      const sold = list.filter(isSold);
      const sum = sold.reduce((t, w) => t + soldPrice(w), 0);
      const open = list.filter((w) => !isSold(w) && bidCount(lotOf(w)) > 0).reduce((t, w) => t + B.compute(lotOf(w)).price, 0);
      return { label, sold: sold.length, n: list.length, sum, open };
    });
    const max = Math.max(1, ...groups.map((g) => g.sum + g.open));
    return `<ul class="sales-types">${groups.map((g) => `<li>
        <div class="line"><span>${g.label}</span><b>${chf(g.sum + g.open)}</b></div>
        <span class="sales-stack" title="${chf(g.sum)} verkauft, ${chf(g.open)} aktuelle Gebote"><i class="is-sold" style="width:${(g.sum / max * 100).toFixed(1)}%"></i><i class="is-open" style="width:${(g.open / max * 100).toFixed(1)}%"></i></span>
        <small>${g.sold} von ${g.n} verkauft</small>
      </li>`).join('')}</ul>
      <p class="sales-legend"><span><i class="is-sold"></i>Verkauft</span><span><i class="is-open"></i>Aktuelle Gebote</span></p>`;
  }

  function cockpitSales() {
    const { open, withBids, sold, revenue, standing } = cockpitMoney();
    const auctions = WERKE.filter((w) => w.mode === 'auction');
    const priced = [...withBids, ...sold];
    const average = priced.length ? priced.reduce((t, w) => t + B.compute(lotOf(w)).price, 0) / priced.length : 0;
    const best = [...priced].sort((a, b) => B.compute(lotOf(b)).price - B.compute(lotOf(a)).price)[0];
    const series = standingSeries();
    return `<section class="stats" aria-label="Kennzahlen">
        <div class="stat"><b>${chf(revenue)}</b><span>verkauft, ${sold.length} von ${auctions.length} Bildern</span></div>
        <div class="stat"><b>${chf(revenue + standing)}</b><span>wenn jetzt Schluss wäre</span></div>
        <div class="stat"><b>${chf(Math.round(average / 100) * 100)}</b><span>durchschnittlicher Preis</span></div>
        <div class="stat"><b>${withBids.length}</b><span>weitere Bilder mit Gebot, ${open.length - withBids.length} noch ohne</span></div>
      </section>
      ${best ? `<a class="sales-best" href="#/cockpit/bild/${best.slug}"><img src="${best.img}" alt="">
        <div><small>Am höchsten im Moment</small><b>${esc(best.title)}</b><span>${chf(B.compute(lotOf(best)).price)}, ${bidCount(lotOf(best))} ${bidCount(lotOf(best)) === 1 ? 'Gebot' : 'Gebote'}</span></div></a>` : ''}
      <h2>Gebotssumme im Verlauf</h2>
      <p class="sub-note">Summe aller aktuellen Gebote und Verkäufe.</p>
      ${salesLineChart(series)}
      <div class="atelier-grid">
        <section><h2>Gebote pro Tag</h2>${salesBars()}</section>
        <section><h2>Nach Art</h2>${salesByType()}</section>
      </div>
      <p class="proto-note">Prototyp: Die Zahlen sind Beispiele. Einnahmen vor Kosten für Druck und Rahmen.</p>`;
  }

  const RANK_START = 6, RANK_STEP = 10;
  const rankShown = { qr: RANK_START, gallery: RANK_START };

  function cockpitNumbers() {
    const gallery = (w) => S.views[w.id].total - S.views[w.id].qr;
    const qr = (w) => S.views[w.id].qr;
    const sumOf = (fn, list = WERKE) => list.reduce((sum, w) => sum + fn(w), 0);
    const top = (fn, key) => {
      const all = WERKE.filter(isShown).sort((a, b) => fn(b) - fn(a));
      const shown = Math.min(rankShown[key], all.length);
      const list = all.slice(0, shown);
      const max = fn(list[0]) || 1;
      const more = Math.min(RANK_STEP, all.length - shown);
      return `<ul class="rank">${list.map((w) => rankItem(w, fn(w), '', fn(w) / max, true)).join('')}</ul>
        <div class="rank-more">
          <span>${shown} von ${all.length}</span>
          ${more ? `<button type="button" class="chip" data-act="rank-more" data-list="${key}" data-show="${shown + more}">${more} weitere</button>` : ''}
          ${more ? `<button type="button" class="chip" data-act="rank-more" data-list="${key}" data-show="${all.length}">Alle</button>` : ''}
          ${shown > RANK_START ? `<button type="button" class="chip" data-act="rank-more" data-list="${key}" data-show="${RANK_START}">Weniger</button>` : ''}
        </div>`;
    };
    const group = (test) => {
      const list = WERKE.filter(test);
      const auction = list.filter((w) => w.mode === 'auction');
      const bidded = auction.filter((w) => bidCount(lotOf(w)) > 0);
      const money = auction.filter((w) => bidCount(lotOf(w)) > 0).reduce((sum, w) => sum + B.compute(lotOf(w)).price, 0);
      return { n: list.length, bidded: bidded.length, money };
    };
    const prints = group((w) => w.type === 'print_aluminium');
    const drawings = group((w) => w.type !== 'print_aluminium');
    return `<section class="stats" aria-label="Aufrufe">
        <div class="stat"><b>${sumOf(qr).toLocaleString('de-CH')}</b><span>Aufrufe per QR-Code vor Ort</span></div>
        <div class="stat"><b>${sumOf(gallery).toLocaleString('de-CH')}</b><span>Aufrufe aus der Galerie</span></div>
        <div class="stat"><b>${prints.bidded} von ${prints.n}</b><span>Bildtafeln mit Gebot, ${chf(prints.money)}</span></div>
        <div class="stat"><b>${drawings.bidded} von ${drawings.n}</b><span>Zeichnungen mit Gebot, ${chf(drawings.money)}</span></div>
      </section>
      <div class="atelier-grid">
        <section><h2>Vor Ort am meisten gescannt</h2>${top(qr, 'qr')}</section>
        <section><h2>In der Galerie am meisten angeschaut</h2>${top(gallery, 'gallery')}</section>
      </div>
      <p class="proto-note">Die Aufrufe sind nur Zahlen pro Bild. Wer etwas angeschaut hat, wird nicht gespeichert.</p>`;
  }

  // Im Atelier läuft die Demo lebhafter: Gebote und Scans treffen laufend ein.
  function atelierPulse(forceBid) {
    const open = WERKE.filter((w) => w.mode === 'auction' && B.isOpen(lotOf(w), Date.now()));
    const w = open[Math.floor(Math.random() * open.length)];
    if (forceBid || Math.random() < 0.35) {
      const pool = open.filter((x) => bidCount(lotOf(x)) > 0).sort(() => Math.random() - 0.5);
      for (const x of pool) if (rivalBid(x, forceBid)) return;
      return;
    }
    S.views[w.id].total += 1;
    S.views[w.id].qr += 1;
    S.scans.unshift({ work: w.id, at: Date.now() });
    S.scans.length = Math.min(S.scans.length, 20);
    save();
    atelierDirty = true;
  }

  /* ---------- Zoom ---------- */

  // Das Bild passt zuerst ganz auf den Bildschirm. Tippen zoomt, zwei Finger zoomen frei, ein Finger verschiebt.
  function openZoom(src) {
    parkToasts();
    const dialog = $('#zoom');
    dialog.innerHTML = `<button type="button" class="zoom-close" data-act="close-zoom">Schliessen</button>
      <img src="${src}" alt="" draggable="false"><p class="zoom-hint">Tippen oder mit zwei Fingern zoomen</p>`;
    dialog.showModal();
    const img = $('img', dialog);
    const hint = $('.zoom-hint', dialog);
    const view = { s: 1, x: 0, y: 0 };
    const pointers = new Map();
    let gesture = null;

    const apply = () => {
      const r = dialog.getBoundingClientRect();
      view.s = Math.min(5, Math.max(1, view.s));
      view.x = Math.min(0, Math.max(r.width * (1 - view.s), view.x));
      view.y = Math.min(0, Math.max(r.height * (1 - view.s), view.y));
      img.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
      img.style.cursor = view.s > 1 ? 'zoom-out' : 'zoom-in';
    };
    const zoomAt = (scale, cx, cy) => {
      const next = Math.min(5, Math.max(1, scale));
      view.x = cx - (cx - view.x) * next / view.s;
      view.y = cy - (cy - view.y) * next / view.s;
      view.s = next;
      apply();
    };
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };

    img.addEventListener('pointerdown', (e) => {
      img.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hint.hidden = true;
      gesture = pointers.size === 2
        ? { pinch: true, start: spread(), s: view.s }
        : { pinch: false, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, t: Date.now(), moved: false };
    });
    img.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId) || !gesture) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesture.pinch && pointers.size === 2) {
        const now = spread();
        zoomAt(gesture.s * now.d / gesture.start.d, now.cx, now.cy);
      } else if (!gesture.pinch) {
        const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
        if (Math.hypot(dx, dy) > 8) gesture.moved = true;
        view.x = gesture.vx + dx;
        view.y = gesture.vy + dy;
        apply();
      }
    });
    const end = (e) => {
      const tap = gesture && !gesture.pinch && !gesture.moved && Date.now() - gesture.t < 350;
      pointers.delete(e.pointerId);
      if (pointers.size < 2 && gesture && gesture.pinch) gesture = null;
      if (tap) {
        if (view.s > 1) { view.s = 1; view.x = 0; view.y = 0; apply(); } else zoomAt(2.5, e.clientX, e.clientY);
      }
    };
    img.addEventListener('pointerup', end);
    img.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
    img.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomAt(view.s * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX, e.clientY);
    }, { passive: false });
  }

  /* ---------- QR-Codes ---------- */

  // Die Nummer bleibt fest, auch wenn sich Name oder Preis ändern. Gedruckte Codes bleiben so immer gültig.
  const qrUrl = (w) => `${location.origin}${location.pathname}?qr=1#/werk/${w.slug}`;

  function qrMatrix(text) {
    const code = window.qrcode(0, 'M');
    code.addData(text);
    code.make();
    return code;
  }

  // Als Vektor mit der vorgeschriebenen Ruhezone von vier Modulen: bleibt in jeder Grösse scharf
  function qrSvg(text, attrs = '') {
    const code = qrMatrix(text);
    const n = code.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges" ${attrs}><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  const QR_GRID = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3], 8: [2, 4], 10: [2, 5], 12: [3, 4], 15: [3, 5], 20: [4, 5], 24: [4, 6] };

  function qrWorks() {
    const q = S.qr;
    return [...WERKE].sort((a, b) => a.number - b.number).filter((w) =>
      w.mode === 'auction' && w.number >= q.from && w.number <= q.to &&
      (q.kind === 'all' || (q.kind === 'print') === (w.type === 'print_aluminium')));
  }

  // Passt der Code in die Zelle? Text und Bild nehmen Platz weg, A4 mit 10 mm Rand
  function qrLayout() {
    const q = S.qr;
    const [cols, rows] = QR_GRID[q.perPage] || QR_GRID[12];
    const cellW = 190 / cols, cellH = 277 / rows;
    const textMm = (q.number ? 5 : 0) + (q.title ? 9 : 0) + (q.hint ? 5 : 0);
    const imageMm = q.image ? Math.max(0, cellH * 0.62 - textMm) : 0;
    const maxMm = Math.max(5, Math.min(cellW - 8, cellH - 8 - textMm - imageMm));
    return { cols, rows, cellW, cellH, imageMm, maxMm, codeMm: Math.min(q.size * 10, maxMm) };
  }

  function qrLabel(w, layout) {
    const q = S.qr;
    return `<div class="qr-cell${q.cut ? ' has-cut' : ''}">
      ${q.image ? `<img class="qr-cell-img" src="${w.img}" alt="" style="height:${layout.imageMm.toFixed(1)}mm">` : ''}
      <div class="qr-cell-code" style="width:${layout.codeMm.toFixed(1)}mm;height:${layout.codeMm.toFixed(1)}mm">${qrSvg(qrUrl(w))}</div>
      ${q.number ? `<div class="qr-cell-num">Nr. ${w.number}</div>` : ''}
      ${q.title ? `<div class="qr-cell-title">${esc(w.title)}</div>` : ''}
      ${q.hint ? '<div class="qr-cell-hint">Scannen und mitbieten</div>' : ''}
    </div>`;
  }

  // Schnittmarken im Seitenrand, auf der Höhe jeder Trennlinie. Sie bleiben im Bereich, den Drucker noch erreichen.
  function qrMarks(layout) {
    const lines = [];
    for (let c = 0; c <= layout.cols; c++) {
      const x = (10 + c * layout.cellW).toFixed(2);
      lines.push(`M${x} 4V9`, `M${x} 288V293`);
    }
    for (let r = 0; r <= layout.rows; r++) {
      const y = (10 + r * layout.cellH).toFixed(2);
      lines.push(`M4 ${y}H9`, `M201 ${y}H206`);
    }
    return `<svg class="qr-marks" viewBox="0 0 210 297" aria-hidden="true"><path d="${lines.join('')}" fill="none" stroke="#000" stroke-width=".2"/></svg>`;
  }

  function qrPages(limit) {
    const layout = qrLayout();
    const marks = S.qr.marks ? qrMarks(layout) : '';
    const works = qrWorks();
    const each = layout.cols * layout.rows;
    const pages = [];
    for (let i = 0; i < works.length && (!limit || pages.length < limit); i += each) {
      pages.push(`<div class="qr-page" style="grid-template-columns:repeat(${layout.cols},${layout.cellW.toFixed(2)}mm);grid-template-rows:repeat(${layout.rows},${layout.cellH.toFixed(2)}mm)">${marks}${works.slice(i, i + each).map((w) => qrLabel(w, layout)).join('')}</div>`);
    }
    return pages;
  }

  function qrSummary() {
    const layout = qrLayout();
    const n = qrWorks().length;
    const each = layout.cols * layout.rows;
    const pages = Math.ceil(n / each);
    const notes = [`${n} ${n === 1 ? 'Code' : 'Codes'} auf ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}.`];
    if (S.qr.size * 10 > layout.maxMm + 0.01) notes.push(`In dieser Einteilung passen höchstens ${(layout.maxMm / 10).toFixed(1)} cm, die Codes werden entsprechend kleiner.`);
    if (layout.codeMm < 20) notes.push('Unter 2 cm wird das Scannen unsicher, vor allem bei wenig Licht.');
    return notes.join(' ');
  }

  function refreshQr() {
    const summary = $('#qr-summary');
    const preview = $('#qr-preview');
    if (summary) summary.textContent = qrSummary();
    if (preview) {
      preview.innerHTML = qrPages(1)[0] || '<p class="note">Für diese Auswahl gibt es keine Bilder.</p>';
      fitQrPreview();
    }
  }

  function fitQrPreview() {
    const preview = $('#qr-preview');
    if (preview) $$('.qr-page', preview).forEach((page) => { page.style.zoom = String(Math.min(1, (preview.clientWidth - 24) / 794)); });
  }

  function cockpitQr() {
    const q = S.qr;
    const box = (key, label) => `<label class="check"><input type="checkbox" data-qr="${key}" ${q[key] ? 'checked' : ''}> <span>${label}</span></label>`;
    const option = (value, label, current) => `<option value="${value}" ${String(current) === String(value) ? 'selected' : ''}>${label}</option>`;
    return `${printSwitch('qr')}<p class="note cp-note">Alle Codes für den Ordner vor Ort in einem Durchgang. Jeder Code führt direkt zum Bild und bleibt gültig, auch wenn du Name oder Preis änderst.</p>
      <div class="chips qr-presets">
        <button type="button" class="chip" data-act="qr-preset" data-preset="folder">Ordnerseiten: Bild und Code</button>
        <button type="button" class="chip" data-act="qr-preset" data-preset="sheet">Etikettenbogen zum Schneiden</button>
      </div>
      <div class="qr-layout">
        <form class="stack cp-form qr-settings" onsubmit="return false">
          <div class="cp-two">
            <label>Grösse in cm<input type="number" data-qr="size" min="1" max="18" step="0.5" value="${q.size}"></label>
            <label>Pro A4-Seite<select data-qr="perPage">${Object.keys(QR_GRID).map((n) => option(n, n, q.perPage)).join('')}</select></label>
          </div>
          <label>Welche Bilder<select data-qr="kind">${option('all', 'Alle zum Bieten', q.kind)}${option('print', 'Nur Bildtafeln', q.kind)}${option('drawing', 'Nur Zeichnungen', q.kind)}</select></label>
          <div class="cp-two">
            <label>Von Nummer<input type="number" data-qr="from" min="1" step="1" value="${q.from}"></label>
            <label>Bis Nummer<input type="number" data-qr="to" min="1" step="1" value="${q.to}"></label>
          </div>
          <div class="qr-boxes">${box('number', 'Nummer')}${box('title', 'Name')}${box('hint', '«Scannen und mitbieten»')}${box('image', 'Bild dazu')}${box('cut', 'Schnittlinien')}${box('marks', 'Schnittmarken am Seitenrand')}</div>
          <p class="note" id="qr-summary">${qrSummary()}</p>
          <button type="button" class="btn wide" data-act="qr-print">Alle drucken</button>
          <p class="proto-note">Im Druckdialog «Tatsächliche Grösse» oder 100 % wählen, sonst stimmen die Masse nicht. Vorher eine Seite ausdrucken und mit dem Handy testen.</p>
        </form>
        <div><p class="qr-preview-title">Vorschau Seite 1</p><div class="qr-preview" id="qr-preview">${qrPages(1)[0] || ''}</div></div>
      </div>`;
  }

  /* ---------- Katalog drucken ---------- */

  const printSwitch = (current) => `<div class="chips cp-filter">
      <a class="chip" href="#/cockpit/qr" aria-pressed="${current === 'qr'}">QR-Codes</a>
      <a class="chip" href="#/cockpit/katalog" aria-pressed="${current === 'cat'}">Katalog</a>
    </div>`;

  const CAT_GRID = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3], 9: [3, 3], 12: [3, 4] };

  function catWorks() {
    const c = S.cat;
    const rank = (w) => (c.order === 'number' ? w.number : matchGroup(w) === 'pencil' ? 1e6 + w.number : harmonyOrder().get(w.id));
    return WERKE.filter((w) => isShown(w) && (c.kind === 'all' || (c.kind === 'print') === (w.type === 'print_aluminium')))
      .sort((a, b) => rank(a) - rank(b));
  }

  function catCell(w) {
    const c = S.cat;
    const head = [c.number ? `<b>${w.number}</b>` : '', c.title ? esc(w.title) : ''].filter(Boolean).join(' ');
    const lines = [];
    if (c.size) lines.push(`${TYPE[w.type]}, ${sizeText(w)}`);
    if (c.technique) lines.push(esc(w.technique));
    if (isSold(w)) lines.push('<span class="sold-mark">Verkauft</span>');
    else if (w.mode === 'not_for_sale') lines.push('Nur zum Anschauen');
    else {
      const prices = [c.start ? `Start ${chf(w.start * 100)}` : '', c.buy ? `Sofort ${chf(w.buyNow * 100)}` : ''].filter(Boolean);
      if (prices.length) lines.push(prices.join(', '));
    }
    return `<div class="cat-cell">
      <div class="cat-img"><img src="${w.img}" alt=""></div>
      <div class="cat-meta">
        ${c.qr && w.mode === 'auction' && !isSold(w) ? `<div class="cat-qr">${qrSvg(qrUrl(w))}</div>` : ''}
        <div class="cat-text">${head ? `<div class="cat-head">${head}</div>` : ''}${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      </div>
    </div>`;
  }

  function catPages(limit) {
    const c = S.cat;
    const [cols, rows] = CAT_GRID[c.perPage] || CAT_GRID[4];
    const each = cols * rows;
    const works = catWorks();
    const pages = [];
    const total = Math.ceil(works.length / each) + (c.cover ? 1 : 0);
    if (c.cover) {
      const hero = works.find((w) => w.type === 'print_aluminium') || works[0];
      pages.push(`<div class="qr-page cat-page cat-cover">
        ${hero ? `<div class="cat-cover-img"><img src="${hero.img}" alt=""></div>` : ''}
        <h1>${esc(c.heading)}</h1><p>${esc(c.subheading)}</p>
      </div>`);
    }
    for (let i = 0; i < works.length && (!limit || pages.length < limit); i += each) {
      const number = pages.length + 1;
      const density = each <= 2 ? 'cat-few' : each >= 9 ? 'cat-many' : '';
      pages.push(`<div class="qr-page cat-page cat-grid ${density} ${c.cellBox ? 'cat-boxed' : ''}" style="grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr))">
        ${works.slice(i, i + each).map(catCell).join('')}
        ${c.pages ? `<span class="cat-number">${number} / ${total}</span>` : ''}
      </div>`);
    }
    return pages;
  }

  function catSummary() {
    const n = catWorks().length;
    const each = (CAT_GRID[S.cat.perPage] || CAT_GRID[4]).reduce((a, b) => a * b, 1);
    const total = Math.ceil(n / each) + (S.cat.cover ? 1 : 0);
    return `${n} Bilder auf ${total} Seiten. Noch unvollständige Bilder fehlen im Katalog.`;
  }

  function refreshCatalog() {
    const summary = $('#cat-summary');
    const preview = $('#qr-preview');
    if (summary) summary.textContent = catSummary();
    if (preview) {
      preview.innerHTML = catPages(2).join('') || '<p class="note">Für diese Auswahl gibt es keine Bilder.</p>';
      fitQrPreview();
    }
  }

  function cockpitCatalog() {
    const c = S.cat;
    const box = (key, label) => `<label class="check"><input type="checkbox" data-cat="${key}" ${c[key] ? 'checked' : ''}> <span>${label}</span></label>`;
    const option = (value, label, current) => `<option value="${value}" ${String(current) === String(value) ? 'selected' : ''}>${label}</option>`;
    return `${printSwitch('cat')}<p class="note cp-note">Ein druckfertiger Katalog aller Bilder, zum Beispiel für den Ordner vor Ort.</p>
      <div class="chips qr-presets">
        <button type="button" class="chip" data-act="cat-preset" data-preset="large">Gross: 1 Bild pro Seite</button>
        <button type="button" class="chip" data-act="cat-preset" data-preset="overview">Übersicht: 9 pro Seite</button>
      </div>
      <div class="qr-layout">
        <form class="stack cp-form qr-settings" onsubmit="return false">
          <div class="cp-two">
            <label>Bilder pro Seite<select data-cat="perPage">${Object.keys(CAT_GRID).map((n) => option(n, n, c.perPage)).join('')}</select></label>
            <label>Reihenfolge<select data-cat="order">${option('harmony', 'Harmonie', c.order)}${option('number', 'Nummer', c.order)}</select></label>
          </div>
          <label>Welche Bilder<select data-cat="kind">${option('all', 'Alle', c.kind)}${option('print', 'Nur Bildtafeln', c.kind)}${option('drawing', 'Nur Zeichnungen', c.kind)}</select></label>
          <label>Titel<input type="text" data-cat="heading" value="${esc(c.heading)}"></label>
          <label>Untertitel<input type="text" data-cat="subheading" value="${esc(c.subheading)}"></label>
          <div class="qr-boxes">${box('cover', 'Deckblatt')}${box('number', 'Nummer')}${box('title', 'Name')}${box('size', 'Werktyp und Masse')}${box('technique', 'Technik')}${box('start', 'Startpreis')}${box('buy', 'Sofortpreis')}${box('qr', 'QR-Code')}${box('pages', 'Seitenzahlen')}${box('cellBox', 'Feine Linie um jedes Bild')}</div>
          <p class="note" id="cat-summary">${catSummary()}</p>
          <button type="button" class="btn wide" data-act="cat-print">Katalog drucken</button>
          <p class="proto-note">Für ein PDF im Druckdialog «Als PDF speichern» wählen. Gedruckte Preise können überholt sein, wenn du sie später änderst.</p>
        </form>
        <div><p class="qr-preview-title">Vorschau der ersten Seiten</p><div class="qr-preview" id="qr-preview">${catPages(2).join('')}</div></div>
      </div>`;
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const qrFileName = (w, ext) => `qr-${w.slug}-${w.title.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.${ext}`;

  function singleQrOptions() {
    const size = Math.min(30, Math.max(1, Number($('#qr-single-size').value) || 4));
    return { size, label: $('#qr-single-label').checked };
  }

  function exportQrSvg(w) {
    const { size, label } = singleQrOptions();
    const svg = qrSvg(qrUrl(w), `width="${size}cm" height="${size}cm"`);
    if (!label) return downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), qrFileName(w, 'svg'));
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const n = qrMatrix(qrUrl(w)).getModuleCount() + 8;
    const extra = n * 0.2;
    const text = `Nr. ${w.number}, ${esc(w.title)}`;
    const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n + extra}" width="${size}cm" height="${(size * (n + extra) / n).toFixed(2)}cm" shape-rendering="crispEdges">${inner}<rect y="${n}" width="${n}" height="${extra}" fill="#fff"/><text x="${n / 2}" y="${n + extra * 0.55}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${(n * 0.055).toFixed(2)}" fill="#000">${text}</text></svg>`;
    downloadBlob(new Blob([full], { type: 'image/svg+xml' }), qrFileName(w, 'svg'));
  }

  // PNG in 300 dpi, damit die eingegebene Grösse beim Drucken stimmt
  function exportQrPng(w) {
    const { size, label } = singleQrOptions();
    const code = qrMatrix(qrUrl(w));
    const n = code.getModuleCount();
    const total = n + 8;
    const unit = Math.max(1, Math.round(size / 2.54 * 300 / total));
    const side = total * unit;
    const extra = label ? Math.round(side * 0.2) : 0;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side + extra;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.isDark(r, c)) ctx.fillRect((c + 4) * unit, (r + 4) * unit, unit, unit);
    if (label) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(side * 0.055)}px Arial, sans-serif`;
      ctx.fillText(`Nr. ${w.number}, ${w.title}`, side / 2, side + extra * 0.55, side * 0.94);
    }
    canvas.toBlob((blob) => downloadBlob(blob, qrFileName(w, 'png')), 'image/png');
  }

  // Beim Drucken müssen alle Bilder geladen sein, sonst bleiben Lücken
  async function printPages(pages) {
    const target = $('#qr-print');
    target.innerHTML = pages.join('');
    await Promise.all($$('img', target).map((img) => (img.complete ? null : new Promise((done) => { img.onload = done; img.onerror = done; }))));
    document.body.classList.add('printing-qr');
    window.print();
  }
  addEventListener('afterprint', () => {
    document.body.classList.remove('printing-qr');
    $('#qr-print').innerHTML = '';
  });

  /* ---------- Router und Ereignisse ---------- */

  // Scrollstelle pro Seite merken: Wer zurückgeht, landet wieder dort, wo er war.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const scrollPos = {};
  let pendingScroll = 0;
  let followedLink = false;
  // Ohne Klick auf einen Link kam der Seitenwechsel vom Browser: Wischgeste oder Zurück-Knopf.
  // Der Browser animiert das selbst. Eine eigene Animation dazu ergäbe das Stocken und Verblassen.
  let clickedLink = false;
  let browserNavigation = false;
  // Die Bilder, über die jemand von Bild zu Bild gekommen ist. Der letzte Eintrag ist das vorherige Bild.
  let workTrail = [];
  const workSlug = (hash) => (/^#\/?werk\/([^/]+)/.exec(hash) || [])[1] || null;
  function updateTrail(oldHash, newHash, followed) {
    const from = workSlug(oldHash), to = workSlug(newHash);
    if (!to || from === to) return;
    if (!from) { if (followed) workTrail = []; return; }
    if (!followed && workTrail[workTrail.length - 1] === to) workTrail.pop();
    else workTrail.push(from);
  }
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    followedLink = !!link && !link.classList.contains('back');
    clickedLink = !!link;
  }, true);

  // Punkte zeigen, dass es in der Reihe weitergeht, und auf welcher Seite man gerade ist
  function setupStrip() {
    const strip = $('.format-strip');
    const nav = $('.format-nav');
    if (!strip || !nav) return;
    const pages = Math.ceil((strip.scrollWidth - 1) / strip.clientWidth);
    nav.hidden = pages <= 1;
    if (pages <= 1) return;
    $('.strip-dots', nav).innerHTML = Array.from({ length: pages }, (_, i) =>
      `<button type="button" class="strip-dot" data-act="strip-dot" data-page="${i}" aria-label="Seite ${i + 1} von ${pages}"></button>`).join('');
    const mark = () => {
      const max = strip.scrollWidth - strip.clientWidth;
      const current = max > 0 ? Math.round(strip.scrollLeft / max * (pages - 1)) : 0;
      $$('.strip-dot', nav).forEach((d, i) => d.classList.toggle('is-active', i === current));
    };
    strip.addEventListener('scroll', mark, { passive: true });
    mark();
  }

  // Wer angemeldet ist, sieht es im Kopf der Seite und bei «Meine Gebote»
  function updateIdentity() {
    const chip = $('#me-chip');
    const mine = WERKE.filter((w) => w.mode === 'auction' && B.ownMax(lotOf(w), ME) !== null).length;
    chip.hidden = !S.me;
    if (S.me) chip.textContent = `Angemeldet: ${S.me.first}`;
    $('[data-nav="meine-gebote"]').textContent = mine ? `Meine Gebote (${mine})` : 'Meine Gebote';
    const favs = S.favs.filter((id) => byId.has(id) && isShown(byId.get(id))).length;
    $('[data-nav="favoriten"]').innerHTML = `${HEART}<span class="nav-label">Favoriten</span>${favs ? ` <span class="nav-count">${favs}</span>` : ''}`;
    $('#demo-view').textContent = S.me ? 'Als Gast ansehen' : 'Angemeldet ansehen';
  }

  // Demo: angemeldet, mit je einem Bild in jedem Zustand
  function loginDemo() {
    resetState();
    S.me = { first: 'Christoph' };
    const now = Date.now();
    const free = (test) => WERKE.find((w) => isShown(w) && w.mode === 'auction' && !w.boughtBy && !lotOf(w).log.length && test(w) && B.ownMax(lotOf(w), ME) === null);
    const color = (w) => w.type === 'print_aluminium';
    const drawing = (w) => w.type === 'original';
    // Führt, Maximum deutlich über dem Preis
    let w = free(color);
    B.place(lotOf(w), ME, (w.start + 100) * 100, now - 500 * MIN);
    // Führt, die Automatik hat schon einmal für mich geboten
    w = free(drawing);
    B.place(lotOf(w), 'r2', (w.start + 20) * 100, now - 700 * MIN);
    B.place(lotOf(w), ME, (w.start + 120) * 100, now - 300 * MIN);
    S.frames[w.id] = 'wood';
    // Überboten
    w = free(color);
    B.place(lotOf(w), ME, (w.start + 20) * 100, now - 900 * MIN);
    B.place(lotOf(w), 'r4', (w.start + 60) * 100, now - 40 * MIN);
    // Überboten bei einer Zeichnung
    w = free(drawing);
    B.place(lotOf(w), ME, w.start * 100, now - 240 * MIN);
    B.place(lotOf(w), 'r1', (w.start + 40) * 100, now - 90 * MIN);
    // Schon gekauft
    w = free(color);
    B.buyNow(lotOf(w), ME, now - 60 * MIN);
    save();
  }

  let currentRoute = location.hash.replace(/^#\/?/, '').split('/');
  let lastCols = 0;
  // Auf dem Handy passt das Bild ganz zwischen die Zurück-Links und die Bietleiste, auch mit Rahmen.
  function fitWork() {
    const media = $('.work-media');
    const box = $('.work-img');
    if (!media || !box) return;
    box.style.maxWidth = '';
    media.style.removeProperty('--fit-h');
    if (innerWidth >= 900) return;
    const nav = $('.work-nav');
    const bar = $('.bidbar');
    const avail = Math.max(240, innerHeight - (nav ? nav.offsetHeight : 0) - (bar ? bar.offsetHeight : 0) - 34);
    media.style.setProperty('--fit-h', `${avail}px`);
    const height = box.offsetHeight;
    if (height <= avail) return;
    if (media.matches('.framed, .mat')) box.style.maxWidth = `${box.offsetWidth * avail / height}px`;
    else media.style.setProperty('--fit-h', `${avail - (height - avail)}px`); // Das Blatt um die Zeichnung zählt mit
  }

  // Beim Öffnen beginnt die Seite beim Bild. Kopf und Navigation sind nur einen Wisch nach oben entfernt.
  function scrollToWork() {
    const start = $('.work-nav');
    // Am Computer passt das Bild unter den Kopf, auf dem Handy wandert der Kopf aus dem Bild
    scrollTo(0, start && innerWidth < 900 ? start.getBoundingClientRect().top + scrollY - 6 : 0);
  }

  // Beim Zurückwischen bleibt die Galerie dieselbe: Die Seite wird nicht neu aufgebaut, darum blinken die Bilder nicht.
  // Hat sich inzwischen etwas geändert, zum Beispiel ein Gebot oder ein Herz, wird sie normal neu erstellt.
  const CACHED_PAGES = new Set(['', 'katalog', 'begehrt', 'favoriten']);
  const viewCache = new Map();
  const viewStamp = () => JSON.stringify([columnCount(), S.me, S.favs, S.edits, S.frames, WERKE.map((w) => {
    const lot = lotOf(w);
    return lot ? `${lot.log.length}/${lot.entries.length}/${lot.sold ? 1 : 0}/${lot.endsAt}` : '';
  }).join()]);

  function route(keepScroll) {
    const hash = location.hash.replace(/^#\/?/, '');
    const [page, arg, arg2] = hash.split('/');
    const views = { '': viewStart, katalog: viewKatalog, begehrt: viewBegehrt, 'meine-gebote': viewMeine, favoriten: viewFavoriten, regeln: viewRegeln, datenschutz: viewDatenschutz, cockpit: viewCockpit };
    if (page === 'werk') {
      const seen = WERKE.find((x) => x.slug === arg);
      if (seen) {
        S.views[seen.id].total += 1;
        if (arrivedByQr) S.views[seen.id].qr += 1;
        arrivedByQr = false;
        save();
      }
    }
    const stamp = viewStamp();
    const kept = browserNavigation && viewCache.get(page);
    const restored = kept && kept.stamp === stamp ? kept.nodes : null;
    const html = restored ? '' : page === 'werk' ? viewWerk(arg) : (views[page] || viewStart)(arg, arg2);
    // Nur das eine Bild fliegt zwischen Galerie und Bildseite, alles andere blendet ruhig über.
    const [prevPage, prevArg] = currentRoute;
    currentRoute = [page, arg];
    const heroSlug = page === 'werk' ? arg : prevPage === 'werk' ? prevArg : null;
    const findHero = (onPage, onArg) => {
      if (!heroSlug) return null;
      return onPage === 'werk' && onArg === heroSlug ? $('.work-img img') : $(`a.tile[href="#/werk/${heroSlug}"] img`);
    };
    const inView = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    };
    const instant = browserNavigation;
    browserNavigation = false;
    document.documentElement.classList.toggle('returning', instant || (prevPage === 'werk' && page !== 'werk'));
    const oldHero = keepScroll === true || instant ? null : findHero(prevPage, prevArg);
    const animated = inView(oldHero);
    if (animated) oldHero.style.viewTransitionName = 'hero';
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      const main = $('#main');
      if (keepScroll !== true && CACHED_PAGES.has(prevPage)) viewCache.set(prevPage, { nodes: [...main.childNodes], stamp });
      if (restored) main.replaceChildren(...restored);
      else main.innerHTML = html;
      $$('[data-nav]').forEach((a) => {
        if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      fitWork();
      // Das Blatt um die Zeichnung lässt sich erst mit dem geladenen Bild genau messen
      const workImage = $('.work-img img');
      if (workImage && !workImage.complete) workImage.addEventListener('load', fitWork, { once: true });
      if (keepScroll !== true) {
        if (page === 'werk' && !pendingScroll) scrollToWork();
        else scrollTo(0, pendingScroll);
      }
      pendingScroll = 0;
      setupStrip();
      setupHero();
      updateIdentity();
      fitQrPreview();
      const newHero = findHero(page, arg);
      if (animated && inView(newHero)) newHero.style.viewTransitionName = 'hero';
      tickCountdowns();
    };
    if (keepScroll !== true && !instant && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Der Übergang ist nur Zierde: Hängt er oder fällt er aus, kommt der Inhalt trotzdem.
      const vt = document.startViewTransition(apply);
      [vt.ready, vt.finished, vt.updateCallbackDone].forEach((p) => p.catch(() => {}));
      vt.finished.catch(() => {}).then(() => $$('img').forEach((img) => { img.style.viewTransitionName = ''; }));
      setTimeout(apply, 300);
    } else apply();
    lastCols = columnCount();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const workId = Number(el.dataset.work);
    if (act === 'fav') { toggleFav(workId); return; }
    if (act === 'bid') { flow.work = workId; withLogin(() => stepBid()); }
    if (act === 'buy-now') { flow.work = workId; withLogin(() => stepConfirm(lotOf(byId.get(workId)).buyNow, true)); }
    if (act === 'demo-pulse') atelierPulse(true);
    if (act === 'frame') {
      S.frames[workId] = el.dataset.frame;
      save();
      const w = byId.get(workId);
      // Das grosse Bild oben ändert seine Höhe. Die Knöpfe sollen trotzdem unter dem Finger bleiben, auch auf dem iPhone.
      const before = el.getBoundingClientRect().top;
      $('.work-media').className = 'work-media' + frameClass(w);
      $('#frame-mini').className = 'frame-mini' + frameClass(w);
      $('#work-facts').innerHTML = factsHtml(w);
      fitWork();
      scrollBy(0, el.getBoundingClientRect().top - before);
      $$('[data-act="frame"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
    }
    if (act === 'strip') {
      const strip = $('.format-strip');
      strip.scrollBy({ left: Number(el.dataset.dir) * strip.clientWidth, behavior: 'smooth' });
    }
    if (act === 'suggest-more') {
      suggestState.count += 4;
      const box = $('#suggestions');
      box.classList.add('no-rise');
      box.innerHTML = suggestionsHtml(byId.get(workId));
      tickCountdowns();
    }
    if (act === 'strip-dot') {
      const strip = $('.format-strip');
      const pages = $$('.strip-dot').length;
      strip.scrollTo({ left: Number(el.dataset.page) / (pages - 1) * (strip.scrollWidth - strip.clientWidth), behavior: 'smooth' });
    }
    if (act === 'demo-view') {
      if (S.me) { resetState(); save(); } else loginDemo();
      route(true);
    }
    if (act === 'cockpit-logout') { cockpitOpen = false; route(true); }
    if (act === 'qr-preset') {
      Object.assign(S.qr, el.dataset.preset === 'folder'
        ? { perPage: 1, size: 5, image: true, number: true, title: true, hint: true, cut: false, marks: false }
        : { perPage: 12, size: 3, image: false, number: true, title: true, hint: true, cut: true, marks: true });
      save();
      route(true);
    }
    if (act === 'qr-print') printPages(qrPages());
    if (act === 'cat-print') printPages(catPages());
    if (act === 'cat-preset') {
      Object.assign(S.cat, el.dataset.preset === 'large'
        ? { perPage: 1, number: true, title: true, size: true, technique: true, start: true, buy: true, qr: true }
        : { perPage: 9, number: true, title: true, size: false, technique: false, start: true, buy: false, qr: false });
      save();
      route(true);
    }
    if (act === 'qr-png') exportQrPng(byId.get(workId));
    if (act === 'qr-svg') exportQrSvg(byId.get(workId));
    if (act === 'cp-filter') { cockpitOnlyMissing = el.dataset.only === '1'; route(true); }
    if (act === 'cp-show-missing') cockpitOnlyMissing = true;
    if (act === 'close-sheet') sheet.close();
    if (act === 'pick') stepConfirm(Number(el.dataset.amount), false);
    if (act === 'pick-buy') stepConfirm(lotOf(byId.get(flow.work)).buyNow, true);
    if (act === 'confirm-bid') submitBid(false);
    if (act === 'confirm-buy') submitBid(true);
    if (act === 'fav-login') {
      flow.then = () => { sheet.close(); route(true); };
      stepRegister();
    }
    if (act === 'magic-link') finishLogin();
    if (act === 'rank-more') { rankShown[el.dataset.list] = Number(el.dataset.show); route(true); }
    if (act === 'hero-dot') heroGo(Number(el.dataset.i));
    if (act === 'filter') {
      filter[el.dataset.key] = filter[el.dataset.key] === el.dataset.val ? null : el.dataset.val;
      filtersOpen = true;
      route(true);
    }
    if (act === 'clear-filters') {
      Object.assign(filter, { type: null, format: null, family: null });
      route(true);
    }
    if (act === 'zoom') openZoom(el.dataset.src);
    if (act === 'close-zoom') $('#zoom').close();
    if (act === 'demo-end') {
      const lot = lotOf(byId.get(workId));
      lot.endsAt = Date.now() + 330000;
      lot.originalEndsAt = lot.endsAt;
      afterChange(workId);
    }
    if (act === 'demo-rival' && !rivalBid(byId.get(workId), true)) toast('Hier ist kein fremdes Gebot mehr möglich.');
    if (act === 'reset') {
      try { localStorage.removeItem(STORE); } catch (err) { /* siehe load */ }
      resetState();
      if (location.hash && location.hash !== '#/') location.hash = '#/';
      else route(true);
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === 'cockpit-login') {
      if (data.get('password') === 'benedikt') { cockpitOpen = true; route(true); } else $('#cockpit-error').hidden = false;
    }
    if (form.dataset.form === 'work-edit') {
      const w = byId.get(Number(form.dataset.work));
      const fail = (text) => { const el = $('#edit-error'); el.textContent = text; el.hidden = false; };
      const height = Number(data.get('height')), width = Number(data.get('width'));
      const title = String(data.get('title')).trim(), technique = String(data.get('technique')).trim();
      const long = Math.max(height, width);
      const edit = {
        title, technique, sizeCm: [height, width], hidden: !data.get('visible'),
        format: w.type !== 'print_aluminium' || long <= 30 ? 'Klein' : long <= 45 ? 'Mittel' : 'Gross',
      };
      if (data.get('type')) edit.type = data.get('type');
      if (isOriginal(w)) {
        const mat = Number(data.get('matCm')), frame = Number(data.get('frameCm'));
        if (!(mat >= 0 && frame >= 0)) return fail('Bitte gib gültige Masse für Passepartout und Rahmen an.');
        edit.matCm = mat;
        edit.frameCm = frame;
        if (data.get('applyAll')) {
          WERKE.filter(isOriginal).forEach((x) => { S.edits[x.id] = { ...(S.edits[x.id] || {}), matCm: mat, frameCm: frame }; });
        }
      }
      const lot = w.mode === 'auction' ? lotOf(w) : null;
      // Unvollständiges darf gespeichert werden, damit man es in mehreren Schritten erfassen kann
      if (lot && !bidCount(lot)) {
        const read = (name) => (data.get(name) === '' ? null : Number(data.get(name)));
        const start = read('start'), buy = read('buyNow'), inc = read('inc');
        if (![start, buy, inc].every((v) => v === null || (Number.isInteger(v) && v > 0))) return fail('Bitte gib die Preise in ganzen Franken an.');
        if (start !== null && buy !== null && buy <= start) return fail('Der Sofortpreis muss höher sein als der Startpreis.');
        if (start !== null && buy !== null && inc !== null) Object.assign(lot, { start: start * 100, buyNow: buy * 100, inc: inc * 100 });
        Object.assign(edit, { start, buyNow: buy, inc });
      }
      S.edits[w.id] = { ...(S.edits[w.id] || {}), ...edit };
      applyEdits();
      save();
      route(true);
      const left = missingFields(w);
      toast(left.length ? `Gespeichert. Es fehlt noch: ${left.join(', ')}` : 'Gespeichert. Das Bild ist vollständig.');
    }
    if (form.dataset.form === 'register') {
      flow.first = data.get('first');
      stepMailSent(data.get('email'));
    }
    if (form.dataset.form === 'login-code') {
      if (String(data.get('code')).trim() !== DEMO_CODE) return stepMailSent(flow.email, 'Dieser Code stimmt nicht. Schau nochmals in die Mail.');
      finishLogin();
    }
    if (form.dataset.form === 'max') {
      const fr = Number(data.get('max'));
      const lot = lotOf(byId.get(flow.work));
      if (!Number.isInteger(fr)) return stepBid('Bitte gib einen Betrag in ganzen Franken ein.');
      if (fr * 100 < B.minBid(lot, ME)) return stepBid(`Das reicht noch nicht: Das nächste Gebot muss mindestens ${chf(B.minBid(lot, ME))} sein.`);
      stepConfirm(fr * 100, false);
    }
  });

  // Diagramm: nächster Punkt unter Maus oder Finger
  function salesHover(e) {
    const chart = e.target.closest && e.target.closest('[data-chart="sales"]');
    if (!chart || !salesPoints.length) return;
    const svg = $('svg', chart);
    const box = svg.getBoundingClientRect();
    const vbX = (e.clientX - box.left) / box.width * 640;
    const point = salesPoints.reduce((best, p) => (Math.abs(p.x - vbX) < Math.abs(best.x - vbX) ? p : best));
    const dot = $('.sales-hover', chart);
    dot.removeAttribute('hidden');
    dot.setAttribute('cx', point.x);
    dot.setAttribute('cy', point.y);
    const tip = $('.sales-tip', chart);
    tip.hidden = false;
    tip.textContent = point.label;
    const px = point.x / 640 * box.width;
    tip.style.left = `${Math.min(box.width - 130, Math.max(0, px - 65))}px`;
    tip.style.top = `${Math.max(0, point.y / 200 * box.height - 38)}px`;
  }
  document.addEventListener('pointermove', salesHover);
  document.addEventListener('pointerdown', salesHover);

  document.addEventListener('input', (e) => {
    const total = $('#cp-frame-total');
    if (total && e.target.form && ['height', 'width', 'matCm', 'frameCm'].includes(e.target.name)) {
      const f = e.target.form;
      total.innerHTML = frameTotal(Number(f.height.value), Number(f.width.value), Number(f.matCm.value), Number(f.frameCm.value));
    }
    const catKey = e.target.dataset.cat;
    if (catKey) {
      S.cat[catKey] = e.target.type === 'checkbox' ? e.target.checked : catKey === 'perPage' ? Number(e.target.value) : e.target.value;
      save();
      refreshCatalog();
      return;
    }
    const key = e.target.dataset.qr;
    if (key) {
      const numeric = ['size', 'perPage', 'from', 'to'].includes(key);
      const value = e.target.type === 'checkbox' ? e.target.checked : numeric ? Number(e.target.value) : e.target.value;
      if (numeric && !(value > 0)) return;
      S.qr[key] = value;
      save();
      refreshQr();
      return;
    }
    if (e.target.dataset.actInput !== 'cockpit-search') return;
    cockpitQuery = e.target.value.trim().toLowerCase();
    $$('#cockpit-list li').forEach((li) => { li.hidden = !li.dataset.search.includes(cockpitQuery); });
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-act-change="sort"]')) {
      filter.sort = e.target.value;
      $('#catalog-results').innerHTML = catalogResults();
      tickCountdowns();
    }
  });

  addEventListener('hashchange', (e) => {
    if (sheet.open) sheet.close();
    if ($('#zoom').open) $('#zoom').close();
    browserNavigation = !clickedLink;
    clickedLink = false;
    scrollPos[new URL(e.oldURL).hash] = scrollY; // die alte Seite steht in diesem Moment noch
    pendingScroll =followedLink ? 0 : scrollPos[location.hash] || 0;
    updateTrail(new URL(e.oldURL).hash, location.hash, followedLink);
    followedLink = false;
    route();
  });
  addEventListener('resize', () => { if (columnCount() !== lastCols && !sheet.open) route(true); });
  sheet.addEventListener('close', parkToasts);
  $('#zoom').addEventListener('close', parkToasts);
  $('#zoom').addEventListener('click', (e) => { if (e.target.id === 'zoom') e.target.close(); });

  if (new URLSearchParams(location.search).has('bieter') && !S.me) loginDemo();
  route(true);
  if (currentRoute[0] === 'werk') scrollToWork(); // Auch wer per QR-Code kommt, sieht zuerst das ganze Bild
  setInterval(() => {
    if (document.hidden) return;
    tickCountdowns();
    simulate();
    if (location.hash === '#/cockpit' && cockpitOpen && atelierDirty) {
      atelierDirty = false;
      $('#main').innerHTML = viewCockpit();
    }
  }, 1000);
})();
