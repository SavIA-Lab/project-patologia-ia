# Verificación de los fragmentos de OpenSlide (M2)

Fecha de verificación: 2026-11-27.

## Documentación consultada

- API de OpenSlide Python: https://openslide.org/api/python/ (firma de `read_region`, atributos `level_count`, `dimensions`, `level_dimensions`, `level_downsamples`, `properties` y constantes `PROPERTY_NAME_MPP_X`, `PROPERTY_NAME_MPP_Y`, `PROPERTY_NAME_OBJECTIVE_POWER`).
- Propiedades estándar: https://openslide.org/docs/properties/ (`openslide.mpp-x` y `openslide.mpp-y`: "puede no estar presente o no ser exacto"; `openslide.objective-power`: "a menudo inexacto, a veces ausente").
- Formatos admitidos: https://openslide.org/formats/.

## Lo que dice la documentación y lo que se comprobó ejecutando

| Afirmación del módulo | Fuente | Comprobación |
|---|---|---|
| `read_region(location, level, size)` recibe `location` como esquina superior izquierda en el marco de referencia del nivel 0 | Página de la API de Python | Documentado |
| La imagen devuelta es RGBA (sin premultiplicar) | Página de la API de Python | Ejecutado: `mode == "RGBA"` |
| El tamaño de la imagen devuelta es el `size` pedido | La página de Python solo dice "tamaño de la región" | Ejecutado: `read_region((1000, 800), 1, (128, 96)).size == (128, 96)` |
| `level_downsamples` es una tupla de decimales y el nivel 0 vale 1.0 | Página de la API de Python | Ejecutado: `(1.0, 4.0, 16.0)` |
| El MPP puede faltar | Página de propiedades | Ejecutado: `properties.get(...)` devuelve `None` en un archivo sin calibración |

## Ejecución

- OpenSlide Python 1.4.7 con `openslide-bin` 4.0.1.2, en Python 3.13.
- Archivo de prueba sintético: TIFF piramidal en teselas de 3 niveles (2048 × 1536, 512 × 384 y 128 × 96 px) con etiquetas de resolución equivalentes a 0.25 µm/px en el nivel 0. No contiene ninguna imagen real.
- Se ejecutaron los tres fragmentos del módulo (`inspect`, `read`, `patch`) con los comentarios en español y en inglés, sin errores. La ruta `slide.svs` del texto se sustituyó por la del archivo sintético.
- Resultado de `inspect`: 3 niveles, dimensiones `((2048, 1536), (512, 384), (128, 96))`, MPP por nivel `[(0.25, 0.25), (1.0, 1.0), (4.0, 4.0)]`.

## Qué no se comprobó

- Archivos reales de ningún fabricante: el módulo no declara el comportamiento de equipos concretos.
- La compresión JPEG de los niveles: el entorno de prueba escribió el TIFF sintético con compresión sin pérdida.
