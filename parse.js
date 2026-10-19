/* Personal OS · intérprete de capturas
   Entiende #etiquetas, fechas sencillas y deadlines en español. Sin dependencias.
   Devuelve { tags: [...], date: 'YYYY-MM-DD' | null, due: 'YYYY-MM-DD' | null } */
(function (global) {
  'use strict';

  const DOW = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const MON = {
    enero: 0, ene: 0, febrero: 1, feb: 1, marzo: 2, mar: 2, abril: 3, abr: 3, mayo: 4, may: 4,
    junio: 5, jun: 5, julio: 6, jul: 6, agosto: 7, ago: 7, septiembre: 8, setiembre: 8, sept: 8, sep: 8, set: 8,
    octubre: 9, oct: 9, noviembre: 10, nov: 10, diciembre: 11, dic: 11
  };

  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const DAYS = Object.keys(DOW).join('|');
  const MONTHS = Object.keys(MON).sort((a, b) => b.length - a.length).join('|');

  // Expresión de "cuándo" (sobre texto sin acentos y en minúsculas)
  const WHEN =
    '(?:pasado manana' +
    '|(?<!la )manana' +                                   // excluye "en la mañana"
    '|hoy' +
    '|en \\d+ (?:dias?|semanas?)|en una semana' +
    '|(?:la )?proxima semana|la semana que viene' +
    '|(?:este |el )?fin de semana|(?:este |el )?finde' +
    '|(?:el |este |esta |el proximo |proximo |el siguiente )?(?:' + DAYS + ')' +
    '|(?:el )?\\d{1,2}(?: de)? (?:' + MONTHS + ')\\.?(?: de \\d{4})?' +
    '|(?:el )?\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?' +
    ')';

  const DEADLINE_RE = new RegExp(
    '\\b(?:antes del?|a mas tardar(?: el)?|vence(?: el)?|vencimiento|limite(?: el)?|deadline)\\s+(' + WHEN + ')\\b'
  );
  const DATE_RE = new RegExp('\\b(' + WHEN + ')\\b');

  function makeDate(y, m, d) {
    const x = new Date(y, m, d);
    return x.getMonth() === m && x.getDate() === d ? x : null;
  }

  function resolve(phrase, today) {
    const p = phrase.trim();
    const dow = today.getDay();
    let m;

    if (p === 'hoy') return today;
    if (p === 'pasado manana') return addDays(today, 2);
    if (p === 'manana') return addDays(today, 1);

    if ((m = p.match(/^en (\d+) (dia|semana)/))) return addDays(today, +m[1] * (m[2] === 'dia' ? 1 : 7));
    if (p === 'en una semana') return addDays(today, 7);
    if (/semana/.test(p) && !/fin de semana/.test(p)) return addDays(today, ((1 - dow + 7) % 7) || 7); // próximo lunes
    if (/fin de semana|finde/.test(p)) return dow === 6 || dow === 0 ? today : addDays(today, 6 - dow);

    if ((m = p.match(new RegExp('(' + DAYS + ')$')))) {
      return addDays(today, ((DOW[m[1]] - dow + 7) % 7) || 7); // siempre a futuro (1–7 días)
    }

    let y = null, mo = null, d = null;
    if ((m = p.match(new RegExp('(\\d{1,2})(?: de)? (' + MONTHS + ')\\.?(?: de (\\d{4}))?')))) {
      d = +m[1]; mo = MON[m[2]]; y = m[3] ? +m[3] : null;
    } else if ((m = p.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
      d = +m[1]; mo = +m[2] - 1; y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    }
    if (d !== null) {
      if (y !== null) return makeDate(y, mo, d);
      let x = makeDate(today.getFullYear(), mo, d);
      // "10 ene" capturado en diciembre → año siguiente; algo pasado hace poco se queda (aparece como atrasado)
      if (x && x < addDays(today, -60)) x = makeDate(today.getFullYear() + 1, mo, d);
      return x;
    }
    return null;
  }

  function parseTags(text) {
    const out = [];
    const re = /(^|[\s(])#([\p{L}\p{N}_-]+)/gu;
    let m;
    while ((m = re.exec(text))) {
      const t = m[2].toLowerCase();
      if (!out.includes(t)) out.push(t);
    }
    return out;
  }

  function parse(text, now) {
    const today = startOfDay(now || new Date());
    const src = String(text || '').normalize('NFC');
    const tags = parseTags(src);

    // Texto normalizado, con las #etiquetas tapadas para que "#viernes" no sea una fecha
    let f = fold(src).replace(/#[^\s]+/g, (s) => ' '.repeat(s.length));
    let due = null, date = null;

    const dm = DEADLINE_RE.exec(f);
    if (dm) {
      const d = resolve(dm[1], today);
      if (d) {
        due = iso(d);
        f = f.slice(0, dm.index) + ' '.repeat(dm[0].length) + f.slice(dm.index + dm[0].length);
      }
    }
    const m = DATE_RE.exec(f);
    if (m) {
      const d = resolve(m[1].replace(/^(?:el siguiente|el proximo|proximo|el|este|esta|la) /, ''), today);
      if (d) date = iso(d);
    }
    const someday = /\b(algun dia|algundia|someday)\b/.test(fold(src));
    return { tags, date, due, someday };
  }

  const api = { parse, parseTags, fold, iso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.PosParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
