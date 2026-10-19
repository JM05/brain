# Personal OS · V0

Captura rápida desde el iPhone. Escribes una línea; la app entiende `#etiquetas`, fechas y deadlines, y te deja encontrarlo todo por Inbox, Fechas, Etiquetas y Búsqueda. Los datos viven **solo en tu dispositivo**.

## Qué entiende al capturar

| Escribes | Interpreta |
|---|---|
| `#casa #plantas` | etiquetas |
| `hoy`, `mañana`, `pasado mañana` | fecha |
| `el sábado`, `este viernes`, `el próximo lunes` | fecha (siempre a futuro) |
| `15 nov`, `3 de diciembre`, `20/11` | fecha |
| `este finde`, `la próxima semana`, `en 3 días` | fecha |
| `antes del viernes`, `a más tardar el 15 nov`, `vence el lunes` | deadline |

"En la mañana" no se toma como fecha. Todo se corrige en el detalle (toca una entrada).

## Modelo de datos

Un solo tipo de entrada, en `localStorage` bajo la clave `pos.v1`:

```json
{
  "id": "uuid",
  "text": "Revisar raíces del pothos el sábado #casa #plantas",
  "tags": ["casa", "plantas"],
  "date": "2026-10-24",
  "due": null,
  "done": false, "doneAt": null,
  "createdAt": "ISO", "updatedAt": "ISO",
  "links": ["uuid-de-otra-entrada"]
}
```

- Las etiquetas salen siempre del texto: para cambiarlas, editas el texto.
- Las relaciones son bidireccionales.
- El export es este mismo JSON (`{ app, schema, exportedAt, items }`): legible y portable.

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
