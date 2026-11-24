# Patología Digital & IA — Laboratorio Interactivo · Hoja de ruta v2.x

Estado de partida: **v3.0** (archivo HTML único, 5 etapas, 3 modalidades, quiz de 8 preguntas).
Destino: un curso interactivo, abierto y citable, publicado en GitHub (`SavIA-Lab/project-patologia-ia`) y desplegado con GitHub Pages en `savia-lab.github.io/project-patologia-ia`.

---

## 1. Objetivo y público

- **Público:** personas de cualquier país que empiezan en IA aplicada a patología y citología digital y estudian en **español o inglés** (estudiantes de posgrado, residentes, bacteriología, tecnología médica, ingeniería, ciencia de datos en salud).
- **Título en inglés (propuesto):** *Digital Pathology & AI — Interactive 3D Lab*.
- **Qué deben poder hacer al terminar:** explicar cada componente de un pipeline (muestra, escáner, WSI, teselado, encoder, MIL, evaluación), saber qué etiqueta necesita cada enfoque, reconocer por qué fallan los modelos al cambiar de centro o de escáner, leer un artículo del área con ojo crítico y plantear un proyecto propio.
- **Posicionamiento:** referente bilingüe (español e inglés) con raíz en América Latina y énfasis en **citología**, un campo menos cubierto que la histología H&E. Los ejemplos de Colombia y de la región se presentan como casos, junto con el marco internacional, para que el curso sirva a quien estudie en cualquier país.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Orden de contenidos | Primero domain shift, después MIL |
| Datos | Todo **sintético**, con etiqueta visible de "simulado" en cada módulo (propósito pedagógico) |
| Entrenamiento en el navegador | Sí, **al final** (v3.0) |
| Formato de entrega | Repositorio modular (Vite, JavaScript sin framework) + versión HTML única como archivo adjunto de cada release |
| Distribución | GitHub, organización SavIA-Lab, repositorio público `project-patologia-ia` (prefijo `project-` según el estándar de la organización); despliegue con GitHub Pages (sin Vercel); derechos reservados: uso libre del sitio publicado para aprender y enseñar, sin permiso de copiar, modificar ni redistribuir el código ni los contenidos (los archivos de licencia se añaden en v2.0); DOI por versión con Zenodo |
| Alcance | Global y bilingüe: estudiantes de todo el mundo que lean español o inglés |
| Idiomas | **Español e inglés completos desde v2.0**, con **selector de idioma** en toda la interfaz; ningún módulo se cierra sin las dos versiones. Portugués de Brasil: opcional en v3.0, según demanda |
| Privacidad | Todo ocurre en el navegador; sin subir láminas ni datos; sin uso clínico |

## 3. Principios de diseño

1. **Cada módulo se puede usar solo**, pero comparte estado con los demás (modalidad, parche fijado, perfil de escáner).
2. **Predecir antes de ver:** una pregunta corta antes de mover los controles.
3. **Toda afirmación con referencia** (DOI cuando exista). Nada de cifras sin fuente.
4. **Del concepto al código:** cada módulo trae un fragmento equivalente (PyTorch, OpenSlide, scikit-learn) que se pueda copiar.
5. **Mostrar el fallo:** cada módulo incluye un caso en el que el método se rompe y por qué.
6. **Equipos modestos:** modo ligero en 2D, funcionamiento sin conexión, texto legible en tablet.
7. **Revisión de contenido en dos pasos** (citopatología y patología): revisión inicial del director del proyecto y revisión senior por especialistas antes de cada release, con crédito visible si los revisores lo aceptan.
8. **Dos idiomas completos:** todo texto visible sale del diccionario de idiomas; un módulo no se cierra si falta una de las dos versiones. Cada término técnico tiene una equivalencia fija ES–EN en el glosario. El inglés lo revisa una persona; no se publica traducción automática sin revisar.

## 4. Arquitectura y despliegue

