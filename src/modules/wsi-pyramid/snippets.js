/* Fragmentos de código de la parte L1 (OpenSlide en Python). Los comentarios salen del diccionario (m2.code.c.*), así que cambian con el idioma.
 * Verificados contra la documentación de OpenSlide Python y ejecutados con un TIFF piramidal sintético (docs/verificacion-openslide.md). */
export const VERIFIED_ON = '2026-11-27';

/** `c(clave)` devuelve el comentario traducido; `v` trae los valores actuales del módulo */
export const SNIPPETS = {
  inspect: {
    id: 'inspect',
    code: (v, c) => `import openslide

slide = openslide.OpenSlide("slide.svs")  # ${c('path')}
print(slide.level_count)  # ${c('count')}
print(slide.dimensions)  # ${c('dim')}
print(slide.level_dimensions)  # ${c('ldim')}
print(slide.level_downsamples)  # ${c('lds')}

mpp_x = slide.properties.get(openslide.PROPERTY_NAME_MPP_X)  # ${c('mpp')}
mpp_y = slide.properties.get(openslide.PROPERTY_NAME_MPP_Y)
if mpp_x is None or mpp_y is None:
    raise ValueError("${c('nompp')}")
mpp0 = (float(mpp_x), float(mpp_y))
mpp_nivel = [(mpp0[0] * d, mpp0[1] * d) for d in slide.level_downsamples]
print(mpp_nivel)
slide.close()`
  },
  read: {
    id: 'read',
    code: ({ x, y, level, w, h }, c) => `import openslide

slide = openslide.OpenSlide("slide.svs")
# location: ${c('loc')}
# level: ${c('lvl')}
# size: ${c('size')}
region = slide.read_region((${x}, ${y}), ${level}, (${w}, ${h}))  # ${c('rgba')}
rgb = region.convert("RGB")  # ${c('rgb')}
print(rgb.size)
slide.close()`
  },
  patch: {
    id: 'patch',
    code: ({ level, ds, ext, enc, mppx }, c) => `import openslide
from PIL import Image

slide = openslide.OpenSlide("slide.svs")
mpp0 = float(slide.properties[openslide.PROPERTY_NAME_MPP_X])  # ${c('mppfail')}
nivel = ${level}
ds = slide.level_downsamples[nivel]  # ${c('ds', { ds })}
mpp_extraccion = mpp0 * ds  # ${c('mppx', { mppx })}
extraccion = ${ext}  # ${c('ext')}
fov_um = extraccion * mpp_extraccion  # ${c('fov')}
entrada = ${enc}  # ${c('enc')}
mpp_encoder = fov_um / entrada  # ${c('mppenc')}
region = slide.read_region((0, 0), nivel, (extraccion, extraccion)).convert("RGB")
parche = region.resize((entrada, entrada), Image.BILINEAR)  # ${c('resample')}
slide.close()`
  }
};
