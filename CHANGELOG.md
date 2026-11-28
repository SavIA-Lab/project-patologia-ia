# Registro de cambios / Changelog

Formato: una sección por versión, la más reciente arriba. / Format: one section per version, newest first.

## v2.0b - Motor matemático, M0, M1 y M2 / Math engine, M0, M1 and M2 (2026-11-27)

### Añadido / Added
- `src/engine/patch-math.js`: motor puro de la ruta P (MPP por eje, campo visual, tamaño y MPP de extracción, Nyquist, Abbe y Rayleigh, pirámide configurable con índice visual y nivel OpenSlide, teselado con políticas de borde, `patchConfig` exportable) con 41 pruebas.
- `src/engine/scanner-math.js` y `src/modules/scanner/sim.js`: perfil de escáner genérico, salidas exactas y simuladas, y procesamiento de imagen de artefactos, con pruebas.
- M0 (Mapa y glosario): pipeline con enlaces a cada módulo, niveles de ruta con «próximamente» donde no hay módulos, itinerario de la ruta P, qué es simulado y qué es real, 29 términos de glosario con ventana emergente.
- M1 (Muestra y escáner): controles de familia, objetivo, modo por área o línea, planos Z, puntos de enfoque y compresión; salidas con etiqueta de procedencia; artefactos sobre imagen sintética; caso de fallo de dos escáneres; perfil exportable a JSON.
- M2 (WSI, pirámide y formatos): reemplaza al bloque `wsi-pyramid` de la v3.0. Una sola imagen fuente por semilla, núcleo a varios MPP, pirámide configurable, selector de región con modo de campo fijo o tamaño fijo, fragmentos de OpenSlide verificados (`docs/verificacion-openslide.md`), tabla MPP-aumento marcada como aproximación ilustrativa.
- Componente de etiquetas de procedencia (exacto, imagen, simulado, fuente, medido) y 14 preguntas propias de quiz (4 de M0, 5 de M1, 5 de M2).
- Documentos: `docs/perfil-escaner-generico.md`, `docs/verificacion-openslide.md`; glosario ES-EN ampliado.

### Cambiado / Changed
- Las etapas 1 a 5 de la v3.0 pasan a ser los módulos M2 y E2 a E5 (posiciones 3 a 7 de la navegación); E2 a E5 no cambian.
- Los perfiles de hospital de E3 dejan de nombrar marcas: son perfiles genéricos (alto volumen, sobremesa, bajo costo).
- El botón del quiz ya no fija el número de preguntas (ahora son 22).

### Corregido respecto de la v2.0a / Fixed relative to v2.0a
- Hallazgos 1, 2, 3 y 10 de la auditoría de M2 (MPP por eje sin valor por defecto, un MPP no equivale a un aumento, pirámide con orden visual y nivel OpenSlide a la vez, fuente única por semilla).

## v2.0a - Cimientos / Foundations (2026-11-27)

### Añadido / Added
- Proyecto Vite con JavaScript sin framework: `src/engine/`, `src/modules/<id>/`, `src/i18n/`, `public/`, `tests/`. Three.js r160 como dependencia (sin CDN); fuentes y estilos dentro del repositorio.
- Hoja de estilos propia que reemplaza el CDN de Tailwind, con el mismo aspecto.
- Registro de módulos con carga diferida. Los cinco bloques de la v3.0 son módulos provisionales (`wsi-pyramid`, `qc-tiling`, `encoder-shift`, `mil-attention`, `xai-threshold`), con el campo opcional `track` sin uso.
- Sistema ES/EN: selector visible, cambio en caliente sin perder el estado, idioma inicial por `?lang=` → guardado → navegador, números con `Intl`, etiquetas 3D regenerables y etiqueta «Traducción en borrador, pendiente de revisión» en inglés.
- Pantalla «Acerca de» (ES/EN) con autoría, herramienta, etiqueta «simulado» y sección «qué es y qué no es real».
- Pruebas unitarias y de navegador (`npm test`); informe de peso por módulo (`npm run report:size`); comparación con la v3.0 (`scripts/legacy-compare.mjs`).
- GitHub Actions: pruebas, compilación y despliegue en GitHub Pages desde `main`.
- `build:single`: un solo HTML con los dos idiomas.
- README bilingüe, `CITATION.cff`, `CONTRIBUTING.md`, plantillas de incidencias, glosario ES-EN, Open Graph bilingüe.

### Corregido respecto de la v3.0 / Fixed relative to v3.0
- Recorrido de IHC por las etapas 2 a 5.
- Los marcadores 1 y 2 del top-3 de citología Pap ya no se solapan.
- Panel lateral apilado y barra de etapas compacta en pantallas estrechas.
- La citología Pap se declara «convencional».
- Las etiquetas pintadas en lienzo se regeneran al cambiar de idioma.
- Las etiquetas de la matriz de confusión pasan a VP/VN/FP/FN en español y TP/TN/FP/FN en inglés.

### Sin cambios deliberados / Unchanged on purpose
- Los datos técnicos de fases posteriores (niveles de pirámide, resolución, perfiles de hospital, mallas de 224/512, umbral de QC, nombre del filtro de calidad simulado, texto del codificador, bolsa MIL de 200) se migraron tal como estaban.

## v3.0

Versión de partida: un solo archivo HTML con cinco etapas. Se conserva en `legacy/v3.0/`. / Starting version: a single HTML file with five stages, kept in `legacy/v3.0/`.