- [ ] Estructura: `src/engine/` (utilidades, azar con semilla, texturas, escena), `src/modules/<id>/` (escena, panel, quiz, referencias, textos), `src/i18n/{es,en}.json` (pt-BR se añade en v3.0 si se decide), `public/`, `tests/`.
- [ ] **Registro de módulos:** cada módulo declara `id`, título, objetivos, prerrequisitos, tiempo estimado, escena, panel lateral, preguntas y referencias. La navegación se genera desde el registro.
- [ ] **Carga diferida** por módulo (el peso crecerá de 194 KB a varios MB).
- [ ] Three.js, fuentes y estilos **dentro del repositorio** (sin CDN). Tailwind compilado o reemplazado por CSS propio.
- [ ] Service worker: funcionamiento sin conexión (v3.0).
- [ ] Modo ligero 2D si no hay WebGL o el equipo es lento.
- [ ] Pruebas automáticas (arnés Puppeteer actual): arranque sin errores, recorrido de módulos, modalidades, pin entre módulos, quiz.
- [ ] Integración continua en GitHub Actions: pruebas + build + despliegue a GitHub Pages desde la rama principal.
- [ ] Release: `dist/` publicado en GitHub Pages (Vite con `base: '/project-patologia-ia/'`) + `patologia_digital_ia.html` único (con los dos idiomas) como archivo adjunto.
- [ ] Repositorio: README bilingüe, `CITATION.cff`, `CONTRIBUTING.md`, plantillas de issues (error, traducción, caso nuevo), CHANGELOG, versionado semántico, tarjetas para redes (Open Graph) bilingües.
- [ ] **Sistema de idiomas (ES/EN), requisito de v2.0:**
  - [ ] **Selector de idioma** ES | EN visible en todas las pantallas (cabecera), operable con teclado, con el atributo `lang` actualizado en `<html>`.
  - [ ] Cambio en caliente, sin recargar y sin perder estado: modalidad, módulo, parche fijado, parámetros de los controles y avance del quiz.
  - [ ] Idioma inicial, por orden: parámetro `?lang=` de la URL; idioma guardado en el navegador (`localStorage` dentro de `try/catch`); idioma del navegador (si es español, ES; en cualquier otro caso, EN).
  - [ ] Textos dibujados dentro de la escena (rótulos en texturas Canvas, etiquetas 3D) se regeneran al cambiar de idioma, sin objetos huérfanos.
  - [ ] Sin cadenas fijas en el código: todo en `es.json` y `en.json`, con las mismas claves.
  - [ ] Números, decimales y unidades con `Intl` según el idioma; fórmulas y símbolos iguales en ambos.
  - [ ] En los dos idiomas: banco de preguntas, glosario, comentarios de los fragmentos de código, guía del docente, "Acerca de" y README. Las referencias bibliográficas no se traducen.
  - [ ] Glosario ES–EN como documento de control (`docs/glosario-es-en.md`) con la forma preferida de cada término.
  - [ ] Pruebas automáticas: (a) las dos lenguas tienen las mismas claves; (b) no hay cadenas fijas en la interfaz; (c) recorrido de todos los módulos en ES y en EN sin errores de consola; (d) revisión de desbordamiento en ancho de escritorio y de tablet, porque los textos miden distinto en cada idioma.
  - [ ] La lista de palabras prohibidas del proyecto aplica también a los textos en inglés.
- [ ] Pantalla "Acerca de": autor Andrés Felipe Cardona-Mendoza, investigador de SavIA Lab–INMUBO, Universidad El Bosque; declara que la herramienta se desarrolló usando Claude Sonnet 5.5; logotipo de SavIA Lab (el de la herramienta se crea después); sin logotipos de universidades hasta tener autorización escrita.

## 5. Plantilla de módulo

Cada módulo cumple esta ficha antes de darse por terminado:

- Objetivos de aprendizaje (3 a 5, verificables)
- Prerrequisitos y tiempo estimado
- Escena 3D o 2D con controles
- Pregunta de predicción previa
- Texto editorial breve + fórmula o esquema
- Caso de fallo
- Fragmento de código equivalente
- 4 a 6 preguntas propias para el banco del quiz
- Referencias con DOI
- Etiqueta "real / simulado"
- Todos los textos del módulo en español e inglés, con los términos del glosario ES–EN
- Guía del docente (ver sección 8)

