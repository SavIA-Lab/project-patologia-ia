# Registro de cambios / Changelog

Formato: una sección por versión, la más reciente arriba. / Format: one section per version, newest first.

## v2.0a — Cimientos / Foundations (2026-11-27)

### Añadido / Added
- Proyecto Vite con JavaScript sin framework: `src/engine/`, `src/modules/<id>/`, `src/i18n/`, `public/`, `tests/`. Three.js r160 como dependencia (sin CDN); fuentes y estilos dentro del repositorio.
- Hoja de estilos propia que reemplaza el CDN de Tailwind, con el mismo aspecto.
- Registro de módulos con carga diferida. Los cinco bloques de la v3.0 son módulos provisionales (`wsi-pyramid`, `qc-tiling`, `encoder-shift`, `mil-attention`, `xai-threshold`), con el campo opcional `track` sin uso.
- Sistema ES/EN: selector visible, cambio en caliente sin perder el estado, idioma inicial por `?lang=` → guardado → navegador, números con `Intl`, etiquetas 3D regenerables y etiqueta «Traducción en borrador, pendiente de revisión» en inglés.
- Pantalla «Acerca de» (ES/EN) con autoría, herramienta, etiqueta «simulado» y sección «qué es y qué no es real».
- Pruebas unitarias y de navegador (`npm test`); informe de peso por módulo (`npm run report:size`); comparación con la v3.0 (`scripts/legacy-compare.mjs`).
- GitHub Actions: pruebas, compilación y despliegue en GitHub Pages desde `main`.
- `build:single`: un solo HTML con los dos idiomas.
- README bilingüe, `CITATION.cff`, `CONTRIBUTING.md`, plantillas de incidencias, glosario ES–EN, Open Graph bilingüe.

### Corregido respecto de la v3.0 / Fixed relative to v3.0
- Recorrido de IHC por las etapas 2 a 5.
- Los marcadores 1 y 2 del top-3 de citología Pap ya no se solapan.
- Panel lateral apilado y barra de etapas compacta en pantallas estrechas.
- La citología Pap se declara «convencional».
- Las etiquetas pintadas en lienzo se regeneran al cambiar de idioma.
- Las etiquetas de la matriz de confusión pasan a VP/VN/FP/FN en español y TP/TN/FP/FN en inglés.

### Sin cambios deliberados / Unchanged on purpose
- Los datos técnicos de fases posteriores (niveles de pirámide, resolución, perfiles de hospital, mallas de 224/512, umbral de QC, nombre «ALMA-QC», texto del codificador, bolsa MIL de 200) se migraron tal como estaban.

## v3.0

Versión de partida: un solo archivo HTML con cinco etapas. Se conserva en `legacy/v3.0/`. / Starting version: a single HTML file with five stages, kept in `legacy/v3.0/`.
