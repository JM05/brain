/* Personal OS · V0 — captura, vistas, relaciones, respaldo. Datos solo en este dispositivo. */
(() => {
  'use strict';

  const KEY = 'pos.v1';
  const SCHEMA = 1;
  const { parse, fold, iso } = window.PosParse;
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------------- Datos ---------------- */
  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.items)) return { items: d.items.map(normalize).filter(Boolean), meta: d.meta || {} };
      }
    } catch (e) { console.error(e); }
    return { items: [], meta: {} };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, items: db.items, meta: db.meta }));
    } catch (e) {
      toast('No se pudo guardar: ' + e.message);
    }
    if (!save.asked && navigator.storage && navigator.storage.persist) { save.asked = true; navigator.storage.persist().catch(() => {}); }
  }

  function normalize(x) {
    if (!x || typeof x !== 'object' || !x.id || typeof x.text !== 'string') return null;
    const now = new Date().toISOString();
    const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    return {
      id: String(x.id),
      text: x.text,
      tags: Array.isArray(x.tags) ? x.tags.map(String) : parse(x.text).tags,
      date: isDate(x.date),
      due: isDate(x.due),
      done: !!x.done,
      doneAt: x.done ? (x.doneAt || x.updatedAt || now) : null,
      createdAt: x.createdAt || now,
      updatedAt: x.updatedAt || x.createdAt || now,
      links: Array.isArray(x.links) ? [...new Set(x.links.map(String))] : []
    };
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const byId = (id) => db.items.find((i) => i.id === id);
  const stamp = (it) => { it.updatedAt = new Date().toISOString(); };

  function addItem(text) {
    const p = parse(text);
    const now = new Date().toISOString();
    const it = { id: uid(), text, tags: p.tags, date: p.date, due: p.due, done: false, doneAt: null, createdAt: now, updatedAt: now, links: [] };
    db.items.unshift(it);
    save();
    return it;
  }

  function setDone(it, done) {
    it.done = done;
    it.doneAt = done ? new Date().toISOString() : null;
    stamp(it);
  }

  function link(a, b) {
    if (!a || !b || a.id === b.id) return;
    if (!a.links.includes(b.id)) a.links.push(b.id);
    if (!b.links.includes(a.id)) b.links.push(a.id);
    stamp(a); stamp(b); save();
  }
  function unlink(a, b) {
    a.links = a.links.filter((x) => x !== b.id);
    b.links = b.links.filter((x) => x !== a.id);
    stamp(a); stamp(b); save();
  }

  function removeItem(it) {
    const touched = db.items.filter((o) => o.links.includes(it.id)).map((o) => o.id);
    db.items = db.items.filter((o) => o !== it);
    touched.forEach((id) => { const o = byId(id); o.links = o.links.filter((x) => x !== it.id); });
    save();
    return () => { // deshacer
      db.items.push(it);
      touched.forEach((id) => { const o = byId(id); if (o && !o.links.includes(it.id)) o.links.push(it.id); });
      save();
    };
  }

  /* ---------------- Fechas ---------------- */
  const todayISO = () => iso(new Date());
  const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  const fmtWeekday = new Intl.DateTimeFormat('es', { weekday: 'short' });
  const fmtDay = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
  const fmtDayYear = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
  const clean = (s) => s.replace(/\./g, '');

  function dateLabel(s) {
    const n = diffDays(todayISO(), s);
    if (n === 0) return 'hoy';
    if (n === 1) return 'mañana';
    if (n === -1) return 'ayer';
    const d = toDate(s);
    if (n > 1 && n < 7) return clean(fmtWeekday.format(d)) + ' ' + d.getDate();
    if (d.getFullYear() !== new Date().getFullYear()) return clean(fmtDayYear.format(d));
    return clean(fmtDay.format(d));
  }
  const keyDate = (it) => [it.date, it.due].filter(Boolean).sort()[0] || null;

  /* ---------------- Similitud por texto ---------------- */
  const STOP = new Set(('de la el los las un una unos unas y o u a e en con por para que se mi mis tu tus su sus al del lo le les me te nos es son ser estar esta este esto eso esa ese estos esas hay muy mas menos ya no si sobre entre como cuando donde tengo tiene tener quiero quiere hacer hago ver algo todo todos toda cosa cosas otra otro otros vez bien tambien pero sin hasta desde antes despues hoy manana pasado ' +
    'lunes martes miercoles jueves viernes sabado domingo semana semanas fin finde proximo proxima dia dias vence limite idea ' +
    'enero ene febrero feb marzo mar abril abr mayo may junio jun julio jul agosto ago septiembre sep sept octubre oct noviembre nov diciembre dic').split(' '));
  const tokens = (text) => new Set((fold(text).match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)));

  function similar(it, limit = 5) {
    const all = db.items.map((o) => ({ o, t: tokens(o.text) }));
    const df = new Map();
    all.forEach(({ t }) => t.forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
    const N = all.length;
    const mine = tokens(it.text);
    return all
      .filter(({ o }) => o.id !== it.id && !it.links.includes(o.id))
      .map(({ o, t }) => {
        let s = 0;
        mine.forEach((w) => { if (t.has(w)) s += Math.log(1 + N / df.get(w)); });
        return { o, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || (a.o.done - b.o.done))
      .slice(0, limit)
      .map((x) => x.o);
  }

  /* ---------------- Render ---------------- */
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const richText = (s) => esc(s).replace(/(^|[\s(])#([\p{L}\p{N}_-]+)/gu, (m, pre, t) => `${pre}<span class="tag" data-tag="${t.toLowerCase()}">#${t}</span>`);

  function chipsFor(it, { withLinks = true } = {}) {
    const t = todayISO();
    const out = [];
    if (it.done) {
      out.push(`<span class="chip">hecha ${it.doneAt ? dateLabel(iso(new Date(it.doneAt))) : ''}</span>`);
    } else {
      if (it.date) {
        const n = diffDays(t, it.date);
        out.push(`<span class="chip ${n === 0 ? 'today' : n < 0 ? 'late' : ''}">${n < 0 ? 'era ' : ''}${dateLabel(it.date)}</span>`);
      }
      if (it.due) {
        const n = diffDays(t, it.due);
        out.push(`<span class="chip ${n < 0 ? 'over' : n <= 1 ? 'over' : 'late'}">${n < 0 ? 'venció ' : 'vence '}${dateLabel(it.due)}</span>`);
      }
    }
    if (withLinks && it.links.length) out.push(`<span class="chip">↔ ${it.links.length}</span>`);
    return out.join('');
  }

  const itemHTML = (it) => `
    <li class="item${it.done ? ' done' : ''}" data-id="${it.id}">
      <button class="check" aria-label="${it.done ? 'Marcar pendiente' : 'Marcar hecha'}"></button>
      <div class="body"><div class="text">${richText(it.text)}</div><div class="meta">${chipsFor(it)}</div></div>
    </li>`;
  const listHTML = (items) => `<ul class="list">${items.map(itemHTML).join('')}</ul>`;
  const section = (title, items, cls = '') => items.length ? `<div class="section-title ${cls}"><span>${title}</span><span>${items.length}</span></div>${listHTML(items)}` : '';
  const empty = (title, text) => `<div class="empty"><b>${title}</b>${text}</div>`;

  const ui = { view: 'inbox', inboxMode: 'pending', tag: null, query: '' };
  const main = $('#main');
  const titles = { inbox: 'Inbox', today: 'Fechas', tags: 'Etiquetas', search: 'Buscar' };

  function render() {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));
    $('#title').textContent = ui.view === 'tags' && ui.tag ? (ui.tag === '∅' ? 'Sin etiqueta' : '#' + ui.tag) : titles[ui.view];
    $('#backBtn').hidden = !(ui.view === 'tags' && ui.tag);
    const keepSearchFocus = ui.view === 'search' && document.activeElement && document.activeElement.id === 'searchInput';
    main.innerHTML = views[ui.view]();
    if (keepSearchFocus) { const s = $('#searchInput'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  const views = {
    inbox() {
      const pending = db.items.filter((i) => !i.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const done = db.items.filter((i) => i.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
      let html = backupBanner();
      html += `<div class="segmented"><button data-mode="pending" class="${ui.inboxMode === 'pending' ? 'on' : ''}">Pendientes · ${pending.length}</button><button data-mode="done" class="${ui.inboxMode === 'done' ? 'on' : ''}">Hechas · ${done.length}</button></div>`;
      const list = ui.inboxMode === 'pending' ? pending : done;
      if (!list.length) {
        html += ui.inboxMode === 'pending'
          ? empty('Mente despejada', 'Escribe arriba lo que tengas en la cabeza. Prueba: <i>Revisar raíces del pothos el sábado #casa #plantas</i>')
          : empty('Nada completado aún', 'Toca el círculo de una entrada para marcarla como hecha.');
      } else html += `<div style="height:8px"></div>` + listHTML(list);
      return html;
    },

    today() {
      const t = todayISO();
      const dated = db.items.filter((i) => !i.done && keyDate(i)).sort((a, b) => keyDate(a).localeCompare(keyDate(b)));
      const late = [], today = [], week = [], later = [];
      dated.forEach((i) => {
        const n = diffDays(t, keyDate(i));
        (n < 0 ? late : n === 0 ? today : n <= 7 ? week : later).push(i);
      });
      if (!dated.length) return empty('Nada con fecha', 'Las capturas con "hoy", "mañana", "el sábado", "15 nov" o "antes del viernes" aparecen aquí.');
      return section('Atrasado', late, 'over') + section('Hoy', today) + section('Próximos 7 días', week) + section('Más adelante', later) +
        (!today.length && !late.length ? '<p class="hint">Nada para hoy.</p>' : '');
    },

    tags() {
      if (ui.tag) {
        const has = ui.tag === '∅' ? (i) => !i.tags.length : (i) => i.tags.includes(ui.tag);
        const items = db.items.filter(has);
        const pending = items.filter((i) => !i.done).sort((a, b) => (keyDate(a) || '9').localeCompare(keyDate(b) || '9') || b.createdAt.localeCompare(a.createdAt));
        const done = items.filter((i) => i.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
        if (!items.length) return empty('Sin entradas', 'Ya no hay nada con esta etiqueta.');
        return section('Pendientes', pending) + section('Hechas', done);
      }
      const counts = new Map();
      let untagged = [0, 0];
      db.items.forEach((i) => {
        if (!i.tags.length) { untagged[1]++; if (!i.done) untagged[0]++; }
        i.tags.forEach((t) => { const c = counts.get(t) || [0, 0]; c[1]++; if (!i.done) c[0]++; counts.set(t, c); });
      });
      if (!counts.size && !untagged[1]) return empty('Sin etiquetas aún', 'Agrega #etiquetas al capturar: <i>#casa</i>, <i>#trabajo</i>, <i>#plantas</i>…');
      const chev = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
      const rows = [...counts.entries()].sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || a[0].localeCompare(b[0]))
        .map(([t, c]) => `<li data-tag="${esc(t)}"><span class="name tag">#${esc(t)}</span><span class="count"><b>${c[0]}</b> / ${c[1]}</span>${chev}</li>`);
      if (untagged[1]) rows.push(`<li data-tag="∅"><span class="name none">Sin etiqueta</span><span class="count"><b>${untagged[0]}</b> / ${untagged[1]}</span>${chev}</li>`);
      return `<p class="hint">Pendientes / total</p><ul class="taglist">${rows.join('')}</ul>`;
    },

    search() {
      let html = `<input id="searchInput" class="searchbox" type="search" placeholder="Buscar en todo (texto o #etiqueta)" value="${esc(ui.query)}" enterkeyhint="search">`;
      const terms = fold(ui.query).split(/\s+/).filter(Boolean);
      if (!terms.length) return html + '<p class="hint">Busca palabras sin preocuparte por acentos. Incluye entradas hechas.</p>';
      const hits = db.items.filter((i) => { const t = fold(i.text); return terms.every((w) => t.includes(w)); })
        .sort((a, b) => a.done - b.done || b.createdAt.localeCompare(a.createdAt));
      return html + (hits.length ? section('Resultados', hits) : '<p class="hint">Sin resultados.</p>');
    }
  };

  function backupBanner() {
    if (db.items.length < 5) return '';
    const last = db.meta.lastBackup;
    const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
    if (days !== null && days < 7) return '';
    return `<div class="banner"><span>${days === null ? 'Aún no has respaldado tus datos.' : `Último respaldo hace ${days} días.`}</span><button data-action="export">Exportar</button></div>`;
  }

  /* ---------------- Captura ---------------- */
  const input = $('#captureInput');
  const preview = $('#capturePreview');

  function previewChips(text) {
    const p = parse(text);
    const out = [];
    if (p.date) out.push(`<span class="chip today">${dateLabel(p.date)}</span>`);
    if (p.due) out.push(`<span class="chip over">vence ${dateLabel(p.due)}</span>`);
    p.tags.forEach((t) => out.push(`<span class="chip tag">#${esc(t)}</span>`));
    return out.join('');
  }

  input.addEventListener('input', () => { preview.innerHTML = input.value.trim() ? previewChips(input.value) : ''; });
  $('#capture').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const it = addItem(text);
    input.value = '';
    preview.innerHTML = '';
    if (ui.view !== 'inbox' && ui.view !== 'today') { ui.view = 'inbox'; ui.inboxMode = 'pending'; }
    if (ui.view === 'inbox') ui.inboxMode = 'pending';
    render();
    toast('Guardado', 'Editar', () => openSheet(it.id));
    input.focus(); // listo para la siguiente captura
  });

  /* ---------------- Interacción en listas ---------------- */
  main.addEventListener('click', (e) => {
    const el = e.target;
    const modeBtn = el.closest('[data-mode]');
    if (modeBtn) { ui.inboxMode = modeBtn.dataset.mode; render(); return; }
    if (el.closest('[data-action="export"]')) { exportData(); return; }

    const tagRow = el.closest('.taglist li');
    if (tagRow) { ui.tag = tagRow.dataset.tag; render(); window.scrollTo(0, 0); return; }

    const tagEl = el.closest('.tag[data-tag]');
    if (tagEl && el.closest('.item')) { ui.view = 'tags'; ui.tag = tagEl.dataset.tag; render(); window.scrollTo(0, 0); return; }

    const row = el.closest('.item');
    if (!row) return;
    const it = byId(row.dataset.id);
    if (!it) return;
    if (el.closest('.check')) {
      setDone(it, !it.done);
      save();
      row.classList.toggle('done', it.done);
      if (navigator.vibrate) navigator.vibrate(8);
      setTimeout(render, 350);
      if (it.done) toast('Hecha', 'Deshacer', () => { setDone(it, false); save(); render(); });
      return;
    }
    openSheet(it.id);
  });

  main.addEventListener('input', (e) => {
    if (e.target.id === 'searchInput') { ui.query = e.target.value; render(); }
  });

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.view;
    if (v === ui.view && v === 'tags') ui.tag = null; // tocar de nuevo vuelve a la lista de etiquetas
    ui.view = v;
    render();
    window.scrollTo(0, 0);
    if (v === 'search') $('#searchInput').focus();
  }));
  $('#backBtn').addEventListener('click', () => { ui.tag = null; render(); });

  /* ---------------- Hoja de detalle ---------------- */
  const sheet = $('#sheet');
  const fText = $('#fText'), fDate = $('#fDate'), fDue = $('#fDue'), fDone = $('#fDone');
  let editing = null; // { id, lastParse, touchedDate, touchedDue }

  function openSheet(id) {
    const it = byId(id);
    if (!it) return;
    editing = { id, lastParse: parse(it.text), touchedDate: false, touchedDue: false };
    fText.value = it.text;
    fDate.value = it.date || '';
    fDue.value = it.due || '';
    fDone.checked = it.done;
    renderSheetParts(it);
    sheet.hidden = false;
    autosize();
  }

  function renderSheetParts(it) {
    $('#fTags').innerHTML = parse(fText.value).tags.map((t) => `<span class="chip tag">#${esc(t)}</span>`).join('');
    const rel = it.links.map(byId).filter(Boolean);
    $('#relList').innerHTML = rel.map((o) => `<li data-id="${o.id}"><span class="t${o.done ? ' done' : ''}" data-open="${o.id}">${esc(o.text)}</span><button class="act rm" data-unlink="${o.id}" aria-label="Quitar relación">×</button></li>`).join('');
    const sim = similar(it);
    $('#simBlock').hidden = !sim.length;
    $('#simList').innerHTML = sim.map((o) => `<li><span class="t${o.done ? ' done' : ''}" data-open="${o.id}">${esc(o.text)}</span><button class="act" data-link="${o.id}">Relacionar</button></li>`).join('');
    const c = new Date(it.createdAt);
    $('#fCreated').textContent = 'Capturada el ' + c.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' a las ' + c.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function commitSheet() {
    if (!editing) return;
    const it = byId(editing.id);
    if (it) {
      const text = fText.value.trim() || it.text;
      const next = { text, tags: parse(text).tags, date: fDate.value || null, due: fDue.value || null };
      const changed = next.text !== it.text || next.date !== it.date || next.due !== it.due || fDone.checked !== it.done;
      Object.assign(it, next);
      if (fDone.checked !== it.done) setDone(it, fDone.checked);
      if (changed) { stamp(it); save(); }
    }
    editing = null;
  }

  function closeSheet() { commitSheet(); sheet.hidden = true; render(); }

  function autosize() { fText.style.height = 'auto'; fText.style.height = Math.min(fText.scrollHeight + 2, 220) + 'px'; }

  fText.addEventListener('input', () => {
    autosize();
    const it = byId(editing.id);
    const p = parse(fText.value);
    // Solo reinterpreta fechas si cambió la frase de fecha y no las ajustaste a mano
    if (!editing.touchedDate && p.date !== editing.lastParse.date) fDate.value = p.date || '';
    if (!editing.touchedDue && p.due !== editing.lastParse.due) fDue.value = p.due || '';
    editing.lastParse = p;
    $('#fTags').innerHTML = p.tags.map((t) => `<span class="chip tag">#${esc(t)}</span>`).join('');
    if (it) { /* relacionadas/parecidas se refrescan al cerrar */ }
  });
  fText.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fText.blur(); } });
  fDate.addEventListener('change', () => { editing.touchedDate = true; });
  fDue.addEventListener('change', () => { editing.touchedDue = true; });
  sheet.addEventListener('click', (e) => {
    const el = e.target;
    if (el.closest('[data-close]')) { closeSheet(); return; }
    const clr = el.closest('[data-clear]');
    if (clr) { e.preventDefault(); const f = $('#' + clr.dataset.clear); f.value = ''; if (f === fDate) editing.touchedDate = true; else editing.touchedDue = true; return; }
    const it = editing && byId(editing.id);
    if (!it) return;
    const ul = el.closest('[data-unlink]');
    if (ul) { unlink(it, byId(ul.dataset.unlink)); renderSheetParts(it); return; }
    const ln = el.closest('[data-link]');
    if (ln) { link(it, byId(ln.dataset.link)); renderSheetParts(it); toast('Relacionadas'); return; }
    const op = el.closest('[data-open]');
    if (op) { commitSheet(); openSheet(op.dataset.open); $('.panel', sheet).scrollTop = 0; }
  });

  $('#deleteBtn').addEventListener('click', () => {
    const it = editing && byId(editing.id);
    if (!it) return;
    if (!confirm('¿Borrar esta entrada?')) return;
    editing = null;
    const undo = removeItem(it);
    sheet.hidden = true;
    render();
    toast('Entrada borrada', 'Deshacer', () => { undo(); render(); });
  });

  /* ---------------- Selector de relación ---------------- */
  const picker = $('#picker'), pickerInput = $('#pickerInput'), pickerList = $('#pickerList');

  function renderPicker() {
    const it = byId(editing.id);
    const terms = fold(pickerInput.value).split(/\s+/).filter(Boolean);
    const cands = db.items
      .filter((o) => o.id !== it.id && !it.links.includes(o.id))
      .filter((o) => { const t = fold(o.text); return terms.every((w) => t.includes(w)); })
      .sort((a, b) => a.done - b.done || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);
    pickerList.innerHTML = cands.length
      ? cands.map((o) => `<li data-pick="${o.id}"><span class="t${o.done ? ' done' : ''}">${esc(o.text)}</span></li>`).join('')
      : '<li><span class="t" style="color:var(--muted)">Nada que coincida</span></li>';
  }
  $('#relAdd').addEventListener('click', () => { pickerInput.value = ''; renderPicker(); picker.hidden = false; });
  pickerInput.addEventListener('input', renderPicker);
  picker.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { picker.hidden = true; return; }
    const li = e.target.closest('[data-pick]');
    if (!li) return;
    const it = byId(editing.id);
    link(it, byId(li.dataset.pick));
    picker.hidden = true;
    renderSheetParts(it);
    toast('Relacionadas');
  });

  /* ---------------- Ajustes / respaldo ---------------- */
  const settings = $('#settings');
  $('#settingsBtn').addEventListener('click', () => { renderStats(); settings.hidden = false; });
  settings.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) settings.hidden = true; });

  function renderStats() {
    const pending = db.items.filter((i) => !i.done).length;
    const tags = new Set(db.items.flatMap((i) => i.tags)).size;
    const last = db.meta.lastBackup ? new Date(db.meta.lastBackup).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nunca';
    $('#stats').innerHTML = `<div><b>${db.items.length}</b><span>entradas</span></div><div><b>${pending}</b><span>pendientes</span></div><div><b>${tags}</b><span>etiquetas</span></div><div class="wide"><b>${last}</b><span>último respaldo</span></div>`;
  }

  async function exportData() {
    const name = `personal-os-${todayISO()}.json`;
    const json = JSON.stringify({ app: 'personal-os', schema: SCHEMA, exportedAt: new Date().toISOString(), items: db.items }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        markBackup();
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // cerraste el menú de compartir
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    markBackup();
  }
  function markBackup() { db.meta.lastBackup = new Date().toISOString(); save(); renderStats(); render(); toast('Respaldo exportado'); }

  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = (Array.isArray(data) ? data : data.items || []).map(normalize).filter(Boolean);
      if (!incoming.length) { alert('El archivo no contiene entradas válidas.'); return; }
      let added = 0, updated = 0;
      const plan = incoming.map((x) => {
        const cur = byId(x.id);
        if (!cur) { added++; return ['add', x]; }
        if (x.updatedAt > cur.updatedAt) { updated++; return ['upd', x]; }
        return null;
      }).filter(Boolean);
      if (!plan.length) { alert('Nada nuevo: todo lo del archivo ya está aquí.'); return; }
      if (!confirm(`Importar ${incoming.length} entradas:\n• ${added} nuevas\n• ${updated} actualizadas\nNo se borra nada.`)) return;
      plan.forEach(([k, x]) => { if (k === 'add') db.items.push(x); else Object.assign(byId(x.id), x); });
      save(); renderStats(); render();
      toast(`Importadas: ${added} nuevas, ${updated} actualizadas`);
    } catch (err) {
      alert('No pude leer el archivo: ' + err.message);
    }
  });

  /* ---------------- Toast ---------------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg, actionLabel, action) {
    clearTimeout(toastTimer);
    $('span', toastEl).textContent = msg;
    const btn = $('button', toastEl);
    btn.textContent = actionLabel || '';
    btn.onclick = () => { toastEl.hidden = true; action && action(); };
    toastEl.hidden = false;
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, actionLabel ? 4500 : 1800);
  }

  /* ---------------- Arranque ---------------- */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { db = load(); render(); } });
  render();
})();