## 6. Módulos (orden de aprendizaje)

Versión indica en cuál se entrega. **E** = esfuerzo: B bajo, M medio, A alto.

### M0 · Mapa del campo y vocabulario · v2.0 · E: B
Pipeline completo en un vistazo, glosario con ventanas emergentes, ruta por nivel (explorador, practicante, investigador), qué es simulado y qué es real.

### M1 · Del cristal al archivo: muestra, tinción y escáneres · v2.0 · E: A
- **Muestra y tinción (breve):** citología convencional frente a base líquida, H&E, Papanicolaou, IHC (DAB); por qué la tinción cambia la imagen.
- **Cómo escanea un escáner:** platina en serpentina, objetivo y apertura, cámara, iluminación, captura de campos, mapa de enfoque, costura de teselas, calibración de color.
- **Modos:** por área frente a por línea; planos Z (en citología, los grupos celulares gruesos los exigen y el archivo crece mucho).
- **Tipos de escáner:** alto volumen, de mesa, de bajo costo y microscopios motorizados (relevantes en entornos de recursos limitados, como buena parte de LATAM) [verificar familias y ejemplos].
- **Controles:** objetivo 20× o 40×, modo, planos Z, número de puntos de enfoque, compresión.
- **Salidas:** tiempo de escaneo, tamaño de archivo, micras por píxel.
- **Artefactos del escáner:** costuras, bandas, tiras fuera de foco, dominante de color.
- **Enlace:** el perfil de escáner elegido alimenta M5 (domain shift).

### M2 · WSI, pirámide y formatos · v2.0 · E: M
Amplía la etapa 1 actual: formatos (SVS, NDPI, MRXS, TIFF piramidal, DICOM para WSI [verificar]), compresión, tamaño de archivo, micras por píxel, lectura por regiones, bibliotecas habituales.

### M3 · QC, segmentación de tejido y teselado · v2.0 · E: M
Amplía la etapa 2: segmentación de tejido (umbral, HSV), tamaño de tesela, solapamiento, aumento elegido, filtros de calidad, desenfoque, pliegues, tinta, burbujas.

### M4 · Encoders y espacios latentes · v2.1 · E: A
- **De píxeles a vector:** recorrido de una tesela por un ViT (división en tokens, token CLS, matriz de atención) hasta su embedding.
- **Cómo se entrena un encoder:** supervisado, autosupervisado contrastivo (pares positivos y negativos), distilación (tipo DINO), enmascaramiento (tipo MAE). Demostración interactiva con pares aumentados.
- **Comparar encoders:** ImageNet, autosupervisados y modelos fundacionales (UNI, CONCH, Virchow, Prov-GigaPath, CTransPath, Phikon, H-optimus; UniCAS en citología) con dimensión, datos y licencia [verificar fichas].
- **Proyecciones:** PCA, t-SNE y UMAP con sus hiperparámetros; lo que distorsionan (distancias entre grupos y tamaños de grupo no son interpretables).
- **Inspector de embeddings:** clic en un punto → tesela, vecinos por similitud coseno, centroide por clase, matriz de distancias, búsqueda de parches similares.
- **Sonda lineal** y qué significa "separable".
- **Modelos de visión y lenguaje:** cero disparos, recuperación por texto, límites.
- **Enlace:** el parche fijado se localiza en el espacio latente.

### M5 · Domain shift y normalización · v2.1 · E: A
- **Fuentes del desplazamiento:** escáner, tinción, centro, protocolo, población, prevalencia. Diferencia entre desplazamiento de covariables y de etiquetas.
- **Lámina viajera:** el mismo tejido con tres perfiles de escáner (de M1); qué cambia en la imagen y en el espacio latente.
- **Diagnóstico:** ¿un clasificador adivina el hospital desde los embeddings? Silueta por sitio, accesibilidad del sitio por vecinos.
- **Evaluación honesta:** dejar un centro fuera frente a mezclar centros; caída de rendimiento por centro; calibración bajo desplazamiento.
- **Mitigaciones:** Reinhard, Macenko, Vahadane, aumento de color en espacio HED, adaptación de dominio, modelos fundacionales, aprendizaje federado entre centros.
- **Caso de fallo:** normalización que borra señal biológica.

