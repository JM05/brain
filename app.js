/* Personal OS · V0.2 — captura, foco (máx. 3, al menos 1 fuera de Trabajo), algún día, dominios, etiquetas,
   relaciones, respaldo. Datos solo en este dispositivo. */
(() => {
  'use strict';

  const KEY = 'pos.v1';
  const SCHEMA = 3;
  const FOCUS_MAX = 3;
  const WORK = 'trabajo';
  const { parse, fold, iso } = window.PosParse;
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------------- Dominios por defecto ---------------- */
  const PALETTE = ['#5b6b8c', '#3f8f5b', '#c0573e', '#7a5ea8', '#c28a1e', '#d0487a', '#3c8a95', '#8a6d4f', '#4f7cc4', '#9a9a3a'];
  const DEFAULT_DOMAINS = [
    { id: 'trabajo', name: 'Trabajo', color: PALETTE[0] },
    { id: 'dinero', name: 'Dinero', color: PALETTE[1] },
    { id: 'cuerpo', name: 'Cuerpo', color: PALETTE[2] },
    { id: 'mente', name: 'Mente', color: PALETTE[3] },
    { id: 'construir', name: 'Construir', color: PALETTE[4] },
    { id: 'disfrute', name: 'Disfrute', color: PALETTE[5] },
    { id: 'hogar', name: 'Hogar y gente', color: PALETTE[6] }
  ];
  // Solo sugerencias: nunca se aplican sin que las aceptes
  const SUGGEST = {
    trabajo: 'trabajo', productividad: 'trabajo', procurement: 'trabajo', oficina: 'trabajo', jefe: 'trabajo', equipo: 'trabajo',
    dinero: 'dinero', ingresos: 'dinero', ahorros: 'dinero', ahorro: 'dinero', finanzas: 'dinero', inversion: 'dinero', inversiones: 'dinero', acciones: 'dinero', gastos: 'dinero',
    ejercicio: 'cuerpo', gym: 'cuerpo', salud: 'cuerpo', hyrox: 'cuerpo', correr: 'cuerpo', comida: 'cuerpo', dieta: 'cuerpo', habitos: 'cuerpo', deporte: 'cuerpo', padel: 'cuerpo',
    educacion: 'mente', eduacion: 'mente', aprendizaje: 'mente', aprender: 'mente', ia: 'mente', claude: 'mente', chatgpt: 'mente', autoconocimiento: 'mente', desarrollopersonal: 'mente', observacion: 'mente', ingles: 'mente', mba: 'mente', gre: 'mente', lectura: 'mente', libros: 'mente',
    proyectos: 'construir', proyecto: 'construir', app: 'construir', apps: 'construir', negocio: 'construir', codigo: 'construir', web: 'construir',
    hiking: 'disfrute', viaje: 'disfrute', viajes: 'disfrute', montana: 'disfrute', hobby: 'disfrute', hobbies: 'disfrute', diversion: 'disfrute', espana: 'disfrute', chile: 'disfrute', argentina: 'disfrute', pinguinos: 'disfrute', musica: 'disfrute', cine: 'disfrute',
    casa: 'hogar', plantas: 'hogar', familia: 'hogar', amigos: 'hogar', hermana: 'hogar', hermano: 'hogar', pareja: 'hogar', regalos: 'hogar'
  };

  /* ---------------- Datos ---------------- */
  let db = load();

  function load() {
    let items = [], meta = {};
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.items)) { items = d.items.map(normalize).filter(Boolean); meta = d.meta || {}; }
      }
    } catch (e) { console.error(e); }
    if (!Array.isArray(meta.domains) || !meta.domains.length) meta.domains = DEFAULT_DOMAINS.map((d) => ({ ...d }));
    if (!meta.tagDomain || typeof meta.tagDomain !== 'object') meta.tagDomain = {};
    return { items, meta };
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
    const isDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const done = !!x.done;
    const someday = !done && !!x.someday;
    const focus = !done && !someday && !!x.focus;
    return {
      id: String(x.id),
      text: x.text,
      tags: Array.isArray(x.tags) ? x.tags.map(String) : parse(x.text).tags,
      domain: typeof x.domain === 'string' && x.domain ? x.domain : null,
      date: isDate(x.date),
      due: isDate(x.due),
      done,
      doneAt: done ? x.doneAt || x.updatedAt || now : null,
      someday,
      focus,
      focusAt: focus ? x.focusAt || now : null,
      createdAt: x.createdAt || now,
      updatedAt: x.updatedAt || x.createdAt || now,
      links: Array.isArray(x.links) ? [...new Set(x.links.map(String))] : []
    };
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const byId = (id) => db.items.find((i) => i.id === id);
  const stamp = (it) => { it.updatedAt = new Date().toISOString(); };
  const statusOf = (it) => (it.done ? 'done' : it.someday ? 'someday' : 'active');
  const focusItems = () => db.items.filter((i) => i.focus);

  /* ---------------- Dominios ---------------- */
  const domainById = (id) => db.meta.domains.find((d) => d.id === id) || null;
  function domainInfo(it) {
    if (it.domain && domainById(it.domain)) return { id: it.domain, via: null };
    for (const t of it.tags) { const d = db.meta.tagDomain[t]; if (d && domainById(d)) return { id: d, via: t }; }
    return { id: null, via: null };
  }
  const domainOf = (it) => domainInfo(it).id;
  const suggestFor = (t) => { const s = SUGGEST[fold(t)]; return s && domainById(s) ? s : null; };
  const unmappedTags = () => [...tagCounts().keys()].filter((t) => !domainById(db.meta.tagDomain[t]));

  // Regla: si hay 3 en foco, al menos 1 no es de Trabajo
  function focusBreaksRule(candidate) {
    const set = [...focusItems().filter((i) => i.id !== candidate.id), candidate];
    return domainById(WORK) && set.length >= FOCUS_MAX && set.every((i) => domainOf(i) === WORK);
  }

  function addItem(text) {
    const p = parse(text);
    const now = new Date().toISOString();
    const it = normalize({ id: uid(), text, tags: p.tags, date: p.date, due: p.due, someday: p.someday, createdAt: now, updatedAt: now });
    db.items.unshift(it);
    save();
    return it;
  }

  function setStatus(it, s) {
    it.done = s === 'done';
    it.doneAt = it.done ? it.doneAt || new Date().toISOString() : null;
    it.someday = s === 'someday';
    if (s !== 'active') { it.focus = false; it.focusAt = null; }
    stamp(it);
  }

  // Devuelve null si se pudo, o el motivo si no
  function setFocus(it, on) {
    if (on === it.focus) return null;
    if (on && focusItems().length >= FOCUS_MAX) return 'full';
    if (on && focusBreaksRule(it)) return 'work';
    if (on) { setStatus(it, 'active'); it.focus = true; it.focusAt = new Date().toISOString(); }
    else { it.focus = false; it.focusAt = null; }
    stamp(it);
    return null;
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
    return () => {
      db.items.push(it);
      touched.forEach((id) => { const o = byId(id); if (o && !o.links.includes(it.id)) o.links.push(it.id); });
      save();
    };
  }

  /* ---------------- Etiquetas ---------------- */
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRe = (t) => new RegExp(`(^|[\\s(])#${reEsc(t)}(?![\\p{L}\\p{N}_-])`, 'giu');

  function tagCounts() {
    const m = new Map();
    db.items.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return m;
  }

  function renameTag(oldT, newT) {
    const affected = db.items.filter((i) => i.tags.includes(oldT));
    const snapshot = affected.map((i) => [i, i.text, i.tags, i.updatedAt]);
    const oldMap = db.meta.tagDomain[oldT];
    affected.forEach((it) => {
      let text = it.text.replace(tagRe(oldT), (m, pre) => (newT ? `${pre}#${newT}` : pre));
      if (newT) {
        let seen = false;
        text = text.replace(tagRe(newT), (m, pre) => { if (seen) return pre === '(' ? pre : ''; seen = true; return m; });
      }
      it.text = text.replace(/[ \t]{2,}/g, ' ').trim() || it.text;
      it.tags = parse(it.text).tags;
      stamp(it);
    });
    const hadNewMap = newT ? db.meta.tagDomain[newT] : undefined;
    if (newT && oldMap && !hadNewMap) db.meta.tagDomain[newT] = oldMap;
    delete db.meta.tagDomain[oldT];
    save();
    return {
      count: affected.length,
      undo: () => {
        snapshot.forEach(([i, t, g, u]) => { i.text = t; i.tags = g; i.updatedAt = u; });
        if (oldMap) db.meta.tagDomain[oldT] = oldMap;
        if (newT && oldMap && !hadNewMap) delete db.meta.tagDomain[newT];
        save();
      }
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
  const daysSince = (isoTs) => Math.max(0, diffDays(iso(new Date(isoTs)), todayISO()));

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
  function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  const since = (days) => new Date(Date.now() - days * 864e5).toISOString();

  /* ---------------- Similitud por texto ---------------- */
  const STOP = new Set(('de la el los las un una unos unas y o u a e en con por para que se mi mis tu tus su sus al del lo le les me te nos es son ser estar esta este esto eso esa ese estos esas hay muy mas menos ya no si sobre entre como cuando donde tengo tiene tener quiero quiere hacer hago ver algo todo todos toda cosa cosas otra otro otros vez bien tambien pero sin hasta desde antes despues hoy manana pasado algun ' +
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
      .map(({ o, t }) => { let s = 0; mine.forEach((w) => { if (t.has(w)) s += Math.log(1 + N / df.get(w)); }); return { o, s }; })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.o.done - b.o.done)
      .slice(0, limit)
      .map((x) => x.o);
  }

  /* ---------------- Render ---------------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const richText = (s) => esc(s).replace(/(^|[\s(])#([\p{L}\p{N}_-]+)/gu, (m, pre, t) => `${pre}<span class="tag" data-tag="${t.toLowerCase()}">#${t}</span>`);
  const dot = (d) => `<i class="dot" style="--dc:${d ? d.color : 'var(--muted)'}"></i>`;

  function chipsFor(it, opts = {}) {
    const t = todayISO();
    const out = [];
    if (!opts.noDomain) { const d = domainById(domainOf(it)); if (d) out.push(`<span class="chip dom" data-domain="${d.id}">${dot(d)}${esc(d.name)}</span>`); }
    if (it.done) {
      out.push(`<span class="chip">hecha ${it.doneAt ? dateLabel(iso(new Date(it.doneAt))) : ''}</span>`);
    } else {
      if (it.focus) { const n = daysSince(it.focusAt); out.push(`<span class="chip focus">★ foco${n ? ` · ${n} d` : ''}</span>`); }
      if (it.someday && !opts.inSomeday) out.push('<span class="chip">algún día</span>');
      if (it.date) {
        const n = diffDays(t, it.date);
        out.push(`<span class="chip ${n === 0 ? 'today' : n < 0 ? 'late' : ''}">${n < 0 ? 'era ' : ''}${dateLabel(it.date)}</span>`);
      }
      if (it.due) {
        const n = diffDays(t, it.due);
        out.push(`<span class="chip ${n <= 1 ? 'over' : 'late'}">${n < 0 ? 'venció ' : 'vence '}${dateLabel(it.due)}</span>`);
      }
    }
    if (it.links.length) out.push(`<span class="chip">↔ ${it.links.length}</span>`);
    return out.join('');
  }

  const itemHTML = (it, opts) => `
    <li class="item${it.done ? ' done' : ''}${it.focus ? ' focused' : ''}" data-id="${it.id}">
      <button class="check" aria-label="${it.done ? 'Marcar pendiente' : 'Marcar hecha'}"></button>
      <div class="body"><div class="text">${richText(it.text)}</div><div class="meta">${chipsFor(it, opts)}</div></div>
    </li>`;
  const listHTML = (items, opts) => `<ul class="list">${items.map((i) => itemHTML(i, opts)).join('')}</ul>`;
  const section = (title, items, cls = '', right, opts) => (items.length ? `<div class="section-title ${cls}"><span>${title}</span><span>${right ?? items.length}</span></div>${listHTML(items, opts)}` : '');
  const empty = (title, text) => `<div class="empty"><b>${title}</b>${text}</div>`;
  const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);
  const chev = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

  /* Navegación: pestañas + pila para "Volver" */
  let ui = { view: 'inbox', inboxMode: 'active', tag: null, domain: null, query: '' };
  let stack = [];
  const main = $('#main');
  const tabOf = (v) => (v === 'tags' ? 'domains' : v);

  function go(next) { stack.push({ ...ui }); Object.assign(ui, next); render(); window.scrollTo(0, 0); }
  function back() { if (stack.length) { ui = stack.pop(); render(); window.scrollTo(0, 0); } }

  function title() {
    if (ui.view === 'tags') return ui.tag ? (ui.tag === '∅' ? 'Sin etiqueta' : '#' + ui.tag) : 'Etiquetas';
    if (ui.view === 'domains' && ui.domain) return ui.domain === '∅' ? 'Sin dominio' : (domainById(ui.domain) || {}).name || 'Dominio';
    return { inbox: 'Inbox', today: 'Fechas', domains: 'Dominios', search: 'Buscar' }[ui.view];
  }

  function render() {
    if (ui.view === 'domains' && ui.domain && ui.domain !== '∅' && !domainById(ui.domain)) ui.domain = null;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === tabOf(ui.view)));
    $('#title').textContent = title();
    $('#backBtn').hidden = !stack.length;
    const keepSearchFocus = ui.view === 'search' && document.activeElement && document.activeElement.id === 'searchInput';
    main.innerHTML = views[ui.view]();
    if (keepSearchFocus) { const s = $('#searchInput'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  const views = {
    inbox() {
      const active = db.items.filter((i) => statusOf(i) === 'active');
      const someday = db.items.filter((i) => statusOf(i) === 'someday');
      const done = db.items.filter((i) => i.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
      const m = ui.inboxMode;
      let html = backupBanner();
      html += `<div class="segmented">
        <button data-mode="active" class="${m === 'active' ? 'on' : ''}">Activas · ${active.length}</button>
        <button data-mode="someday" class="${m === 'someday' ? 'on' : ''}">Algún día · ${someday.length}</button>
        <button data-mode="done" class="${m === 'done' ? 'on' : ''}">Hechas · ${done.length}</button></div>`;

      if (m === 'active') {
        const ws = weekStart().toISOString();
        const doneWeek = done.filter((i) => i.doneAt >= ws).length;
        const focus = active.filter((i) => i.focus).sort((a, b) => a.focusAt.localeCompare(b.focusAt));
        const rest = active.filter((i) => !i.focus).sort(newestFirst);
        const dots = focus.map((i) => dot(domainById(domainOf(i)))).join('');
        html += `<p class="pulse"><b>${doneWeek}</b> ${doneWeek === 1 ? 'hecha' : 'hechas'} esta semana · <b>${focus.length}/${FOCUS_MAX}</b> en foco ${dots}</p>`;
        if (focus.length === 2 && focus.every((i) => domainOf(i) === WORK) && domainById(WORK)) {
          html += '<p class="hint nudge">Tus 2 en foco son de Trabajo. La tercera tiene que ser para ti.</p>';
        }
        if (!active.length) return html + empty('Mente despejada', 'Escribe arriba lo que tengas en la cabeza. Si es un deseo sin prisa, incluye <i>algún día</i>.');
        html += focus.length
          ? section('★ En foco', focus, 'focus', `${focus.length}/${FOCUS_MAX}`)
          : '<p class="hint focus-hint">Elige hasta 3 cosas en foco (al menos una que no sea de Trabajo): abre una entrada y activa <b>★ En foco</b>. Lo demás puede esperar.</p>';
        return html + section('Pendientes', rest);
      }

      if (m === 'someday') {
        if (!someday.length) return html + empty('Nada en algún día', 'Los deseos sin prisa viven aquí, sin presión. Escribe <i>algún día</i> al capturar o cámbialo en el detalle.');
        html += '<p class="hint">Sin presión. En tu revisión semanal, sube lo que toque a foco y borra lo que ya no te emocione.</p>';
        return html + groupByDomain(someday.sort(newestFirst), { inSomeday: true, noDomain: true });
      }

      if (!done.length) return html + empty('Nada completado aún', 'Toca el círculo de una entrada para marcarla como hecha.');
      return html + '<div style="height:8px"></div>' + listHTML(done);
    },

    today() {
      const t = todayISO();
      const dated = db.items.filter((i) => !i.done && keyDate(i)).sort((a, b) => keyDate(a).localeCompare(keyDate(b)));
      const late = [], today = [], week = [], later = [];
      dated.forEach((i) => { const n = diffDays(t, keyDate(i)); (n < 0 ? late : n === 0 ? today : n <= 7 ? week : later).push(i); });
      if (!dated.length) return empty('Nada con fecha', 'Las capturas con "hoy", "mañana", "el sábado", "15 nov" o "antes del viernes" aparecen aquí.');
      return section('Atrasado', late, 'over') + section('Hoy', today) + section('Próximos 7 días', week) + section('Más adelante', later) +
        (!today.length && !late.length ? '<p class="hint">Nada para hoy.</p>' : '');
    },

    domains() {
      if (ui.domain) return domainDetail(ui.domain);
      const s28 = since(28);
      const rows = [...db.meta.domains.map((d) => d.id), '∅'].map((id) => {
        const items = db.items.filter((i) => (domainOf(i) || '∅') === id);
        return {
          id, d: domainById(id), items,
          focus: items.filter((i) => i.focus).length,
          active: items.filter((i) => statusOf(i) === 'active').length,
          someday: items.filter((i) => statusOf(i) === 'someday').length,
          done28: items.filter((i) => i.done && i.doneAt >= s28).length
        };
      }).filter((r) => r.id !== '∅' || r.items.length);
      const maxDone = Math.max(1, ...rows.map((r) => r.done28));
      const oldest = db.items.reduce((m, i) => (i.createdAt < m ? i.createdAt : m), new Date().toISOString());
      const mature = oldest <= s28; // ya hay 4 semanas de historial
      const totalDone = rows.reduce((a, r) => a + r.done28, 0);

      let html = insight(rows, totalDone, mature);
      html += `<p class="hint">Barra = lo que completaste en las últimas 4 semanas${mature ? '' : ' (se llena conforme uses la app)'}. Toca un dominio para ver todo.</p><div class="domcards">`;
      html += rows.map((r) => {
        const name = r.d ? esc(r.d.name) : 'Sin dominio';
        const stale = mature && r.d && r.items.some((i) => !i.done) && r.done28 === 0;
        return `<button class="domcard" data-domain="${r.id}" style="--dc:${r.d ? r.d.color : 'var(--muted)'}">
          <div class="dc-head">${dot(r.d)}<b>${name}</b>${r.focus ? `<span class="dc-focus">★ ${r.focus}</span>` : ''}</div>
          <div class="dc-bar"><span style="width:${(r.done28 / maxDone) * 100}%"></span></div>
          <div class="dc-nums"><b>${r.done28}</b> hechas · ${r.active} activas · ${r.someday} algún día</div>
          ${stale ? '<div class="dc-warn">Sin nada completado en 4 semanas</div>' : ''}
        </button>`;
      }).join('') + '</div>';

      const um = unmappedTags().sort((a, b) => (tagCounts().get(b) || 0) - (tagCounts().get(a) || 0));
      if (um.length) {
        const sug = um.filter(suggestFor);
        html += `<div class="section-title"><span>Etiquetas sin dominio</span><span>${um.length}</span></div>`;
        if (sug.length) html += `<button class="bulkbtn strong" data-act="acceptAll">Aceptar ${sug.length} ${sug.length === 1 ? 'sugerencia' : 'sugerencias'}</button>`;
        html += '<ul class="taglist">' + um.map((t) => {
          const s = domainById(suggestFor(t));
          return `<li data-maptag="${esc(t)}"><span class="name tag">#${esc(t)}</span>${s ? `<button class="sugbtn" data-accept="${esc(t)}" style="--dc:${s.color}">${dot(s)}${esc(s.name)} ✓</button>` : '<span class="count">elegir</span>'}${chev}</li>`;
        }).join('') + '</ul>';
      }
      html += `<div class="rowbtns"><button class="ghostbtn" data-act="allTags">Todas las etiquetas</button><button class="ghostbtn" data-act="newDomain">+ Nuevo dominio</button></div>`;
      return html;
    },

    tags() {
      if (ui.tag) {
        const has = ui.tag === '∅' ? (i) => !i.tags.length : (i) => i.tags.includes(ui.tag);
        const items = db.items.filter(has);
        const by = (s) => items.filter((i) => statusOf(i) === s);
        let head = '';
        if (ui.tag !== '∅') {
          const d = domainById(db.meta.tagDomain[ui.tag]);
          head += `<button class="field navrow single" data-act="mapTag"><span>Dominio</span><span class="domval"><span class="dname">${d ? dot(d) + esc(d.name) : '<i class="muted">sin asignar</i>'}</span></span>${chev}</button>`;
          head += `<div class="tagactions"><button data-tagact="rename">Renombrar o fusionar</button><button data-tagact="remove" class="danger">Quitar etiqueta</button></div>`;
        }
        if (!items.length) return head + empty('Sin entradas', 'Ya no hay nada con esta etiqueta.');
        const movable = by('active').filter((i) => !i.focus).length;
        const bulk = movable ? `<button class="bulkbtn" data-tagact="someday">Mover ${movable} ${movable === 1 ? 'activa' : 'activas'} a algún día</button>` : '';
        const act = by('active').sort((a, b) => b.focus - a.focus || (keyDate(a) || '9').localeCompare(keyDate(b) || '9') || newestFirst(a, b));
        return head + bulk + section('Activas', act) + section('Algún día', by('someday').sort(newestFirst), '', undefined, { inSomeday: true }) +
          section('Hechas', by('done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')));
      }
      const counts = new Map();
      const untagged = [0, 0];
      db.items.forEach((i) => {
        const a = statusOf(i) === 'active' ? 1 : 0;
        if (!i.tags.length) { untagged[1]++; untagged[0] += a; }
        i.tags.forEach((t) => { const c = counts.get(t) || [0, 0]; c[1]++; c[0] += a; counts.set(t, c); });
      });
      if (!counts.size && !untagged[1]) return empty('Sin etiquetas aún', 'Agrega #etiquetas al capturar: <i>#casa</i>, <i>#trabajo</i>, <i>#plantas</i>…');
      const rows = [...counts.entries()].sort((a, b) => b[1][1] - a[1][1] || b[1][0] - a[1][0] || a[0].localeCompare(b[0]))
        .map(([t, c]) => `<li data-tag="${esc(t)}">${dot(domainById(db.meta.tagDomain[t]))}<span class="name tag">#${esc(t)}</span><span class="count"><b>${c[0]}</b> / ${c[1]}</span>${chev}</li>`);
      if (untagged[1]) rows.push(`<li data-tag="∅"><span class="name none">Sin etiqueta</span><span class="count"><b>${untagged[0]}</b> / ${untagged[1]}</span>${chev}</li>`);
      return `<p class="hint">Activas / total · el punto es el color del dominio</p><ul class="taglist">${rows.join('')}</ul>`;
    },

    search() {
      const html = `<input id="searchInput" class="searchbox" type="search" placeholder="Buscar en todo (texto o #etiqueta)" value="${esc(ui.query)}" enterkeyhint="search">`;
      const terms = fold(ui.query).split(/\s+/).filter(Boolean);
      if (!terms.length) return html + '<p class="hint">Busca palabras sin preocuparte por acentos. Incluye algún día y hechas.</p>';
      const rank = { active: 0, someday: 1, done: 2 };
      const hits = db.items.filter((i) => { const t = fold(i.text); return terms.every((w) => t.includes(w)); })
        .sort((a, b) => rank[statusOf(a)] - rank[statusOf(b)] || newestFirst(a, b));
      return html + (hits.length ? section('Resultados', hits) : '<p class="hint">Sin resultados.</p>');
    }
  };

  function groupByDomain(items, opts) {
    const groups = new Map();
    items.forEach((i) => { const k = domainOf(i) || '∅'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
    const order = [...db.meta.domains.map((d) => d.id), '∅'];
    return order.filter((k) => groups.has(k)).map((k) => {
      const d = domainById(k);
      return section(d ? `${dot(d)} ${esc(d.name)}` : 'Sin dominio', groups.get(k), 'withdot', undefined, opts);
    }).join('');
  }

  function domainDetail(id) {
    const items = db.items.filter((i) => (domainOf(i) || '∅') === id);
    const by = (s) => items.filter((i) => statusOf(i) === s);
    let html = '';
    if (id !== '∅') {
      const tags = Object.entries(db.meta.tagDomain).filter(([, d]) => d === id).map(([t]) => t).filter((t) => tagCounts().has(t)).sort();
      html += `<div class="tagactions"><button data-act="renameDomain">Renombrar</button><button data-act="deleteDomain" class="danger">Borrar dominio</button></div>`;
      if (tags.length) html += `<div class="chips domtags">${tags.map((t) => `<button class="chip tag" data-gotag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`;
    } else {
      html += '<p class="hint">Estas entradas no tienen etiquetas con dominio. Abre una para elegir su dominio, o agrégale una #etiqueta.</p>';
    }
    if (!items.length) return html + empty('Vacío por ahora', 'Asigna etiquetas a este dominio desde la vista Dominios o desde cada etiqueta.');
    const act = by('active').sort((a, b) => b.focus - a.focus || newestFirst(a, b));
    return html + section('Activas', act, '', undefined, { noDomain: true }) +
      section('Algún día', by('someday').sort(newestFirst), '', undefined, { inSomeday: true, noDomain: true }) +
      section('Hechas', by('done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')), '', undefined, { noDomain: true });
  }

  function insight(rows, totalDone, mature) {
    const work = rows.find((r) => r.id === WORK);
    if (work && totalDone >= 5 && work.done28 / totalDone >= 0.6) {
      return `<p class="insight">Trabajo se llevó el <b>${Math.round((work.done28 / totalDone) * 100)}%</b> de lo que completaste en 4 semanas.</p>`;
    }
    const biggest = rows.filter((r) => r.d && r.id !== WORK && r.done28 === 0).sort((a, b) => (b.someday + b.active) - (a.someday + a.active))[0];
    if (biggest && biggest.someday + biggest.active >= 5) {
      return `<p class="insight"><b>${esc(biggest.d.name)}</b> tiene ${biggest.someday + biggest.active} cosas esperando y nada completado${mature ? ' en 4 semanas' : ' todavía'}. ¿Una de ellas a foco?</p>`;
    }
    return '';
  }

  function backupBanner() {
    if (db.items.length < 5) return '';
    const last = db.meta.lastBackup;
    const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
    if (days !== null && days < 7) return '';
    return `<div class="banner"><span>${days === null ? 'Aún no has respaldado tus datos.' : `Último respaldo hace ${days} días.`}</span><button data-action="export">Exportar</button></div>`;
  }

  /* ---------------- Selector de dominio ---------------- */
  const dpick = $('#dpick');
  let dpickResolve = null;
  function pickDomain({ title, sub = '', current = null, suggested = null, clearLabel = null }) {
    $('#dpickTitle').textContent = title;
    $('#dpickSub').textContent = sub;
    $('#dpickList').innerHTML = db.meta.domains.map((d) =>
      `<button class="dombtn${d.id === current ? ' on' : ''}" data-pick="${d.id}" style="--dc:${d.color}">${dot(d)}<span>${esc(d.name)}</span>${d.id === suggested ? '<small>sugerido</small>' : ''}</button>`).join('') +
      (clearLabel ? `<button class="dombtn clear" data-pick="">${esc(clearLabel)}</button>` : '');
    dpick.hidden = false;
    return new Promise((res) => { dpickResolve = res; });
  }
  dpick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b && !e.target.closest('[data-close]')) return;
    dpick.hidden = true;
    const r = dpickResolve; dpickResolve = null;
    if (r) r(b ? b.dataset.pick : null);
  });

  async function mapTagFlow(t) {
    const cur = db.meta.tagDomain[t] || null;
    const id = await pickDomain({ title: `#${t}`, sub: '¿A qué dominio pertenece esta etiqueta? Aplica a todas sus entradas y a las futuras.', current: cur, suggested: suggestFor(t), clearLabel: cur ? 'Quitar dominio' : null });
    if (id === null) return false;
    if (id) db.meta.tagDomain[t] = id; else delete db.meta.tagDomain[t];
    save(); render();
    return true;
  }

  /* ---------------- Autocompletar etiquetas ---------------- */
  function tagToken(el) {
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const m = before.match(/(^|[\s(])#([\p{L}\p{N}_-]*)$/u);
    return m ? { start: pos - m[2].length - 1, end: pos, prefix: m[2] } : null;
  }

  function suggestHTML(el) {
    const tok = tagToken(el);
    if (!tok) return null;
    const p = fold(tok.prefix);
    const used = new Set(parse(el.value.slice(0, tok.start) + el.value.slice(tok.end)).tags);
    const counts = tagCounts();
    const list = [...counts.entries()]
      .filter(([t]) => !used.has(t) && (fold(t).startsWith(p) || (p.length >= 2 && fold(t).includes(p))))
      .sort((a, b) => fold(b[0]).startsWith(p) - fold(a[0]).startsWith(p) || b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8);
    const exact = list.some(([t]) => fold(t) === p);
    let html = list.map(([t, n]) => `<button type="button" class="chip tag sug" data-sug="${esc(t)}">${dot(domainById(db.meta.tagDomain[t]))}#${esc(t)} <small>${n}</small></button>`).join('');
    if (p && !exact) html += `<span class="chip newtag">#${esc(tok.prefix.toLowerCase())} · nueva</span>`;
    return html || '<span class="chip newtag">escribe una etiqueta</span>';
  }

  function applySuggestion(el, t) {
    const tok = tagToken(el);
    if (!tok) return;
    const after = el.value.slice(tok.end).replace(/^[\p{L}\p{N}_-]*/u, '').replace(/^\s*/, '');
    const ins = `#${t} `;
    el.value = el.value.slice(0, tok.start) + ins + after;
    const caret = tok.start + ins.length;
    el.focus();
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function bindSuggest(container, el) {
    container.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-sug]');
      if (!b) return;
      e.preventDefault();
      applySuggestion(el, b.dataset.sug);
    });
  }

  /* ---------------- Captura ---------------- */
  const input = $('#captureInput');
  const preview = $('#capturePreview');

  function previewChips(text) {
    const p = parse(text);
    const out = [];
    const d = domainById(domainOf({ domain: null, tags: p.tags }));
    if (d) out.push(`<span class="chip dom">${dot(d)}${esc(d.name)}</span>`);
    if (p.someday) out.push('<span class="chip">algún día</span>');
    if (p.date) out.push(`<span class="chip today">${dateLabel(p.date)}</span>`);
    if (p.due) out.push(`<span class="chip over">vence ${dateLabel(p.due)}</span>`);
    p.tags.forEach((t) => out.push(`<span class="chip tag">#${esc(t)}</span>`));
    return out.join('');
  }
  function updatePreview() {
    if (!input.value.trim()) { preview.innerHTML = ''; return; }
    preview.innerHTML = suggestHTML(input) ?? previewChips(input.value);
  }

  input.addEventListener('input', updatePreview);
  input.addEventListener('click', updatePreview);
  bindSuggest(preview, input);

  $('#capture').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const it = addItem(text);
    input.value = '';
    preview.innerHTML = '';
    if (ui.view === 'search') { stack = []; ui.view = 'inbox'; }
    if (ui.view === 'inbox') ui.inboxMode = it.someday ? 'someday' : 'active';
    render();
    const newTag = !domainOf(it) && it.tags.find((t) => !domainById(db.meta.tagDomain[t]));
    if (newTag) toast(`#${newTag} no tiene dominio`, 'Asignar', () => mapTagFlow(newTag));
    else toast(it.someday ? 'Guardado en algún día' : 'Guardado', 'Editar', () => openSheet(it.id));
    input.focus();
  });

  /* ---------------- Interacción en listas ---------------- */
  main.addEventListener('click', async (e) => {
    const el = e.target;
    const modeBtn = el.closest('[data-mode]');
    if (modeBtn) { ui.inboxMode = modeBtn.dataset.mode; render(); return; }
    if (el.closest('[data-action="export"]')) { exportData(); return; }
    const ta = el.closest('[data-tagact]');
    if (ta) { tagAction(ta.dataset.tagact); return; }
    const act = el.closest('[data-act]');
    if (act) { domainAction(act.dataset.act); return; }

    const acc = el.closest('[data-accept]');
    if (acc) { const t = acc.dataset.accept; db.meta.tagDomain[t] = suggestFor(t); save(); render(); return; }
    const mt = el.closest('[data-maptag]');
    if (mt) { mapTagFlow(mt.dataset.maptag); return; }
    const gt = el.closest('[data-gotag]');
    if (gt) { go({ view: 'tags', tag: gt.dataset.gotag }); return; }

    const dc = el.closest('.domcard');
    if (dc) { go({ view: 'domains', domain: dc.dataset.domain }); return; }
    const tagRow = el.closest('.taglist li[data-tag]');
    if (tagRow) { go({ view: 'tags', tag: tagRow.dataset.tag }); return; }

    const inItem = el.closest('.item');
    const tagEl = el.closest('.tag[data-tag]');
    if (tagEl && inItem) { go({ view: 'tags', tag: tagEl.dataset.tag }); return; }
    const domEl = el.closest('.chip.dom[data-domain]');
    if (domEl && inItem) { go({ view: 'domains', domain: domEl.dataset.domain }); return; }

    if (!inItem) return;
    const it = byId(inItem.dataset.id);
    if (!it) return;
    if (el.closest('.check')) {
      const prev = statusOf(it), prevFocus = it.focus, prevFocusAt = it.focusAt;
      setStatus(it, it.done ? 'active' : 'done');
      save();
      inItem.classList.toggle('done', it.done);
      if (navigator.vibrate) navigator.vibrate(8);
      setTimeout(render, 350);
      if (it.done) toast('Hecha', 'Deshacer', () => { setStatus(it, prev); it.focus = prevFocus; it.focusAt = prevFocusAt; save(); render(); });
      return;
    }
    openSheet(it.id);
  });

  main.addEventListener('input', (e) => {
    if (e.target.id === 'searchInput') { ui.query = e.target.value; render(); }
  });

  function domainAction(kind) {
    if (kind === 'allTags') { go({ view: 'tags', tag: null }); return; }
    if (kind === 'mapTag') { mapTagFlow(ui.tag); return; }
    if (kind === 'acceptAll') {
      const prev = { ...db.meta.tagDomain };
      const sug = unmappedTags().filter(suggestFor);
      sug.forEach((t) => { db.meta.tagDomain[t] = suggestFor(t); });
      save(); render();
      toast(`${sug.length} etiquetas asignadas`, 'Deshacer', () => { db.meta.tagDomain = prev; save(); render(); });
      return;
    }
    if (kind === 'newDomain') {
      const name = (prompt('Nombre del nuevo dominio') || '').trim();
      if (!name) return;
      const id = fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
      db.meta.domains.push({ id, name, color: PALETTE[db.meta.domains.length % PALETTE.length] });
      save(); render(); toast(`Dominio "${name}" creado`);
      return;
    }
    const d = domainById(ui.domain);
    if (!d) return;
    if (kind === 'renameDomain') {
      const name = (prompt('Nuevo nombre', d.name) || '').trim();
      if (!name || name === d.name) return;
      d.name = name; save(); render();
      return;
    }
    if (kind === 'deleteDomain') {
      const n = db.items.filter((i) => domainOf(i) === d.id).length;
      if (!confirm(`¿Borrar el dominio "${d.name}"? Sus ${n} entradas se conservan y quedan sin dominio.`)) return;
      const snap = { domains: db.meta.domains.map((x) => ({ ...x })), tagDomain: { ...db.meta.tagDomain }, overrides: db.items.filter((i) => i.domain === d.id).map((i) => i.id) };
      db.meta.domains = db.meta.domains.filter((x) => x.id !== d.id);
      Object.keys(db.meta.tagDomain).forEach((t) => { if (db.meta.tagDomain[t] === d.id) delete db.meta.tagDomain[t]; });
      db.items.forEach((i) => { if (i.domain === d.id) i.domain = null; });
      save(); back();
      toast(`"${d.name}" borrado`, 'Deshacer', () => {
        db.meta.domains = snap.domains; db.meta.tagDomain = snap.tagDomain;
        snap.overrides.forEach((id) => { const i = byId(id); if (i) i.domain = d.id; });
        save(); render();
      });
    }
  }

  function tagAction(kind) {
    const t = ui.tag;
    if (kind === 'someday') {
      const has = t === '∅' ? (i) => !i.tags.length : (i) => i.tags.includes(t);
      const moved = db.items.filter((i) => has(i) && statusOf(i) === 'active' && !i.focus);
      const prev = moved.map((i) => [i, i.updatedAt]);
      moved.forEach((i) => setStatus(i, 'someday'));
      save(); render();
      toast(`${moved.length} a algún día`, 'Deshacer', () => { prev.forEach(([i, u]) => { setStatus(i, 'active'); i.updatedAt = u; }); save(); render(); });
      return;
    }
    const n = db.items.filter((i) => i.tags.includes(t)).length;
    if (kind === 'remove') {
      if (!confirm(`¿Quitar #${t} de ${n} ${n === 1 ? 'entrada' : 'entradas'}? Las entradas se conservan.`)) return;
      const r = renameTag(t, '');
      back();
      toast(`#${t} quitada`, 'Deshacer', () => { r.undo(); render(); });
      return;
    }
    const ans = prompt(`Nuevo nombre para #${t}\n(si ya existe, se fusionan)`, t);
    if (ans === null) return;
    const nt = ans.trim().replace(/^#/, '').toLowerCase();
    if (!nt || nt === t) return;
    if (!/^[\p{L}\p{N}_-]+$/u.test(nt)) { alert('Usa solo letras, números, guion o guion bajo, sin espacios.'); return; }
    const exists = tagCounts().has(nt);
    if (exists && !confirm(`#${nt} ya existe. ¿Fusionar #${t} en #${nt}? Afecta ${n} ${n === 1 ? 'entrada' : 'entradas'}.`)) return;
    const r = renameTag(t, nt);
    ui.tag = nt; render();
    toast(exists ? `Fusionada en #${nt}` : `Renombrada a #${nt}`, 'Deshacer', () => { r.undo(); ui.tag = t; render(); });
  }

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.view;
    stack = [];
    Object.assign(ui, { view: v, tag: null, domain: null });
    render();
    window.scrollTo(0, 0);
    if (v === 'search') $('#searchInput').focus();
  }));
  $('#backBtn').addEventListener('click', back);

  /* ---------------- Hoja de detalle ---------------- */
  const sheet = $('#sheet');
  const fText = $('#fText'), fDate = $('#fDate'), fDue = $('#fDue'), fFocus = $('#fFocus'), fStatus = $('#fStatus'), fTags = $('#fTags');
  let editing = null; // { id, lastParse, touchedDate, touchedDue, touchedStatus, status, domain }

  function setStatusUI(s) {
    editing.status = s;
    fStatus.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.s === s));
    if (s !== 'active') fFocus.checked = false;
  }

  // Dominio que tendría la entrada con lo que hay ahora en la hoja
  const draft = () => ({ id: editing.id, domain: editing.domain, tags: parse(fText.value).tags });
  function renderDomainRow() {
    const info = domainInfo(draft());
    const d = domainById(info.id);
    $('#fDomain').innerHTML = d
      ? `<span class="dname">${dot(d)}${esc(d.name)}</span>${info.via ? `<small>por #${esc(info.via)}</small>` : ''}`
      : '<i class="muted">sin dominio · elegir</i>';
  }

  function openSheet(id) {
    const it = byId(id);
    if (!it) return;
    editing = { id, lastParse: parse(it.text), touchedDate: false, touchedDue: false, touchedStatus: false, domain: it.domain };
    fText.value = it.text;
    fDate.value = it.date || '';
    fDue.value = it.due || '';
    fFocus.checked = it.focus;
    setStatusUI(statusOf(it));
    renderSheetParts(it);
    sheet.hidden = false;
    autosize();
  }

  const tagChips = (text) => parse(text).tags.map((t) => `<span class="chip tag">${dot(domainById(db.meta.tagDomain[t]))}#${esc(t)}</span>`).join('');
  function updateSheetTags() { fTags.innerHTML = (document.activeElement === fText && suggestHTML(fText)) || tagChips(fText.value); }

  function renderSheetParts(it) {
    fTags.innerHTML = tagChips(fText.value);
    renderDomainRow();
    const rel = it.links.map(byId).filter(Boolean);
    $('#relList').innerHTML = rel.map((o) => `<li data-id="${o.id}"><span class="t${o.done ? ' done' : ''}" data-open="${o.id}">${esc(o.text)}</span><button class="act rm" data-unlink="${o.id}" aria-label="Quitar relación">×</button></li>`).join('');
    const sim = similar(it);
    $('#simBlock').hidden = !sim.length;
    $('#simList').innerHTML = sim.map((o) => `<li><span class="t${o.done ? ' done' : ''}" data-open="${o.id}">${esc(o.text)}</span><button class="act" data-link="${o.id}">Relacionar</button></li>`).join('');
    const c = new Date(it.createdAt);
    let info = 'Capturada el ' + c.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' a las ' + c.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (it.focus) info += ` · en foco desde hace ${daysSince(it.focusAt)} días`;
    $('#fCreated').textContent = info;
  }

  function commitSheet() {
    if (!editing) return;
    const it = byId(editing.id);
    if (it) {
      const snap = () => JSON.stringify([it.text, it.date, it.due, statusOf(it), it.focus, it.domain]);
      const before = snap();
      const text = fText.value.trim() || it.text;
      it.text = text;
      it.tags = parse(text).tags;
      it.date = fDate.value || null;
      it.due = fDue.value || null;
      it.domain = editing.domain || null;
      if (statusOf(it) !== editing.status) setStatus(it, editing.status);
      if (fFocus.checked !== it.focus) {
        const why = setFocus(it, fFocus.checked);
        if (why === 'full') toast(`Ya tienes ${FOCUS_MAX} en foco`);
        if (why === 'work') toast('Los 3 en foco no pueden ser de Trabajo');
      }
      if (snap() !== before) { stamp(it); save(); }
    }
    editing = null;
  }

  function closeSheet() { commitSheet(); sheet.hidden = true; render(); }
  function autosize() { fText.style.height = 'auto'; fText.style.height = Math.min(fText.scrollHeight + 2, 220) + 'px'; }

  fText.addEventListener('input', () => {
    autosize();
    const p = parse(fText.value);
    if (!editing.touchedDate && p.date !== editing.lastParse.date) fDate.value = p.date || '';
    if (!editing.touchedDue && p.due !== editing.lastParse.due) fDue.value = p.due || '';
    if (!editing.touchedStatus && p.someday !== editing.lastParse.someday && editing.status !== 'done') setStatusUI(p.someday ? 'someday' : 'active');
    editing.lastParse = p;
    updateSheetTags();
    renderDomainRow();
  });
  fText.addEventListener('click', updateSheetTags);
  fText.addEventListener('blur', () => setTimeout(updateSheetTags, 0));
  fText.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fText.blur(); } });
  bindSuggest(fTags, fText);
  fDate.addEventListener('change', () => { editing.touchedDate = true; });
  fDue.addEventListener('change', () => { editing.touchedDue = true; });

  $('#fDomainRow').addEventListener('click', async () => {
    const info = domainInfo(draft());
    const fromTags = domainInfo({ domain: null, tags: draft().tags }).id;
    const id = await pickDomain({
      title: 'Dominio de esta entrada',
      sub: fromTags ? `Por sus etiquetas sería ${domainById(fromTags).name}. Elegir otro solo cambia esta entrada.` : 'Solo cambia esta entrada. Para asignar una etiqueta completa, hazlo desde la etiqueta.',
      current: info.id,
      clearLabel: editing.domain ? 'Usar el de sus etiquetas' : null
    });
    if (id === null || !editing) return;
    editing.domain = id && id !== fromTags ? id : null;
    renderDomainRow();
  });

  fStatus.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    editing.touchedStatus = true;
    setStatusUI(b.dataset.s);
  });
  fFocus.addEventListener('change', () => {
    if (!fFocus.checked) return;
    const others = focusItems().filter((i) => i.id !== editing.id);
    if (others.length >= FOCUS_MAX) {
      fFocus.checked = false;
      alert(`Ya tienes ${FOCUS_MAX} cosas en foco:\n\n• ${others.map((i) => i.text).join('\n• ')}\n\nTermina o quita una antes de agregar otra.`);
      return;
    }
    if (domainById(WORK) && others.length === FOCUS_MAX - 1 && others.every((i) => domainOf(i) === WORK) && domainOf(draft()) === WORK) {
      fFocus.checked = false;
      alert(`Tus otras ${others.length} en foco ya son de Trabajo.\n\nLa tercera tiene que ser algo para ti: Disfrute, Cuerpo, Mente…`);
      return;
    }
    setStatusUI('active');
  });

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
      .sort((a, b) => a.done - b.done || newestFirst(a, b))
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
    const n = (s) => db.items.filter((i) => statusOf(i) === s).length;
    const last = db.meta.lastBackup ? new Date(db.meta.lastBackup).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nunca';
    $('#stats').innerHTML = `<div><b>${n('active')}</b><span>activas</span></div><div><b>${n('someday')}</b><span>algún día</span></div><div><b>${n('done')}</b><span>hechas</span></div><div class="wide"><b>${last}</b><span>último respaldo · ${db.meta.domains.length} dominios · ${tagCounts().size} etiquetas</span></div>`;
  }

  async function exportData() {
    const name = `personal-os-${todayISO()}.json`;
    const meta = { domains: db.meta.domains, tagDomain: db.meta.tagDomain };
    const json = JSON.stringify({ app: 'personal-os', schema: SCHEMA, exportedAt: new Date().toISOString(), meta, items: db.items }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        markBackup();
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
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
      const meta = (!Array.isArray(data) && data.meta) || {};
      const newDomains = (Array.isArray(meta.domains) ? meta.domains : []).filter((d) => d && d.id && d.name && !domainById(d.id));
      const newMaps = Object.entries(meta.tagDomain || {}).filter(([t, d]) => !db.meta.tagDomain[t] && typeof d === 'string');
      let added = 0, updated = 0;
      const plan = incoming.map((x) => {
        const cur = byId(x.id);
        if (!cur) { added++; return ['add', x]; }
        if (x.updatedAt > cur.updatedAt) { updated++; return ['upd', x]; }
        return null;
      }).filter(Boolean);
      if (!plan.length && !newDomains.length && !newMaps.length) { alert('Nada nuevo: todo lo del archivo ya está aquí.'); return; }
      if (!confirm(`Importar:\n• ${added} entradas nuevas\n• ${updated} actualizadas\n• ${newDomains.length} dominios y ${newMaps.length} etiquetas asignadas\nNo se borra nada.`)) return;
      plan.forEach(([k, x]) => { if (k === 'add') db.items.push(x); else Object.assign(byId(x.id), x); });
      newDomains.forEach((d) => db.meta.domains.push({ id: String(d.id), name: String(d.name), color: d.color || PALETTE[db.meta.domains.length % PALETTE.length] }));
      newMaps.forEach(([t, d]) => { db.meta.tagDomain[t] = d; });
      focusItems().sort((a, b) => a.focusAt.localeCompare(b.focusAt)).slice(FOCUS_MAX).forEach((i) => { i.focus = false; i.focusAt = null; });
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden && sheet.hidden && dpick.hidden) { db = load(); render(); } });
  render();
})();
