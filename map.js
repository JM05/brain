/* Personal OS · Mapa de pensamiento + revisión de etiquetas.
   Funciones puras: reciben los datos y devuelven grafo, posiciones y hallazgos. app.js se encarga de pintar y de las acciones. */
(function (global) {
  'use strict';

  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

  /* ---------- Grafo ----------
     ctx: { items, domains, tagDomain, domainOf(item), withEntries } */
  function buildGraph(ctx) {
    const { items, domains, tagDomain, domainOf, withEntries } = ctx;
    const nodes = new Map();
    const edges = [];
    const add = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, n); return nodes.get(n.id); };
    const domIds = new Set(domains.map((d) => d.id));

    const tagItems = new Map();
    items.forEach((i) => [...new Set(i.tags)].forEach((t) => { if (!tagItems.has(t)) tagItems.set(t, []); tagItems.get(t).push(i); }));
    const domCount = new Map();
    items.forEach((i) => { const d = domainOf(i); if (d) domCount.set(d, (domCount.get(d) || 0) + 1); });

    domains.forEach((d) => {
      const w = domCount.get(d.id) || 0;
      const hasTag = [...tagItems.keys()].some((t) => tagDomain[t] === d.id);
      if (w || hasTag) add({ id: 'd:' + d.id, kind: 'domain', ref: d.id, label: d.name, w, dom: d.id });
    });

    tagItems.forEach((arr, t) => {
      const d = domIds.has(tagDomain[t]) ? tagDomain[t] : null;
      add({ id: 't:' + t, kind: 'tag', ref: t, label: '#' + t, w: arr.length, dom: d });
      if (d) edges.push({ a: 't:' + t, b: 'd:' + d, kind: 'td' });
    });

    if (!withEntries) {
      const co = new Map();
      items.forEach((i) => {
        const ts = [...new Set(i.tags)].sort();
        for (let x = 0; x < ts.length; x++) for (let y = x + 1; y < ts.length; y++) { const k = ts[x] + '\u0000' + ts[y]; co.set(k, (co.get(k) || 0) + 1); }
      });
      co.forEach((w, k) => { const [a, b] = k.split('\u0000'); edges.push({ a: 't:' + a, b: 't:' + b, kind: 'tt', w }); });
      const loose = items.filter((i) => !i.tags.length && !domainOf(i));
      if (loose.length) add({ id: 'u', kind: 'tag', ref: null, label: 'sin etiqueta', w: loose.length, dom: null });
    } else {
      items.forEach((i) => {
        const d = domainOf(i);
        add({ id: 'e:' + i.id, kind: 'entry', ref: i.id, label: i.text, w: 1, dom: d, done: i.done, focus: i.focus, someday: i.someday });
        [...new Set(i.tags)].forEach((t) => edges.push({ a: 'e:' + i.id, b: 't:' + t, kind: 'et' }));
        const override = i.domain && domIds.has(i.domain);
        if ((!i.tags.length && d) || override) {
          if (!nodes.has('d:' + d)) add({ id: 'd:' + d, kind: 'domain', ref: d, label: (domains.find((x) => x.id === d) || {}).name || d, w: domCount.get(d) || 0, dom: d });
          edges.push({ a: 'e:' + i.id, b: 'd:' + d, kind: 'ed' });
        }
      });
      const inSet = new Set(items.map((i) => i.id));
      items.forEach((i) => i.links.forEach((l) => { if (i.id < l && inSet.has(l)) edges.push({ a: 'e:' + i.id, b: 'e:' + l, kind: 'ee' }); }));
    }

    const list = [...nodes.values()];
    list.forEach((n) => {
      n.r = n.kind === 'domain' ? 13 + 5.5 * Math.sqrt(n.w) : n.kind === 'tag' ? 4.5 + 3.4 * Math.sqrt(n.w) : 5;
      const fs = n.kind === 'domain' ? 12.5 : 11;
      n.lw = n.kind === 'entry' ? 0 : Math.min(n.label.length, 22) * fs * 0.56; // ancho aprox. de la etiqueta
      n.rc = Math.max(n.r + (n.kind === 'entry' ? 3 : 6), n.lw * 0.5); // radio de colisión con la etiqueta debajo
    });
    return { nodes: list, edges: edges.filter((e) => nodes.has(e.a) && nodes.has(e.b)) };
  }

  /* ---------- Layout por fuerzas (determinista; reutiliza posiciones previas) ---------- */
  function layout(g, prev = {}) {
    const N = g.nodes;
    const idx = new Map(N.map((n, i) => [n.id, i]));
    const doms = N.filter((n) => n.kind === 'domain');
    const R = 70 + 26 * doms.length;
    doms.forEach((n, k) => {
      const p = prev[n.id];
      const a = (k / Math.max(1, doms.length)) * 2 * Math.PI - Math.PI / 2;
      n.x = p ? p.x : Math.cos(a) * R; n.y = p ? p.y : Math.sin(a) * R;
    });
    const anchorOf = (n) => {
      if (n.dom && idx.has('d:' + n.dom)) return N[idx.get('d:' + n.dom)];
      const e = g.edges.find((e) => e.a === n.id && (e.kind === 'et'));
      return e ? N[idx.get(e.b)] : null;
    };
    N.filter((n) => n.kind === 'tag').forEach((n) => {
      const p = prev[n.id]; if (p) { n.x = p.x; n.y = p.y; return; }
      const a = anchorOf(n);
      n.x = (a ? a.x * 1.25 : 0) + (hash(n.id) - 0.5) * 90;
      n.y = (a ? a.y * 1.25 : 0) + (hash(n.id + 'y') - 0.5) * 90;
    });
    N.filter((n) => n.kind === 'entry').forEach((n) => {
      const p = prev[n.id]; if (p) { n.x = p.x; n.y = p.y; return; }
      const e = g.edges.find((e) => e.a === n.id);
      const a = e ? N[idx.get(e.b)] : null;
      n.x = (a ? a.x : 0) + (hash(n.id) - 0.5) * 60;
      n.y = (a ? a.y : 0) + (hash(n.id + 'y') - 0.5) * 60;
    });
    N.forEach((n) => { n.vx = 0; n.vy = 0; });

    const E = g.edges.map((e) => ({ s: idx.get(e.a), t: idx.get(e.b), kind: e.kind, w: e.w || 1 }));
    const L = { td: 62, tt: 58, et: 30, ed: 50, ee: 36 };
    const K = { td: 0.07, tt: 0.012, et: 0.09, ed: 0.05, ee: 0.05 };
    const warm = Object.keys(prev).length && N.every((n) => prev[n.id]);
    const ITER = warm ? 60 : N.length > 160 ? 180 : 300;

    for (let it = 0; it < ITER; it++) {
      const alpha = (warm ? 0.3 : 1) * (1 - it / ITER) + 0.02;
      for (let i = 0; i < N.length; i++) {
        const a = N[i];
        for (let j = i + 1; j < N.length; j++) {
          const b = N[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = hash(a.id + b.id) - 0.5; dy = hash(b.id + a.id) - 0.5; d2 = dx * dx + dy * dy; }
          const d = Math.sqrt(d2);
          const charge = (a.kind === 'domain' ? 2.4 : 1) * (b.kind === 'domain' ? 2.4 : 1) * 640;
          let f = (charge / d2) * alpha;
          const min = a.rc + b.rc + 8;
          if (d < min) f += ((min - d) / d) * 0.5;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }
      E.forEach((e) => {
        const a = N[e.s], b = N[e.t];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const k = K[e.kind] * (e.kind === 'tt' ? Math.min(3, e.w) : 1) * alpha;
        const f = (d - (L[e.kind] + (a.r + b.r) * 0.6)) * k;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        const wa = a.kind === 'domain' ? 0.35 : 1, wb = b.kind === 'domain' ? 0.35 : 1;
        a.vx += fx * wa; a.vy += fy * wa; b.vx -= fx * wb; b.vy -= fy * wb;
      });
      N.forEach((n) => {
        n.vx -= n.x * 0.004 * alpha; n.vy -= n.y * 0.004 * alpha;
        n.vx *= 0.6; n.vy *= 0.6;
        n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy));
      });
    }
    const pos = {};
    N.forEach((n) => { pos[n.id] = { x: n.x, y: n.y }; });
    return pos;
  }

  /* ---------- Revisión de etiquetas ----------
     ctx: { items, tagDomain, domainIds(Set), fold, ignore(Set) } → [{ key, kind, ... }] */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[a.length][b.length];
  }

  function audit(ctx) {
    const { items, tagDomain, domainIds, fold, ignore } = ctx;
    const out = [];
    const tagSets = new Map();
    items.forEach((i) => [...new Set(i.tags)].forEach((t) => { if (!tagSets.has(t)) tagSets.set(t, new Set()); tagSets.get(t).add(i.id); }));
    const tags = [...tagSets.keys()];
    const n = (t) => tagSets.get(t).size;
    const domOfTag = (t) => (domainIds.has(tagDomain[t]) ? tagDomain[t] : null);
    const push = (o) => { if (!ignore.has(o.key)) out.push(o); };
    const used = new Set(); // etiquetas ya cubiertas por un hallazgo de fusión

    // 1. Nombres casi iguales (plural, errata)
    const stem = (t) => fold(t).replace(/(es|s)$/, '');
    for (let x = 0; x < tags.length; x++) for (let y = x + 1; y < tags.length; y++) {
      const a = tags[x], b = tags[y];
      const fa = fold(a), fb = fold(b);
      if (stem(a) === stem(b) || (Math.min(fa.length, fb.length) >= 5 && lev(fa, fb) <= 1)) {
        const [keep, drop] = n(a) >= n(b) ? [a, b] : [b, a];
        push({ key: `sim:${[a, b].sort().join('|')}`, kind: 'similar', keep, drop });
        used.add(drop);
      }
    }

    // 2. Etiquetas que casi siempre van juntas
    for (let x = 0; x < tags.length; x++) for (let y = x + 1; y < tags.length; y++) {
      const a = tags[x], b = tags[y];
      if (used.has(a) || used.has(b)) continue;
      const A = tagSets.get(a), B = tagSets.get(b);
      let co = 0; A.forEach((id) => { if (B.has(id)) co++; });
      const j = co / (A.size + B.size - co);
      if (co >= 2 && j >= 0.6) {
        const [keep, drop] = n(a) >= n(b) ? [a, b] : [b, a];
        push({ key: `pair:${[a, b].sort().join('|')}`, kind: 'pair', keep, drop, co, total: A.size + B.size - co });
        used.add(drop);
      }
    }

    // 3. Sin dominio
    const unmapped = tags.filter((t) => !domOfTag(t)).sort((a, b) => n(b) - n(a));
    if (unmapped.length) push({ key: 'unmapped:' + unmapped.join('|'), kind: 'unmapped', tags: unmapped });

    // 4. Etiqueta en un dominio, pero sus entradas apuntan a otro
    tags.forEach((t) => {
      const d = domOfTag(t);
      if (!d || n(t) < 2) return;
      const votes = new Map(); let total = 0;
      items.forEach((i) => {
        if (!i.tags.includes(t)) return;
        const others = new Set(i.tags.filter((o) => o !== t).map(domOfTag).filter(Boolean));
        others.forEach((o) => { votes.set(o, (votes.get(o) || 0) + 1); });
        if (others.size) total++;
      });
      if (total < 2) return;
      const [top, c] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] || [];
      if (top && top !== d && c / n(t) >= 0.6 && !(votes.get(d) >= c)) push({ key: `mis:${t}:${top}`, kind: 'mismatch', tag: t, from: d, to: top, c, of: n(t) });
    });

    // 5. Entradas que mezclan dominios (sin dominio elegido a mano)
    items.forEach((i) => {
      if (i.done || (i.domain && domainIds.has(i.domain))) return;
      const ds = [...new Set(i.tags.map(domOfTag).filter(Boolean))];
      if (ds.length >= 2) push({ key: `mix:${i.id}:${ds.sort().join('|')}`, kind: 'mixed', id: i.id, text: i.text, domains: ds });
    });

    // 6. Usadas una sola vez y ya cubiertas por otra etiqueta del mismo dominio
    const singleSet = new Set();
    items.forEach((i) => {
      const ts = [...new Set(i.tags)];
      const byDom = new Map();
      ts.forEach((t) => { const d = domOfTag(t); if (d) { if (!byDom.has(d)) byDom.set(d, []); byDom.get(d).push(t); } });
      byDom.forEach((group) => {
        if (group.length < 2) return;
        const cand = group.filter((t) => n(t) === 1 && !used.has(t));
        const keeper = group.some((t) => !cand.includes(t)); // otra etiqueta del mismo dominio que se queda
        (keeper ? cand : cand.slice(1)).forEach((t) => singleSet.add(t));
      });
    });
    const singles = [...singleSet].sort();
    if (singles.length) push({ key: 'single:' + singles.join('|'), kind: 'single', tags: singles });

    // 7. Demasiadas etiquetas por entrada
    const tagged = items.filter((i) => i.tags.length);
    if (tagged.length >= 8) {
      const avg = tagged.reduce((a, i) => a + i.tags.length, 0) / tagged.length;
      if (avg > 2.4) push({ key: 'avg:' + Math.round(avg * 10), kind: 'avg', avg });
    }
    const order = { similar: 0, pair: 1, unmapped: 2, mismatch: 3, mixed: 4, single: 5, avg: 6 };
    return out.sort((a, b) => order[a.kind] - order[b.kind]);
  }

  global.PosMap = { buildGraph, layout, audit };
})(typeof window !== 'undefined' ? window : globalThis);