### M6 · Datos y etiquetas · v2.2 · E: A *(nuevo)*
Cómo se construye un conjunto de datos y por qué las etiquetas definen lo que el modelo puede aprender.

1. **Ciclo de vida del dataset:** pregunta clínica → criterios de inclusión → obtención de láminas → desidentificación → escaneo → QC → anotación → particiones → versionado → documentación (hoja de datos del conjunto).
2. **Niveles de etiqueta** sobre el mismo tejido sintético, con costo, información y modelo posible:
   - **Fuerte:** máscara por píxel (segmentación), contorno de células o núcleos, caja delimitadora por célula.
   - **Intermedia:** puntos o centroides, regiones de interés, garabatos (*scribbles*).
   - **Débil:** etiqueta de lámina (del informe), etiqueta de paciente, evolución clínica (supervivencia, respuesta).
   - **Derivadas:** desde IHC o reteñido registrado, desde genómica (por ejemplo, estado molecular), desde texto del informe procesado con PLN.
   - **Automáticas:** pseudoetiquetas, etiquetas de otro modelo.
3. **Lienzo de anotación en vivo:** el estudiante dibuja una caja y ve el archivo en formato **YOLO** (`clase x_centro y_centro ancho alto`, normalizados); dibuja un polígono y ve máscara y exportación **COCO** o **GeoJSON** (QuPath); marca puntos y ve el conteo. Formatos: YOLO, COCO, Pascal VOC, GeoJSON, XML de ASAP [verificar]. Herramientas citadas: QuPath, CVAT, Label Studio.
4. **Concordancia entre anotadores:** tres "patólogos" simulados con distinto criterio; kappa de Cohen, Dice e IoU entre anotadores; consenso, adjudicación, voto mayoritario, STAPLE. Idea clave: **no existe una verdad de referencia sin error**.
5. **Ruido de etiquetas:** deslizador de error → efecto sobre el rendimiento.
6. **Anotar con presupuesto:** aprendizaje activo (elegir qué anotar por incertidumbre frente a azar), anotación asistida por modelo, pseudoetiquetado, semisupervisado. Curva de aprendizaje frente a horas de anotación.
7. **Particiones:** por paciente, estratificadas, cohorte externa (enlace con M9).
8. **Datos y ética:** consentimiento, desidentificación (la imagen de la etiqueta de la lámina y los metadatos pueden llevar datos personales), normas de protección de datos e investigación en salud. Caso regional: Colombia [verificar: Ley 1581 de 2012; Resolución 8430 de 1993]. Marco internacional para quien estudie en otro país [verificar: RGPD en la UE, HIPAA en EE. UU.].
9. **Caso de fallo:** etiquetas de informe que contradicen la lámina escaneada.

### M7 · Tareas y abordajes · v2.2 · E: M *(nuevo)*
Mapa de decisión interactivo: *"tengo estas etiquetas y esta pregunta clínica; ¿qué enfoque uso?"*
- Clasificación de lámina (MIL), clasificación de parche, **detección** (tipo YOLO), **segmentación** (U-Net, Cellpose, StarDist, HoVer-Net [verificar]), recuento, recuperación de imágenes, predicción de biomarcadores desde H&E, supervivencia, generación de informes.
- Para cada tarea: etiqueta que exige, costo, modelos habituales, métricas que corresponden (Dice, mAP, AUC, índice C), ejemplo en citología y en histología.

### M8 · Modelos MIL · v2.3 · E: A
Cada modelo tiene su **anatomía**: flujo de tensores con dimensiones, paso a paso animado, fórmula, seudocódigo, problema que resuelve del anterior y caso para romperlo.

