# Perfil de escáner genérico

Estructura de datos que M1 construye y que M2 y las fases siguientes leen desde `state.scannerProfile`. Describe un escáner **genérico**: ningún valor procede de la ficha técnica de un equipo y el curso no usa marcas comerciales.

Código: `src/engine/scanner-math.js` (funciones puras, con pruebas en `tests/unit/scanner-math.test.mjs`). Formato de intercambio: JSON con `schema: "generic-scanner-profile"` y `version: 1`.

## Campos

| Campo | Tipo | Significado | Procedencia |
|---|---|---|---|
| `family` | `high-volume`, `benchtop`, `low-cost`, `motorized` | Familia genérica; fija los valores por defecto de sensor, solapamiento, tiempos y color | ilustrativa |
| `objective` | 20 o 40 | Objetivo nominal. Solo elige el MPP ilustrativo; no equivale a un MPP universal | ilustrativa |
| `mpp` | `{x, y}` en µm/px | MPP nativo por eje. Nunca se completa en silencio: o lo escribe quien usa el módulo o se usa el ilustrativo del objetivo (20×: 0.5; 40×: 0.25) | `mppSource`: `user` o `illustrative-default` |
| `frame` | `{w, h}` en px | Tamaño de una captura del sensor | ilustrativa |
| `overlap` | 0 a menos de 1 | Solapamiento entre campos vecinos | ilustrativa |
| `scanMode` | `area` o `line` | Cámara de área (campos) o de línea (franjas) | elegida |
| `zPlanes`, `zStepUm` | entero, µm | Planos de enfoque y paso entre ellos | elegida |
| `focusPoints` | entero | Puntos del mapa de enfoque | elegida |
| `compression` | `{kind, ratio, ratioSource}` | `none`, `lossless` o `lossy`; razón ilustrativa editable | ilustrativa |
| `timing` | `{msField, msFocus, msZ, linesPerSecond}` | Parámetros del tiempo simulado | ilustrativa (`timingSource`) |
| `color` | `{gain[3], gamma, sat, bright}` | Respuesta de color de la familia; es la misma que usan los perfiles de hospital de E3 | ilustrativa |

## Qué se calcula y con qué procedencia

| Salida | Cálculo | Etiqueta |
|---|---|---|
| Píxeles de la imagen | ⌈área / MPP⌉ por eje | exacto |
| Campos o franjas, mosaico | rejilla con solapamiento y borde rellenado | exacto |
| Bytes sin comprimir | X · Y · 3 · Z (RGB de 8 bits) | exacto |
| Profundidad cubierta por Z | (Z - 1) · paso | exacto |
| Tiempo de escaneo | campos · (ms por campo + (Z - 1) · ms por plano) + enfoque; en línea, franjas · Z · líneas / líneas por segundo | simulado |
| Tamaño comprimido | bytes sin comprimir / razón ilustrativa | simulado |
| Costuras, bandas, franjas desenfocadas, sesgo de color | operaciones reales sobre píxeles de la imagen sintética; la intensidad es un parámetro pedagógico | imagen (operación) y simulado (intensidad) |

## Reglas

- Si falta el MPP o un valor no es válido, las funciones lanzan `PatchMathError` con un código (`VALOR_AUSENTE`, `VALOR_INVALIDO`, `MPP_AUSENTE`, ...). No hay valores por defecto ocultos.
- Exportar e importar conserva la procedencia: lo que era ilustrativo sigue marcado como ilustrativo.
- Al cargar un perfil en M1 se aplican la familia, el objetivo, el modo, los planos Z, los puntos de enfoque, la compresión y el MPP; los parámetros de tiempo y color se regeneran a partir de la familia.
- Para modelar un escáner real, se edita el MPP con el valor de su documentación y se exporta el perfil. Los tiempos y las razones de compresión siguen siendo ilustrativos.
