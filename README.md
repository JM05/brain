# Personal OS · V0.3

Captura rápida desde el iPhone. Escribes una línea; la app entiende `#etiquetas`, fechas y deadlines, y te deja encontrarlo todo por Inbox, Mapa, Dominios y Búsqueda. Los datos viven **solo en tu dispositivo**.

## Qué entiende al capturar

| Escribes | Interpreta |
|---|---|
| `#casa #plantas` | etiquetas |
| `hoy`, `mañana`, `pasado mañana` | fecha |
| `el sábado`, `este viernes`, `el próximo lunes` | fecha (siempre a futuro) |
| `15 nov`, `3 de diciembre`, `20/11` | fecha |
| `este finde`, `la próxima semana`, `en 3 días` | fecha |
| `antes del viernes`, `a más tardar el 15 nov`, `vence el lunes` | deadline |
| `algún día` (en cualquier parte del texto) | va directo a Algún día |

"En la mañana" no se toma como fecha. Todo se corrige en el detalle (toca una entrada).

## Modelo de datos

Un solo tipo de entrada, en `localStorage` bajo la clave `pos.v1`:

```json
{
  "id": "uuid",
  "text": "Revisar raíces del pothos el sábado #casa #plantas",
  "tags": ["casa", "plantas"],
  "domain": null,
  "date": "2026-10-24",
  "due": null,
  "done": false, "doneAt": null,
  "createdAt": "ISO", "updatedAt": "ISO",
  "someday": false,
  "focus": false, "focusAt": null,
  "links": ["uuid-de-otra-entrada"]
}
```

- Las etiquetas salen siempre del texto: para cambiarlas, editas el texto.
- Las relaciones son bidireccionales.
- Estado: activa, algún día (`someday`) o hecha (`done`). `focus` solo aplica a activas, máximo 3.
- `domain` solo se llena si eliges un dominio distinto para esa entrada; si no, se hereda de sus etiquetas.
- `meta.domains` guarda tus dominios (editables) y `meta.tagDomain` qué etiqueta pertenece a qué dominio.
- El export es este mismo JSON (`{ app, schema, exportedAt, meta, items }`): legible y portable.

## Dominios

7 por defecto, todos editables desde su vista (renombrar, borrar) y con "+ Nuevo dominio": Trabajo · Dinero · Cuerpo · Mente · Construir · Disfrute · Hogar y gente.

- El dominio sale de tus etiquetas: asignas `#hiking → Disfrute` una vez y aplica a todo lo que lleve `#hiking`, también a lo futuro.
- Cuando capturas con una etiqueta nueva, el aviso te ofrece "Asignar". Si lo ignoras, aparece en Dominios → "Etiquetas sin dominio", con sugerencias que aceptas de un toque (nunca se aplican solas).
- La pestaña Dominios muestra cuánto completaste en cada uno en las últimas 4 semanas.
- Regla de foco: de tus 3 en foco, al menos 1 no puede ser de Trabajo.

## Inbox (V0.3)

- Arriba, siempre: tus 3 en foco.
- **Clasificar**: solo lo que aún no tiene lugar (sin foco, sin fecha, sin algún día). Cada entrada trae botones: ★ Foco · Fecha · Algún día · Borrar.
- **Fechas**, **Algún día** y **Hechas** son pestañas del mismo Inbox.

## Mapa

- Grafo de dominios (círculos grandes) y etiquetas; el tamaño es cuántas cosas tienes ahí y el grosor de línea cuántas veces van juntas.
- "Entradas" agrega cada entrada como punto y las relaciones como líneas punteadas. "Todo" incluye las hechas.
- Toca un nodo para ver su detalle; arrastra para moverte y pellizca para zoom.
- Debajo: reparto por dominio de lo que tienes sin terminar y la **revisión de etiquetas** (casi iguales, casi siempre juntas, sin dominio, dominio dudoso, entradas que mezclan dominios, usadas una vez, exceso de etiquetas). Cada sugerencia se aplica con un toque, se puede deshacer o ignorar.

## Cómo usarla

- **Captura todo** sin pensar. Si es un deseo sin prisa, agrega `algún día`.
- **Foco: máximo 3.** Son las únicas cosas que te comprometes a mover ahora. Para meter una cuarta, termina o quita una.
- **Algún día** no es un pendiente: es tu lista abierta, sin culpa, agrupada por etiqueta.
- **Revisión semanal (10 min):** vacía Pendientes (¿foco, algún día o borrar?), revisa tus 3 de foco y baja algo de Algún día solo si hay espacio.
- **Etiquetas:** al escribir `#` la app sugiere las que ya existen. Entra a una etiqueta para renombrarla, fusionarla, quitarla o mandar todas sus activas a algún día.

## Publicar en GitHub Pages (desde Windows, sin instalar nada)

1. En github.com → **New repository**. Nombre sugerido: `brain` (la URL será `https://jm05.github.io/brain/`). Público. Crear.
2. En el repo vacío: **uploading an existing file** → arrastra todos los archivos de esta carpeta (no la carpeta) → **Commit changes**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → **Save**.
4. Espera 1–2 minutos y abre la URL en **Safari** del iPhone.
5. Compartir → **Agregar a pantalla de inicio**. Ábrela siempre desde ese ícono: la app instalada tiene su propio almacenamiento, distinto al de Safari.

## Actualizar

Sube los archivos nuevos al repo (mismos nombres, reemplazan los anteriores). La app busca la versión nueva cada vez que la abres con conexión; si no la ves, ciérrala del multitarea y ábrela otra vez. Tus datos no se tocan.

## Respaldo

Engrane (arriba a la derecha) → **Exportar todo** → *Guardar en Archivos* → iCloud Drive. A partir de 5 entradas, el Inbox te avisa si llevas más de 7 días sin respaldar. **Importar** combina por ID: agrega lo nuevo, actualiza lo más reciente y nunca borra.

## Archivos

`index.html` estructura · `styles.css` diseño · `parse.js` intérprete de texto · `app.js` lógica y vistas · `sw.js` funcionamiento sin conexión · `manifest.webmanifest` + íconos para instalarla.