| Modelo | Idea que se enseña |
|---|---|
| Media y máximo | Hipótesis MIL estándar frente a colectiva; fallo por dilución |
| ABMIL (atención con compuerta) | Atención aprendida |
| CLAM-SB y CLAM-MB | Agrupamiento a nivel de instancia como supervisión adicional |
| DSMIL | Dos flujos: instancia crítica y atención por similitud |
| TransMIL | Autoatención entre parches y codificación de posición |
| DTFD-MIL | Pseudobolsas en dos niveles |
| Agregadores difusos (Choquet, Sugeno) | Operadores de agregación con interacción entre instancias |
| BIMIL | Bolsa de fenotipos celulares en lugar de parches |

- **Arena:** la misma bolsa evaluada por todos los modelos; ranking de atención; coincidencia con la verdad de terreno.
- **Barrido de dilución:** Ŷ frente al porcentaje de señal positiva por modelo (problema de baja tasa de testigos).
- **Teoría:** hipótesis estándar, basada en umbral y colectiva; cuándo se cumple cada una.
- Referencias originales de cada modelo con DOI [verificar al construir cada ficha; revisar también ACMIL, MambaMIL y variantes recientes].

### M9 · Entrenamiento, validación y fugas de datos · v2.4 · E: M *(nuevo)*
Pérdida, desbalance de clases, validación cruzada repetida, cohorte de reserva de otra región, **fuga por parche frente a por paciente** (inflación visible del rendimiento), **aprendizaje por atajos** (tinta, hospital, escáner como señal), sobreajuste y curvas de aprendizaje.

### M10 · Evaluación y explicabilidad · v2.4 · E: M
Amplía la etapa 5: ROC y curva precisión–sensibilidad, intervalos por bootstrap, calibración, curva de decisión; umbral clínico; **la atención no es una explicación** frente a Grad-CAM, rollout de atención y gradientes integrados.

### M11 · Cuantificación (IHC) · v2.4 · E: M *(nuevo)*
Usa la modalidad IHC (DAB): deconvolución de color (HED), detección de núcleos positivos, porcentaje de positividad, H-score, índice de proliferación; variabilidad entre lectores y entre escáneres.

### M12 · Citología cervical a fondo · v2.5 · E: M *(nuevo, diferenciador)*
Sistema Bethesda (NILM, ASC-US, ASC-H, LSIL, HSIL, AGC, carcinoma escamoso), convencional frente a base líquida, tamizaje y triaje, células superpuestas y grupos gruesos, filtro de presencia epitelial, tasa de testigos baja, qué hace distinta a la citología de la histología para el diseño del modelo [verificar categorías y flujos con fuentes].

### M13 · Del laboratorio a la clínica · v2.5 · E: M *(nuevo)*
Flujo humano–IA (triaje, segundo lector, ayuda a la detección frente a ayuda al diagnóstico), integración con el sistema del laboratorio, regulación (caso regional: INVIMA; marco internacional: FDA y marcado CE en la UE) [verificar], ética, equidad, telepatología, costos y conectividad en LATAM y en entornos de recursos limitados, conjuntos de datos públicos [verificar licencias y vigencia].

### M14 · Lectura crítica de artículos · v2.5 · E: B *(nuevo)*
Lista de verificación guiada con señales de alerta: fuga de datos, ausencia de validación externa, un solo escáner, prueba pequeña, métricas sin intervalos, atención presentada como explicación. Listas de reporte (CLAIM, TRIPOD+AI, STARD-AI [verificar]). Ejercicio: resúmenes sintéticos de "artículos" con fallos escondidos.

### M15 · Retos finales · v3.0 · E: M
- **Diseña tu pipeline:** eliges escáner, normalización, encoder, tipo de etiqueta, modelo y evaluación; el simulador devuelve rendimiento por centro y costo.
- **Detective de fallos:** seis casos con un error escondido (fuga, atajo, desplazamiento, etiqueta ruidosa, umbral mal elegido, artefacto sin filtrar).

