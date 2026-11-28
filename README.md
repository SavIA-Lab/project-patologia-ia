# PatologIA 3D

**Patología Digital & IA - Laboratorio Interactivo 3D** · *Digital Pathology & AI - Interactive 3D Lab*

Curso interactivo y abierto sobre IA en patología y citología digital, para quienes empiezan. Todo es sintético y cada módulo lleva la etiqueta «simulado». / Open interactive course on AI in digital pathology and cytology, for beginners. Everything is synthetic and every module carries the "simulated" label.

**Sitio / Site:** <https://savia-lab.github.io/project-patologia-ia/> (`?lang=es` · `?lang=en`)

> © 2026 Andrés Felipe Cardona-Mendoza, SavIA Lab-INMUBO, Universidad El Bosque. Todos los derechos reservados. Uso libre del sitio publicado para aprender y enseñar; no se permite copiar, modificar ni redistribuir el código ni los contenidos sin autorización escrita.
>
> All rights reserved. The published site is free to use for learning and teaching; copying, modifying or redistributing the code or content is not permitted without written authorization.

---

## Español

### Qué es

Un recorrido en 3D por el camino de una imagen de patología digital hasta la decisión de un modelo: lámina escaneada y pirámide multiescala, control de calidad y teselado, codificador y cambio de dominio, aprendizaje de múltiples instancias, explicabilidad y umbral clínico. Funciona en el navegador, con español e inglés, sin servidor y sin datos de pacientes.

La versión 2.0a (fase «Cimientos») reorganiza la versión 3.0, que era un solo archivo HTML, en un proyecto modular. Los cinco bloques de la v3.0 son módulos provisionales; los módulos nuevos llegan en fases posteriores (ver [ROADMAP.md](ROADMAP.md)).

### Qué no es

No es una herramienta de diagnóstico ni de apoyo clínico. Las imágenes son texturas generadas en el navegador, los valores numéricos son simulados y los hospitales, escáneres y casos son ficticios. La pantalla «Acerca de» del sitio lo explica con más detalle.

### Idiomas

El idioma inicial se decide así: parámetro `?lang=` de la URL, luego el idioma guardado en el navegador y, si no hay ninguno, el del navegador (español → ES; cualquier otro → EN). El selector ES/EN cambia el idioma sin perder la modalidad, el módulo, el parche fijado, los controles ni el avance del cuestionario.

La traducción al inglés es un **borrador pendiente de revisión** y el sitio lo indica con una etiqueta visible. Si encuentras un error de traducción, abre una incidencia con la plantilla «Corrección de traducción». El glosario está en [docs/glosario-es-en.md](docs/glosario-es-en.md).

### Uso local

Requiere Node 22 (ver `.nvmrc`).

```bash
npm ci                # instala las dependencias exactas
npm run dev           # servidor de desarrollo en http://localhost:5173/project-patologia-ia/
npm test              # pruebas unitarias, compilación y pruebas de navegador
npm run build         # compila en dist/
npm run build:single  # un solo HTML con los dos idiomas, en dist-single/ (uso sin conexión)
npm run report:size   # peso del paquete por módulo
```

Las pruebas de navegador usan Chrome o Chromium. Si no se encuentra solo, indica la ruta: `CHROME_PATH=/ruta/a/chrome npm test`.

`build:single` es para uso local sin conexión. No se publica como adjunto de una versión.

### Estructura

```
src/engine/    estado compartido, modalidades, texturas procedurales, escena y datos del pipeline
src/modules/   un directorio por módulo (meta, escena, panel); se cargan bajo demanda
src/i18n/      es.json, en.json y el sistema de idiomas
src/ui/        cuestionario, «Acerca de», tooltips y componentes del panel
src/app/       controlador, navegación y panel lateral
tests/         pruebas unitarias y de navegador (Puppeteer)
legacy/v3.0/   versión de partida, sin cambios
```

### Despliegue

GitHub Actions ejecuta las pruebas y la compilación en cada cambio y publica en GitHub Pages desde `main`. En el repositorio: *Settings → Pages → Source: GitHub Actions*.

### Reportar errores y sugerir contenido

Con las plantillas de incidencias: error, sugerencia de contenido o corrección de traducción. Por ahora no se aceptan solicitudes de cambio (pull requests); ver [CONTRIBUTING.md](CONTRIBUTING.md).

### Cómo citar

Ver [CITATION.cff](CITATION.cff).

### Autoría y herramientas

Autor y director: Andrés Felipe Cardona-Mendoza, SavIA Lab-INMUBO, Universidad El Bosque. Desarrollado con Claude Sonnet 5.5 (Anthropic), bajo la dirección del autor. Las dependencias de terceros y sus licencias están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## English

### What it is

A 3D walk through the path from a digital pathology image to a model decision: scanned slide and multi-scale pyramid, quality control and tiling, encoder and domain shift, multiple-instance learning, explainability and clinical threshold. It runs in the browser in Spanish and English, with no server and no patient data.

Version 2.0a ("Foundations") rebuilds v3.0, a single HTML file, as a modular project. The five v3.0 blocks are provisional modules; new modules arrive in later phases (see [ROADMAP.md](ROADMAP.md)).

### What it is not

It is not a diagnostic or clinical decision tool. Images are textures generated in the browser, numbers are simulated, and the hospitals, scanners and cases are fictional. The site's "About" screen explains this in more detail.

### Languages

The starting language is chosen in this order: the `?lang=` URL parameter, then the language stored in the browser, then the browser language (Spanish → ES; anything else → EN). The ES/EN selector switches language without losing the modality, module, pinned patch, controls or quiz progress.

The English text is a **draft pending review**, and the site shows a visible label saying so. If you find a translation error, open an issue with the "Translation correction" template. The glossary is in [docs/glosario-es-en.md](docs/glosario-es-en.md).

### Local use

Requires Node 22 (see `.nvmrc`).

```bash
npm ci                # install exact dependencies
npm run dev           # dev server at http://localhost:5173/project-patologia-ia/
npm test              # unit tests, build and browser tests
npm run build         # build into dist/
npm run build:single  # one HTML file with both languages, in dist-single/ (offline use)
npm run report:size   # package weight per module
```

Browser tests use Chrome or Chromium. If it is not found automatically, give its path: `CHROME_PATH=/path/to/chrome npm test`.

`build:single` is for local offline use. It is not published as a release attachment.

### Deployment

GitHub Actions runs the tests and the build on every change and publishes to GitHub Pages from `main`. In the repository: *Settings → Pages → Source: GitHub Actions*.

### Reporting errors and suggesting content

Use the issue templates: bug, content suggestion or translation correction. Pull requests are not accepted for now; see [CONTRIBUTING.md](CONTRIBUTING.md).

### How to cite

See [CITATION.cff](CITATION.cff).

### Authorship and tools

Author and director: Andrés Felipe Cardona-Mendoza, SavIA Lab-INMUBO, Universidad El Bosque. Developed using Claude Sonnet 5.5 (Anthropic), under the author's direction. Third-party dependencies and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