### Entrenamiento en el navegador · v3.0 (al final) · E: A
MLP pequeño y MIL con embeddings sintéticos de 16 dimensiones. Entrenable: media, máximo, ABMIL, CLAM. Solo inferencia con pesos fijos: DSMIL, TransMIL, DTFD-MIL. Se ve cómo se forma la atención por época.

## 7. Herramientas transversales

- **Calculadora de proyecto** (v2.5): láminas, aumento, planos Z, compresión → terabytes; horas de anotación por tipo de etiqueta; horas de GPU; tiempo de escaneo. Parámetros editables, sin cifras de costo por defecto.
- **Glosario** con ventanas emergentes (desde v2.0).
- **Banco de preguntas** (en ES y EN) de unas 40 a 60, selección aleatoria de 8, tres niveles, exportación de resultados a CSV (v2.1).
- **Estado compartible por enlace:** modalidad, módulo, parámetros, parche fijado en la URL.
- **Aumento de datos:** vista previa de rotación, desenfoque, elástica y *jitter* de color en HED, ligada a M5 y M9.
- **Infografía descargable** del pipeline y tarjetas para redes sociales (v2.5).
- **Constancia de finalización** descargable, generada en local (v3.0).

## 8. Modo docente

Pensado para que otros profesores de la región y de otros países lo adopten, en español y en inglés:
- Guía por módulo: objetivos, tiempos, preguntas para discusión, errores frecuentes.
- **Plan de clase de 90 minutos** por módulo.
- Claves de respuesta del quiz y rúbrica de la práctica.
- Ejercicios para casa (con y sin código).
- Enlace de estado compartible para entregar a los estudiantes la configuración exacta del ejercicio.

## 9. Evidencia de aprendizaje

- Pretest y postest anónimos por módulo, en local, con exportación opcional.
- Piloto con 23029 y con la maestría; protocolo y aval ético antes de recolectar nada.
- Resultado esperado: artículo de educación y datos para mejorar los módulos.

## 10. Fases

### v2.0 · Cimientos + escáneres
- [ ] Repositorio Vite, registro de módulos, carga diferida, dependencias locales
- [ ] **Sistema de idiomas ES/EN con selector** (sección 4), glosario ES–EN, estructura de referencias
- [ ] Extraer a `es.json` todas las cadenas de la v3.0 y traducirlas al inglés (interfaz, quiz, fórmulas, rótulos de escena)
- [ ] Cerrar deuda de v3.0 (ver sección 11)
- [ ] Pruebas automáticas e integración continua
- [ ] Despliegue en GitHub Pages con flujo de Actions, README con aviso de derechos, archivos de licencia, `CITATION.cff`, Zenodo
- [ ] M0, M1, M2, M3, cada uno en ES y EN

*Regla para todas las fases: cada módulo se entrega en español e inglés. La fase no se cierra si falla la prueba de claves o el recorrido en alguno de los dos idiomas.*

### v2.1 · Del escáner al espacio latente
- [ ] M4 Encoders y espacios latentes
- [ ] M5 Domain shift y normalización
- [ ] Banco de preguntas ampliado y exportación CSV
- [ ] Estado compartible por enlace

### v2.2 · Datos y abordajes
- [ ] M6 Datos y etiquetas (lienzo de anotación, YOLO, COCO, concordancia, ruido, aprendizaje activo)
- [ ] M7 Tareas y abordajes

*M6 va antes de MIL porque la etiqueta débil es el motivo por el que existe el MIL. Si prefieres verlo después, el cambio es pequeño.*

### v2.3 · MIL
- [ ] M8 con todos los modelos de la tabla, arena y barrido de dilución

### v2.4 · Rigor
- [ ] M9, M10, M11

### v2.5 · Citología y contexto
- [ ] M12, M13, M14
- [ ] Calculadora de proyecto, infografía, guía del docente completa

### v3.0 · Cierre
- [ ] M15 Retos finales
- [ ] Entrenamiento en el navegador
- [ ] Portugués de Brasil (opcional, según demanda; la estructura ya lo admite)
- [ ] Funcionamiento sin conexión (service worker)
- [ ] Constancia descargable
- [ ] Estudio de aprendizaje y artículo

## 11. Deuda de v3.0 (cerrar en v2.0)

- [ ] Recorrer las etapas 2 a 5 con IHC (solo se verificó la etapa 1).
- [ ] Marcadores 1 y 2 del top-3 se solapan en Citología Pap.
- [ ] Probar el panel lateral apilado en pantallas estrechas.
- [ ] Corregir texto del encoder: dimensión y tamaño de tesela según el encoder elegido (hoy fija 768 y 224×224).
- [ ] Declarar "convencional" en la modalidad Pap.
- [ ] Convertir los recorridos de Puppeteer en pruebas guardadas.
- [ ] Rótulos dibujados en texturas Canvas de la v3.0: hacerlos regenerables por idioma.

## 12. Fuera de alcance

- Subir o procesar láminas reales; datos de pacientes.
- Cualquier uso diagnóstico o clínico.
- Servidor propio o cuentas de usuario.
- Productos comerciales en este repositorio: GitHub Pages no admite alojar negocios o servicios comerciales; el proyecto se mantiene como recurso educativo gratuito.
- Entrenar modelos grandes: solo ejemplos pequeños y sintéticos.
- Más de dos idiomas antes de la v3.0, y traducción automática publicada sin revisión humana.

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| El alcance es grande | Cada versión es publicable por sí sola; recorte natural si el tiempo aprieta: M11, M14 y la calculadora |
| Simulación que se confunde con realidad | Etiqueta "simulado" en cada módulo; sección "qué es y qué no es real" |
| Errores de contenido | Revisión de especialistas y referencias con DOI por afirmación |
| Rendimiento en equipos modestos | Modo 2D, carga diferida, presupuesto de objetos por escena |
| Mantenimiento tras publicar | Plantillas de issues, versionado, pruebas automáticas |
| Dos idiomas duplican redacción y revisión (estimación propia: 20 a 30 % más de trabajo por módulo) | Cadenas en diccionario desde el primer día, glosario ES–EN, el inglés se redacta junto al español y no después, revisión por módulo |
| Inglés sin revisión pierde credibilidad ante un público internacional | Revisor del inglés con formación técnica; ninguna versión en inglés sale sin revisar |
| Textos de distinta longitud rompen la interfaz | Prueba de desbordamiento en ES y EN dentro de la integración continua |

## 14. Datos que se deben verificar con fuentes antes de escribirlos

Marcados con [verificar] arriba. Lista resumen: familias y ejemplos de escáneres; formatos WSI y DICOM; fichas de modelos fundacionales (dimensión, datos, licencia); modelos MIL recientes; formatos de anotación; herramientas de segmentación; categorías y flujo de Bethesda; normativa de datos e investigación en Colombia; regulación INVIMA y FDA; conjuntos de datos públicos y sus licencias; listas de reporte (CLAIM, TRIPOD+AI, STARD-AI); equivalencias ES–EN de la terminología de citología y de Bethesda; marcos de protección de datos y regulación fuera de Colombia (RGPD, HIPAA, FDA, marcado CE).

## 15. Preguntas abiertas

1. ¿Dominio propio más adelante? (no bloquea v2.0; la dirección inicial es `savia-lab.github.io/project-patologia-ia`)
2. Licencia de uso concreta de código y de contenidos (hoy: derechos reservados, sin licencia abierta). Falta confirmarla y consultar la propiedad intelectual de la universidad.
3. Revisión de contenido de citopatología y patología: definida en dos pasos (director y revisores senior). Falta confirmar la aceptación y el crédito de los revisores senior.
4. ¿Se desea analítica de uso (solo una que no guarde datos personales) o ninguna?
5. ¿M6 antes o después de M8?
6. Revisor del inglés: pendiente, se decide más adelante. Debe estar definido antes de publicar los textos en inglés de la v2.0 (formación técnica, de preferencia en patología o ciencia de datos en salud).
7. Variante del español: propuesta de partida, español neutro latinoamericano. ¿Se confirma?
