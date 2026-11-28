
/* =====================================================================
   13. UTILIDADES DE INTERFAZ
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPathVal = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const setText = (id, t) => { const e = document.getElementById(id); if (e && e.textContent !== String(t)) e.textContent = t; };
const setBar = (id, f) => { const e = document.getElementById(id); if (e) e.style.width = (clamp(f) * 100).toFixed(1) + '%'; };
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function showFatal(err) {
  console.error(err);
  $('#fatal').classList.add('show'); $('#fatal-msg').textContent = (err && err.message) ? err.message : String(err);
}
const FMT = {
  dilution: v => (v * 100).toFixed(1) + '%', explode: v => Math.round(v * 100) + '%',
  heatOpacity: v => Math.round(v * 100) + '%', heatThreshold: v => v.toFixed(2), tau: v => v.toFixed(2)
};
const fmtBytes = gb => gb >= 1 ? gb.toFixed(1) + ' GB' : (gb * 1000).toFixed(0) + ' MB';

/* =====================================================================
   14. CONTENIDO EDITORIAL POR ETAPA Y MODALIDAD
   ===================================================================== */
const STAGES = [null,
  {
    title: 'Lámina WSI y pirámide multi-escala', sub: 'Un archivo de gigapíxeles organizado en niveles de aumento', nav: 'WSI & Pirámide',
    body: {
      he: ['Un escáner convierte el portaobjetos de <b>H&amp;E</b> en una imagen de miles de millones de píxeles. Ningún modelo puede cargarla completa, así que el archivo guarda una <b>pirámide</b>: la misma región a 5×, 10×, 20× y 40×.',
        'A 5× se ve la <b>arquitectura</b> (glándulas, límite con el estroma, extensión de la lesión). A 40× aparece el <b>detalle nuclear</b>: pleomorfismo, cromatina y nucléolos. Cada nivel responde una pregunta distinta y ninguno la responde solo.'],
      pap: ['Una <b>citología de Papanicolaou</b> no es un corte de tejido: es un extendido de células sueltas sobre una superficie amplia. A 40× el archivo supera las decenas de gigapíxeles y casi todo es vidrio vacío, moco y células escamosas normales.',
        'Las células de alto grado forman grupos diminutos. A 5× apenas se insinúan; a 40× se mide la relación núcleo/citoplasma que define la atipia. Aquí el <b>detalle nuclear</b> pesa más que la arquitectura.'],
      ihc: ['En <b>IHC con DAB</b> el diagnóstico depende de dónde se deposita el cromógeno: en la membrana (HER2) o en el núcleo (Ki-67). A 5× se estima la extensión y la heterogeneidad del marcaje.',
        'A 20×–40× se confirma si la membrana está completa o parcial y se cuentan los núcleos positivos. Un aumento bajo puede sobrestimar la intensidad; uno alto pierde la visión de conjunto.']
    },
    formula: `<span class="ln"><span class="math-var">r</span><sub>ef</sub> (µm/px) = 0.25 · (40 / <span class="math-var">M</span>)</span>
      <span class="ln">Tamaño ≈ (<span class="math-var">W</span>/<span class="math-var">r</span><sub>ef</sub>) · (<span class="math-var">H</span>/<span class="math-var">r</span><sub>ef</sub>) · 3 bytes</span>
      <span class="math-note"><span class="math-var">M</span>: aumento objetivo · <span class="math-var">W</span>×<span class="math-var">H</span>: área escaneada en µm · 3 bytes por píxel RGB sin comprimir.</span>`
  },
  {
    title: 'Control de calidad (módulo de QC simulado) y teselado', sub: 'Cortar la lámina en parches y descartar los que no sirven', nav: 'QC & Teselado',
    body: {
      he: ['El modelo trabaja con <b>parches</b> de 224×224 o 512×512 px. Antes de usarlos, el módulo de QC simulado mide la <b>varianza del Laplaciano</b>: un parche desenfocado casi no tiene bordes y su varianza cae. Pliegues, tinta y burbujas se detectan por color y textura.',
        'Con el filtro apagado esos parches entran al encoder como si fueran tejido. Activa artefactos y apaga el módulo de QC para seguir cómo se propagan a las etapas siguientes.'],
      pap: ['En citología los problemas típicos son el <b>exceso de moco</b>, los acúmulos celulares gruesos y el desenfoque por el grosor del extendido. El fondo vacío es mayoritario, por eso se descarta antes de teselar.',
        'Un acúmulo grueso se parece a un grupo cohesivo hipercromático. Si pasa el filtro, el modelo puede confundirlo con una lesión.'],
      ihc: ['En IHC un pliegue oscuro o un trazo de tinta se parece a un marcaje DAB intenso. Un parche así produce una puntuación alta sin biología detrás, y el QC es la primera defensa.',
        'El desenfoque, en cambio, borra la diferencia entre marcaje membranoso y citoplasmático, y baja la reproducibilidad de la puntuación.']
    },
    formula: `<span class="ln">Var(∇²<span class="math-var">I</span>) = (1/<span class="math-var">n</span>) Σ<sub>x,y</sub> ( ∇²<span class="math-var">I</span>(x,y) − <span class="math-var">μ</span> )²</span>
      <span class="ln">Rechazar parche de tejido si Var(∇²<span class="math-var">I</span>) &lt; 60</span>
      <span class="math-note">∇²<span class="math-var">I</span>: Laplaciano de la intensidad. Menos bordes → menor varianza → imagen fuera de foco.</span>`
  },
  {
    title: 'Encoder visual (ViT), espacio latente y domain shift', sub: 'Cada parche se vuelve un vector: ¿agrupa por biología o por escáner?', nav: 'Encoder & Domain Shift',
    body: {
      he: ['Un <b>Foundation Encoder</b> (ViT) transforma cada parche en un vector <span class="math-vec">z</span>. UMAP proyecta esos vectores a 3D para inspeccionarlos. Con pesos aleatorios no hay estructura; con preentrenamiento se separan estroma, epitelio benigno, inflamación y tumor.',
        'El <b>efecto lote</b> aparece cuando tres hospitales tiñen y escanean distinto. Si los puntos se agrupan por hospital y no por morfología, el modelo aprendió el escáner.'],
      pap: ['En Papanicolaou la tinción cambia mucho entre laboratorios: tiempos de hematoxilina, contraste de los colorantes citoplasmáticos y fondo. Un encoder sin normalizar tiende a separar <b>laboratorios</b> antes que <b>tipos celulares</b>.',
        'Los grupos HSIL deben quedar juntos aunque vengan de escáneres distintos. Compara las tres estrategias y colorea por morfología y por hospital.'],
      ihc: ['En IHC la intensidad del DAB depende del anticuerpo, del lote de reactivo y del escáner. Un modelo que aprende «marrón más oscuro = positivo» falla en otro centro.',
        'La normalización de color y los encoders SSL buscan que el vector dependa de la <b>morfología y la localización del marcaje</b>, no del tono.']
    },
    formula: `<span class="ln"><span class="math-vec">z</span> = <span class="math-var">f</span><sub>θ</sub>(<span class="math-vec">x</span>) ∈ ℝ<sup>768</sup> &nbsp;→&nbsp; UMAP: ℝ<sup>768</sup> → ℝ<sup>3</sup></span>
      <span class="ln">Pureza = (1/<span class="math-var">N</span>) Σ<sub>i</sub> 𝟙[ morf(kNN<sub>i</sub>) = morf(<span class="math-var">i</span>) ]</span>
      <span class="ln">Efecto lote = fracción de vecinos del mismo hospital</span>`
  },
  {
    title: 'Multiple-Instance Learning (MIL)', sub: 'Una etiqueta para la lámina y 200 instancias sin etiquetar', nav: 'MIL & Atención',
    body: {
      he: ['En la práctica solo se conoce el diagnóstico de la lámina completa. MIL la trata como una <b>bolsa</b> de parches y aprende cómo combinarlos. El agregador decide cuánto pesa cada parche en la predicción.',
        'Con <b>Mean Pooling</b> la señal positiva se diluye entre parches sanos. <b>Max Pooling</b> detecta la señal, pero cualquier artefacto con puntuación alta lo engaña. La <b>atención con compuerta</b> aprende a mirar parches con morfología real.'],
      pap: ['En citología la lesión puede ser el <b>1.5 %</b> de la lámina: con 200 instancias son 3 parches positivos. Es el escenario donde el promedio falla de forma más clara.',
        'Baja la dilución hasta 0.5 % y comprueba que la atención sigue localizando la señal, mientras que el promedio la pierde por completo.'],
      ihc: ['En IHC la positividad ocupa una fracción moderada de la lámina, pero un pliegue oscuro o tinta puede puntuar como DAB intenso. Es un buen caso para comparar <b>Max Pooling</b> con la atención.',
        'Activa el artefacto distractor en una lámina negativa: el máximo predice positivo, la atención lo ignora.']
    },
    formula: `<span class="ln"><span class="math-var">a</span><sub>k</sub> = exp( <span class="math-vec">w</span><sup>⊤</sup>[ tanh(<span class="math-vec">V</span><span class="math-vec">h</span><sub>k</sub>) ⊙ σ(<span class="math-vec">U</span><span class="math-vec">h</span><sub>k</sub>) ] )</span>
      <span class="ln">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/ Σ<sub>j</sub> exp( <span class="math-vec">w</span><sup>⊤</sup>[ tanh(<span class="math-vec">V</span><span class="math-vec">h</span><sub>j</sub>) ⊙ σ(<span class="math-vec">U</span><span class="math-vec">h</span><sub>j</sub>) ] )</span>
      <span class="ln"><span class="math-var">Ŷ</span> = Σ<sub>k=1</sub><sup>N</sup> <span class="math-var">a</span><sub>k</sub> <span class="math-var">s</span><sub>k</sub> &nbsp;, &nbsp; Σ<sub>k</sub> <span class="math-var">a</span><sub>k</sub> = 1</span>
      <span class="math-note">Mean: <span class="math-var">a</span><sub>k</sub> = 1/<span class="math-var">N</span> · Max: <span class="math-var">a</span><sub>k</sub> = 1 en argmax <span class="math-var">s</span><sub>k</sub> · Atención: Softmax de los logits con compuerta.</span>`
  },
  {
    title: 'Explicabilidad (XAI) y umbral clínico', sub: '¿Dónde mira el modelo y qué umbral se elige?', nav: 'XAI & Umbral Clínico',
    body: {
      he: ['El <b>mapa de calor</b> combina la atención del modelo con la señal biológica. Sirve para auditar: ¿mira la glándula tumoral o un pliegue? El reto compara tu criterio con el del modelo.',
        'El <b>umbral τ</b> no es una decisión técnica sino clínica: mueve el equilibrio entre falsos negativos y falsos positivos.'],
      pap: ['En tamización cervical un falso negativo es una lesión de alto grado que sale sin seguimiento. Por eso se acepta un umbral bajo, con más falsos positivos que se resuelven con una prueba de confirmación.',
        'En el reto, los focos son diminutos: es normal que el ojo humano los pase por alto. Ahí el modelo aporta más.'],
      ihc: ['En IHC el umbral actúa como punto de corte de positividad (por ejemplo HER2 3+). Moverlo cambia a quién se ofrece una terapia dirigida.',
        'El mapa de calor debe coincidir con las regiones de marcaje membranoso completo, no con zonas de fondo o artefacto.']
    },
    formula: `<span class="ln">Sens = VP / (VP + FN) &nbsp;·&nbsp; Esp = VN / (VN + FP)</span>
      <span class="ln">VPP = VP / (VP + FP) &nbsp;·&nbsp; VPN = VN / (VN + FN)</span>
      <span class="ln">TPR(<span class="math-var">τ</span>) = Φ(<span class="math-var">μ</span> − <span class="math-var">x</span><sub>τ</sub>) &nbsp;, &nbsp; FPR(<span class="math-var">τ</span>) = 1 − Φ(<span class="math-var">x</span><sub>τ</sub>)</span>
      <span class="math-note">Modelo binormal: negativos ~ N(0,1), positivos ~ N(μ,1) con AUC = Φ(μ/√2) ≈ 0.94. Φ se calcula con la función de error.</span>`
  }
];

/* =====================================================================
   15. CONSTRUCCIÓN DEL PANEL LATERAL
   ===================================================================== */
const seg = (key, opts, num) => `<div class="seg-sm" role="group">${opts.map(([v, l]) => `<button type="button" data-set="${key}" data-value="${v}"${num ? ' data-num="1"' : ''}>${l}</button>`).join('')}</div>`;
const tog = (path, label, hint, cls = '') => `<label class="toggle-row"><span><b>${label}</b>${hint ? `<em>${hint}</em>` : ''}</span><input type="checkbox" class="switch ${cls}" data-toggle="${path}"></label>`;
const sld = (key, label, min, max, step, scale) => `<div class="ctl"><div class="ctl-label"><span>${label}</span><span class="val" data-valfor="${key}"></span></div><input type="range" min="${min}" max="${max}" step="${step}" data-slider="${key}" data-scale="${scale}"></div>`;
const metric = (id, label, sub = '', cls = '') => `<div class="metric ${cls}" id="m-${id}"><div class="ml">${label}</div><div class="mv" id="${id}">—</div>${sub ? `<div class="ms">${sub}</div>` : ''}</div>`;

function headHTML(n) {
  const S = STAGES[n], M = MODALITIES[state.modality];
  return `<div class="kicker">Etapa ${n} / 5</div>
    <h2 class="stage-title">${S.title}</h2>
    <p class="stage-sub">${S.sub}</p>
    <span class="mod-pill"><i style="background:${M.accent}"></i>${M.name} · ${M.diagnosisTitle}</span>
    <div class="prose">${S.body[state.modality].map(p => `<p>${p}</p>`).join('')}</div>
    <div class="sec"><h3>Fórmula clave</h3><div class="math-box">${S.formula}</div></div>`;
}

function sidebarStage1() {
  return `<div class="sec"><h3>Controles</h3>
      <div class="ctl-label"><span>Nivel de aumento</span></div>
      ${seg('pyramidLevel', [[0, '5×'], [1, '10×'], [2, '20×'], [3, '40×']], true)}
      <div style="margin-top:6px">
        ${tog('showPyramid', 'Pirámide multi-escala', 'Cuatro planos unidos por líneas de frustum')}
        ${tog('showGigaGrid', 'Cuadrícula gigapíxel', 'Referencia de mosaico sobre el tejido')}
      </div>
    </div>
    <div class="sec"><h3>Vista microscópica de la ROI</h3>
      <div class="canvas-frame"><canvas id="pyr-canvas" width="480" height="270"></canvas>
        <div class="canvas-cap"><span class="mono" id="pyr-cap-l"></span><span class="mono" id="pyr-cap-r"></span></div></div>
      <div class="bar-row"><div class="bar-head"><b>Contexto arquitectural</b><span class="mono" id="pyr-ctx-v"></span></div><div class="bar-track"><div class="bar-fill hema" id="pyr-ctx"></div></div></div>
      <div class="bar-row"><div class="bar-head"><b>Detalle nuclear</b><span class="mono" id="pyr-det-v"></span></div><div class="bar-track"><div class="bar-fill eosin" id="pyr-det"></div></div></div>
    </div>
    <div class="sec"><h3>Métricas en vivo</h3>
      <div class="metric-grid">${metric('s1-res', 'Resolución efectiva', 'µm por píxel')}${metric('s1-size', 'Tamaño estimado', 'RGB sin comprimir')}${metric('s1-px', 'Píxeles del nivel', 'área escaneada')}${metric('s1-fov', 'Campo de la ROI', 'ancho del recorte')}</div>
      <div class="note" id="s1-note"></div>
    </div>`;
}
function sidebarStage2() {
  return `<div class="sec"><h3>Teselado</h3>
      <div class="ctl-label"><span>Tamaño del parche</span></div>
      ${seg('patchSize', [[224, '224×224 px'], [512, '512×512 px']], true)}
      ${tog('discardBg', 'Descartar fondo blanco', 'Atenúa teselas sin tejido')}
      ${sld('explode', 'Explosión 3D', 0, 100, 1, 0.01)}
    </div>
    <div class="sec"><h3>Simulador de artefactos</h3>
      ${tog('artifacts.blur', 'Desenfoque óptico (Blur)', 'Baja la varianza Laplaciana', 'sw-amber')}
      ${tog('artifacts.folds', 'Pliegues / Acúmulos', 'Bandas oscuras densas', 'sw-amber')}
      ${tog('artifacts.ink', 'Tinta de marcador', 'Trazo verde-azul oscuro en el borde', 'sw-amber')}
      ${tog('artifacts.bubbles', 'Burbujas / Hemorragia-Moco', 'Aire atrapado o exceso de moco', 'sw-amber')}
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--line)">${tog('qcOn', 'Filtro QC automático (módulo de QC simulado)', 'ON: excluye las teselas con artefacto · OFF: pasan como válidas')}</div>
      <div class="note" id="s2-note"></div>
    </div>
    <div class="sec"><h3>Trazabilidad de un parche</h3>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" data-action="pin-atypical">Fijar Foco Atípico</button>
        <button type="button" class="btn btn-sm" data-action="pin-healthy">Fijar Tejido Sano</button>
        <button type="button" class="btn btn-sm" data-action="pin-artifact">Fijar Artefacto</button>
        <button type="button" class="btn btn-sm" data-action="unpin">Soltar</button>
      </div>
      <p style="font-size:12px;color:var(--ink2);margin:8px 0 0">También puedes hacer clic en cualquier tesela del visor. El parche fijado se sigue hasta la Etapa 5.</p>
    </div>
    <div class="sec"><h3>Métricas en vivo</h3>
      <div class="metric-grid c3">${metric('s2-total', 'Teselas', 'grilla')}${metric('s2-tissue', 'Con tejido', '')}${metric('s2-ok', 'Aprobadas', '', 'good')}${metric('s2-rej', 'Rechazadas QC', '', 'bad')}${metric('s2-unf', 'Sin filtrar', '', 'warn')}${metric('s2-lap', 'Var. Laplaciana', 'media en tejido')}</div>
    </div>`;
}
function sidebarStage3() {
  return `<div class="sec"><h3>Encoder y espacio latente</h3>
      <div class="ctl-label"><span>Estado del encoder</span></div>
      ${seg('encoderTrained', [[false, 'Pesos aleatorios (Sin entrenar)'], [true, 'Preentrenado (Morfología separada)']])}
      <div class="ctl-label" style="margin-top:12px"><span>Estrategia de normalización</span></div>
      ${seg('normMode', [['none', 'Sin normalizar'], ['macenko', 'Normalización Macenko'], ['ssl', 'Foundation SSL']])}
      <div class="ctl-label" style="margin-top:12px"><span>Colorear UMAP por</span></div>
      ${seg('umapColor', [['morph', 'Morfología celular'], ['hospital', 'Hospital / Escáner']])}
      <div class="note" id="s3-note"></div>
    </div>
    <div class="sec"><h3>Simulador multicéntrico (3 hospitales)</h3>
      <div class="thumb-grid">
        ${HOSPITALS.map(h => `<figure><canvas id="hosp-${h.key}" width="140" height="140"></canvas><figcaption><b>${h.name}</b><br>${h.scanner}<br><span style="color:var(--ink3)">${h.desc}</span></figcaption></figure>`).join('')}
      </div>
      <p style="font-size:11.5px;color:var(--ink2);margin:8px 0 0">Mismo parche con el perfil de color de cada escáner. Al activar Macenko o SSL los tres convergen.</p>
    </div>
    <div class="sec"><h3>Métricas en vivo</h3>
      <div class="bar-row"><div class="bar-head"><b>Efecto lote (batch effect)</b><span class="mono" id="s3-batch-v"></span></div><div class="bar-track"><div class="bar-fill crimson" id="s3-batch"></div></div></div>
      <div class="bar-row"><div class="bar-head"><b>Pureza morfológica</b><span class="mono" id="s3-pur-v"></span></div><div class="bar-track"><div class="bar-fill" id="s3-pur"></div></div></div>
    </div>`;
}
function sidebarStage4() {
  const rows = [['mean', 'Mean Pooling'], ['max', 'Max Pooling'], ['attention', 'Gated Attention (CLAM)']];
  return `<div class="sec"><h3>Escenario</h3>
      <div class="ctl-label"><span>Agregador activo (vista 3D)</span></div>
      ${seg('aggregator', [['mean', 'Mean Pooling'], ['max', 'Max Pooling'], ['attention', 'Gated Attention MIL (CLAM)']])}
      <div class="ctl-label" style="margin-top:12px"><span>Escenario real (Ground Truth)</span></div>
      ${seg('groundTruth', [['pos', 'Lámina Positiva'], ['neg', 'Lámina Negativa']])}
      ${sld('dilution', 'Dilución de señal positiva', 0.5, 35, 0.5, 0.01)}
      ${tog('distractor', 'Inyectar artefacto distractor', 'Parche con señal espuria alta (s = 0.92)', 'sw-crimson')}
      <div class="note" id="s4-note"></div>
    </div>
    <div class="sec"><h3>Comparativa simultánea de agregadores</h3>
      <table class="tbl"><thead><tr><th>Agregador</th><th>Ŷ</th><th>máx a<sub>k</sub></th><th>Etiqueta</th></tr></thead><tbody>
      ${rows.map(([k, l]) => `<tr id="t4-row-${k}"><td>${l}</td><td id="t4-y-${k}">—</td><td id="t4-w-${k}">—</td><td><span class="chip" id="t4-l-${k}">—</span></td></tr>`).join('')}
      </tbody></table>
      <p style="font-size:11.5px;color:var(--ink2);margin:8px 0 0">Umbral de decisión 0.50. VP/VN: acierto · FN: lesión no detectada · FP: alarma falsa.</p>
    </div>
    <div class="sec"><h3>Métricas en vivo</h3>
      <div class="metric-grid">${metric('s4-k', 'Instancias positivas', 'K = máx(1, round(200·d))')}${metric('s4-sum', 'Σ a_k (atención)', 'debe ser 1.000000', 'good')}${metric('s4-neff', 'N efectivo', 'sin excluidas por QC')}${metric('s4-dist', 'Distractores', 'instancias espurias')}</div>
    </div>`;
}
function sidebarStage5() {
  const M = MODALITIES[state.modality], ch = state.challenge;
  const top3 = M.top3.map((t, i) => `<button type="button" class="top3-card" data-action="top3" data-i="${i}">
      <canvas id="t3c-${i}" width="152" height="152"></canvas>
      <div class="t3-i"><div class="t3-h">#${t.rank} · parche ${t.coords}</div><div class="t3-r">a<sub>k</sub> = <span id="t3a-${i}">—</span> · x ${(t.u * 100).toFixed(1)}% · y ${(t.v * 100).toFixed(1)}%</div><div style="margin-top:3px;color:var(--ink2)">${t.morphology}</div></div></button>`).join('');
  let challengeHTML;
  if (!ch.active) challengeHTML = `<p style="font-size:12.5px;color:var(--ink2);margin:0 0 8px">Oculta el mapa de calor y marca hasta 3 zonas sospechosas sobre la lámina. Después compara tu criterio con el del modelo.</p><button type="button" class="btn btn-hema" data-action="challenge-start">Iniciar reto Humano vs. IA</button>`;
  else if (!ch.revealed) challengeHTML = `<div class="note warn">Pines colocados: <b>${ch.pins.length} / 3</b>. Haz clic sobre la lámina 3D para marcar una sospecha.</div>
      <div class="btn-row"><button type="button" class="btn btn-danger" data-action="challenge-reveal" ${ch.pins.length ? '' : 'disabled'}>Revelar IA y Evaluar</button><button type="button" class="btn" data-action="challenge-reset">Reiniciar</button></div>`;
  else {
    const r = ch.result;
    challengeHTML = `<div style="display:flex;align-items:baseline;gap:10px"><span class="score-big" style="color:${r.agreement >= 70 ? 'var(--teal)' : r.agreement >= 40 ? 'var(--amber)' : 'var(--crimson)'}">${r.agreement}%</span><span style="font-size:12.5px;color:var(--ink2)">de acuerdo Humano–IA</span></div>
      <ul class="pin-list">${r.items.map((it, i) => `<li><span><b>Pin ${i + 1}</b> · ${it.which} · ${it.dw.toFixed(2)} u</span><span class="chip ${it.cls === 'Acierto' ? 'ok' : it.cls === 'Periferia' ? 'warn' : 'bad'}">${it.cls}</span></li>`).join('')}</ul>
      <div class="btn-row"><button type="button" class="btn" data-action="challenge-reset">Reiniciar reto</button></div>`;
  }
  return `<div class="sec"><h3>Mapa de calor XAI</h3>
      ${sld('heatOpacity', 'Opacidad del mapa', 0, 100, 1, 0.01)}
      ${sld('heatThreshold', 'Umbral visual de calor', 0, 90, 1, 0.01)}
      <div class="ctl-label" style="margin-top:10px"><span>Escala térmica</span></div>
      ${seg('heatScale', [['amber', 'Ámbar–Carmesí'], ['viridis', 'Viridis']])}
      <div class="lg-ramp" id="s5-ramp" style="margin-top:8px;height:9px"></div>
    </div>
    <div class="sec"><h3>Top-3 parches influyentes (40×)</h3><div class="top3">${top3}</div></div>
    <div class="sec"><h3>Reto: Humano vs. IA</h3>${challengeHTML}</div>
    <div class="sec"><h3>Curva ROC y umbral clínico (τ)</h3>
      <div class="canvas-frame"><canvas id="roc-canvas" width="520" height="340"></canvas></div>
      ${sld('tau', 'Umbral de decisión τ', 10, 90, 1, 0.01)}
      <div class="btn-row" style="margin-top:4px">
        <button type="button" class="btn btn-sm" data-action="tau-preset" data-v="0.25">Tamización (τ = 0.25)</button>
        <button type="button" class="btn btn-sm" data-action="tau-preset" data-v="0.5">Equilibrado (τ = 0.50)</button>
        <button type="button" class="btn btn-sm" data-action="tau-preset" data-v="0.75">Confirmación (τ = 0.75)</button>
      </div>
      <div class="metric-grid" style="margin-top:10px">${metric('roc-sens', 'Sensibilidad', 'VP / (VP+FN)', 'good')}${metric('roc-spec', 'Especificidad', 'VN / (VN+FP)', 'good')}${metric('roc-ppv', 'VPP', 'precisión positiva')}${metric('roc-npv', 'VPN', 'precisión negativa')}</div>
      <div style="font-size:11.5px;color:var(--ink2);margin:10px 0 2px">Cohorte simulada: 1,000 pacientes · prevalencia 10 % (100 positivos, 900 negativos)</div>
      <div class="cm"><div class="h"></div><div class="h">Positivo real</div><div class="h">Negativo real</div>
        <div class="h">Pred. +</div><div class="tp" id="cm-tp">—</div><div class="fp" id="cm-fp">—</div>
        <div class="h">Pred. −</div><div class="fn" id="cm-fn">—</div><div class="tn" id="cm-tn">—</div></div>
      <div class="note" id="s5-note"></div>
    </div>`;
}

function renderSidebar(keepScroll) {
  const sb = $('#editorial-sidebar'), top = sb.scrollTop, n = state.stage;
  const body = [null, sidebarStage1, sidebarStage2, sidebarStage3, sidebarStage4, sidebarStage5][n]();
  sb.innerHTML = headHTML(n) + body + `<div class="foot mono">Datos sintéticos generados en el navegador (Canvas 2D). Con fines docentes; no sustituye validación clínica.</div>`;
  sb.scrollTop = keepScroll ? top : 0;
  syncControls();
  dirty.sidebarLive = true;
  if (n === 5) { dirty.top3Thumbs = true; }
}
function syncControls() {
  $$('[data-set]').forEach(b => {
    const cur = String(getPath(state, b.dataset.set)), on = cur === b.dataset.value;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  $$('[data-toggle]').forEach(i => { i.checked = !!getPath(state, i.dataset.toggle); });
  $$('[data-slider]').forEach(i => {
    const key = i.dataset.slider, sc = parseFloat(i.dataset.scale || 1), v = getPath(state, key);
    if (document.activeElement !== i) i.value = Math.round(v / sc * 1000) / 1000;
    const lab = document.querySelector(`[data-valfor="${key}"]`); if (lab) lab.textContent = (FMT[key] || (x => x))(v);
  });
  $$('.stage-btn').forEach(b => { const on = +b.dataset.stage === state.stage; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
}

/* ---------- Actualización en vivo del panel ---------- */
function updateSidebarLive() {
  const n = state.stage, M = MODALITIES[state.modality];
  if (n === 1) {
    const L = PYR_LEVELS[state.pyramidLevel], cv = $('#pyr-canvas');
    if (cv) {
      const ctx = cv.getContext('2d'); drawPyramidLevel(ctx, cv.width, cv.height, state.pyramidLevel);
      const umpp = M.scanMm[0] * 1000 / L.zoom / cv.width, barUm = [1000, 500, 250, 100][state.pyramidLevel], bp = barUm / umpp;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(12, cv.height - 30, bp + 62, 20);
      ctx.fillStyle = '#0F172A'; ctx.fillRect(18, cv.height - 21, bp, 3.5);
      ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(barUm >= 1000 ? '1 mm' : barUm + ' µm', 24 + bp, cv.height - 15);
      ctx.fillStyle = 'rgba(76,58,122,0.92)'; ctx.fillRect(cv.width - 54, 10, 44, 22); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(L.mag + '×', cv.width - 32, 25);
      setText('pyr-cap-l', `Objetivo ${L.mag}× · ROI en el foco atípico`); setText('pyr-cap-r', `${L.res} µm/px`);
    }
    setText('pyr-ctx-v', L.context + '%'); setText('pyr-det-v', L.detail + '%'); setBar('pyr-ctx', L.context / 100); setBar('pyr-det', L.detail / 100);
    const pxs = (M.scanMm[0] * 1000 / L.res) * (M.scanMm[1] * 1000 / L.res), gb = pxs * 3 / 1e9;
    setText('s1-res', L.res.toFixed(2) + ' µm/px'); setText('s1-size', fmtBytes(gb)); setText('s1-px', pxs >= 1e9 ? (pxs / 1e9).toFixed(2) + ' Gpx' : (pxs / 1e6).toFixed(0) + ' Mpx');
    setText('s1-fov', (M.scanMm[0] / L.zoom).toFixed(1) + ' mm');
    const note = $('#s1-note'); if (note) note.innerHTML = `Área escaneada: ${M.scanMm[0]} × ${M.scanMm[1]} mm. ${state.pyramidLevel <= 1 ? 'Nivel con buen contexto, poco detalle: sirve para localizar regiones.' : 'Nivel con detalle nuclear, poco contexto: sirve para graduar la atipia.'}`;
  } else if (n === 2) {
    const inf = world.s2.infos || [];
    if (inf.length) {
      const tissue = inf.filter(i => !i.bg), ok = tissue.filter(i => !i.hasArtifact), rej = tissue.filter(i => i.rejected), unf = tissue.filter(i => i.hasArtifact && !i.rejected);
      const lapAvg = ok.length ? ok.reduce((a, i) => a + i.lap, 0) / ok.length : 0;
      setText('s2-total', inf.length); setText('s2-tissue', tissue.length); setText('s2-ok', ok.length); setText('s2-rej', rej.length); setText('s2-unf', unf.length); setText('s2-lap', lapAvg.toFixed(0));
      const note = $('#s2-note'); if (note) {
        const anyAct = activeArtifactKeys().length > 0;
        note.className = 'note ' + (hasUnfilteredArtifacts() ? 'bad' : (anyAct ? 'warn' : ''));
        note.innerHTML = hasUnfilteredArtifacts() ? `<b>Módulo de QC apagado:</b> ${unf.length} teselas con artefacto pasan como válidas y contaminarán el UMAP (Etapa 3) y el MIL (Etapa 4).`
          : (anyAct ? `<b>Módulo de QC activo:</b> ${rej.length} teselas rechazadas (Var. Laplaciana &lt; ${QC_LAPLACIAN_MIN} o patrón de pliegue, tinta o burbuja). No llegan al encoder.` : 'Activa uno o más artefactos para ver cómo los detecta el filtro.');
      }
    }
  } else if (n === 3) {
    const mt = umapMetrics();
    setText('s3-batch-v', (mt.batch * 100).toFixed(0) + '%'); setText('s3-pur-v', (mt.purity * 100).toFixed(0) + '%'); setBar('s3-batch', mt.batch); setBar('s3-pur', mt.purity);
    const note = $('#s3-note'); if (note) {
      note.className = 'note ' + (mt.nContam ? 'bad' : '');
      note.innerHTML = mt.nContam ? `<b>Clúster contaminante:</b> ${mt.nContam} parches con artefacto (módulo de QC apagado) invaden el espacio latente y reducen la pureza.`
        : (!state.encoderTrained ? 'Con pesos aleatorios los puntos no tienen estructura útil.' : (state.normMode === 'none' ? 'Los puntos se agrupan por <b>hospital/escáner</b>: efecto lote alto. Prueba Macenko o SSL.' : (state.normMode === 'macenko' ? 'Macenko alinea el color: el efecto lote baja, pero queda residuo.' : 'Representaciones invariantes al escáner: los grupos obedecen a la biología.')));
    }
    drawHospitalThumbs();
  } else if (n === 4) {
    const S = world.s4.state;
    if (S) {
      [['mean', 'mean'], ['max', 'max'], ['attention', 'att']].forEach(([k, a]) => {
        setText('t4-y-' + k, S.y[a].toFixed(3)); setText('t4-w-' + k, (S.maxW[a] * 100).toFixed(1) + '%');
        const l = document.getElementById('t4-l-' + k); if (l) { l.textContent = S.label[a]; l.className = 'chip ' + S.label[a]; }
        const r = document.getElementById('t4-row-' + k); if (r) r.classList.toggle('act', k === state.aggregator);
      });
      setText('s4-k', S.K); setText('s4-sum', S.sumAtt.toFixed(6)); setText('s4-neff', S.neff); setText('s4-dist', S.dist.length);
      const note = $('#s4-note'); if (note) {
        const forced = hasUnfilteredArtifacts();
        note.className = 'note ' + (forced ? 'warn' : '');
        note.innerHTML = `Ground truth: <b>${state.groundTruth === 'pos' ? 'positiva' : 'negativa'}</b> · dilución ${(state.dilution * 100).toFixed(1)} % → ${S.K} instancia(s) positiva(s) de ${MIL_BAG_SIZE}.` +
          (forced ? ' <b>Distractores activos</b> por artefactos sin filtrar de la Etapa 2.' : '') + (S.nExcl ? ` ${S.nExcl} instancias excluidas por el módulo de QC.` : '');
      }
    }
  } else if (n === 5) {
    const S = world.s4.state;
    M.top3.forEach((t, i) => { setText('t3a-' + i, S ? (S.w.att[t.bagIndex] * 100).toFixed(1) + '%' : '—'); });
    $$('.top3-card').forEach(c => c.classList.toggle('sel', +c.dataset.i === state.selectedTop3));
    const ramp = $('#s5-ramp'); if (ramp) ramp.style.background = rampCss(state.heatScale);
    const r = rocAt(state.tau);
    setText('roc-sens', (r.sens * 100).toFixed(1) + '%'); setText('roc-spec', (r.spec * 100).toFixed(1) + '%'); setText('roc-ppv', (r.ppv * 100).toFixed(1) + '%'); setText('roc-npv', (r.npv * 100).toFixed(1) + '%');
    setText('cm-tp', 'VP ' + r.tp); setText('cm-fn', 'FN ' + r.fn); setText('cm-fp', 'FP ' + r.fp); setText('cm-tn', 'VN ' + r.tn);
    const cv = $('#roc-canvas'); if (cv) drawROC(cv.getContext('2d'), cv.width, cv.height);
    const note = $('#s5-note'); if (note) note.innerHTML = state.tau <= 0.3 ? `<b>Perfil de tamización:</b> casi no se pierden lesiones (${r.fn} FN), a costa de ${r.fp} falsos positivos que requieren confirmación.`
      : (state.tau >= 0.7 ? `<b>Perfil de confirmación:</b> pocos falsos positivos (${r.fp}), pero se escapan ${r.fn} lesiones. Útil como segunda prueba, no como tamización.` : `<b>Punto equilibrado:</b> sensibilidad y especificidad similares; VPP bajo por la prevalencia del 10 %.`);
  }
}
function drawHospitalThumbs() {
  const M = MODALITIES[state.modality], p = state.pinned, amount = NORM_MODES[state.normMode].amount;
  const aty = p ? Math.max(0.2, p.atypia) : 0.9, seed = p ? 500 + p.col * 13 + p.row : 77;
  const key = [state.modality, state.normMode, aty.toFixed(2), seed, compositeVersion].join('|');
  if (world.s3.hospKey === key && document.getElementById('hosp-A') && document.getElementById('hosp-A').dataset.k === key) return;
  world.s3.hospKey = key;
  HOSPITALS.forEach(h => {
    const cv = document.getElementById('hosp-' + h.key); if (!cv) return;
    const ctx = cv.getContext('2d'); drawHighMag40xView(ctx, cv.width, cv.height, state.modality, aty, seed);
    const img = ctx.getImageData(0, 0, cv.width, cv.height); applyColorProfile(img, HOSP_PROFILES[h.key], amount); ctx.putImageData(img, 0, 0);
    cv.dataset.k = key;
  });
}
function drawTop3Thumbs() {
  const M = MODALITIES[state.modality];
  M.top3.forEach((t, i) => { const cv = document.getElementById('t3c-' + i); if (cv) drawHighMag40xView(cv.getContext('2d'), cv.width, cv.height, state.modality, 0.95, t.seed); });
  dirty.top3Thumbs = false;
}

/* =====================================================================
   16. LEYENDA, HUD DE TRAZABILIDAD Y BANNER DEL RETO
   ===================================================================== */
function updateLegend() {
  const el = $('#legend'), M = MODALITIES[state.modality], n = state.stage; let h = '';
  const row = (c, t, sq) => `<div class="lg-row"><span class="${sq ? 'lg-sq' : 'lg-dot'}" style="background:${c}"></span>${t}</div>`;
  if (n === 1) h = `<h4>Pirámide WSI</h4>${row('#4C3A7A', 'Planos 5× · 10× · 20× · 40× (clic para elegir)', true)}${row('#0F766E', 'ROI sobre la lámina', true)}${row('#BE123C', 'Foco atípico', false)}`;
  else if (n === 2) h = `<h4>Estado de las teselas</h4>${row('#FFFFFF', 'Aprobada', true)}${row('#F2B8C2', 'Rechazada por QC (borde carmesí)', true)}${row('#D97706', 'Artefacto sin filtrar (borde ámbar)', true)}${row('#E2E8F0', 'Fondo (atenuada)', true)}`;
  else if (n === 3) {
    if (state.umapColor === 'morph') h = `<h4>Morfología celular</h4>${M.clusters.map(c => row(c.hex, c.label)).join('')}${contamCount() ? row(CONTAM_COLOR.hex, 'Contaminante (artefacto)') : ''}`;
    else h = `<h4>Hospital / escáner</h4>${HOSPITALS.map(c => row(c.hex, `${c.name} (${c.scanner})`)).join('')}${contamCount() ? row(CONTAM_COLOR.hex, 'Contaminante (artefacto)') : ''}`;
  }
  else if (n === 4) h = `<h4>Bolsa MIL</h4><div class="lg-ramp" style="background:linear-gradient(90deg,#A8B4C5,#D97706,#BE123C)"></div><div style="display:flex;justify-content:space-between;color:var(--ink2);font-size:10.5px"><span>s<sub>k</sub> bajo</span><span>s<sub>k</sub> alto</span></div><div style="margin-top:4px;color:var(--ink2)">Tamaño y altura del nodo: peso a<sub>k</sub></div>${row('#EA580C', 'Distractor espurio')}${row('#E2E8F0', 'Excluida por QC')}`;
  else h = `<h4>Mapa de calor XAI</h4><div class="lg-ramp" style="background:${rampCss(state.heatScale)}"></div><div style="display:flex;justify-content:space-between;color:var(--ink2);font-size:10.5px"><span>bajo</span><span>alto</span></div>${row('#0F766E', 'Pin: acierto')}${row('#D97706', 'Pin: periferia')}${row('#BE123C', 'Pin: desvío')}`;
  el.innerHTML = h;
  $('#stage-badge').textContent = `ETAPA ${n}/5 · ${STAGES[n].nav}`;
}
let hudSig = '';
function updateHUD() {
  const hud = $('#trace-hud'), p = state.pinned;
  if (!p || state.stage < 2) { hud.classList.remove('show'); hudSig = ''; return; }
  const n = state.stage, W = activeWeights(), S = world.s4.state, bi = p.bagIndex;
  let st = '', cls = '';
  const excluded = p.qcStatus === 'Rechazado por QC', bgx = p.tileType === 'fondo';
  if (n === 2) { st = `QC: <b>${p.qcStatus}</b> · Var. Lap. ${p.laplacian.toFixed(0)}`; cls = excluded ? 'bad' : (p.qcStatus === 'Artefacto sin filtrar' ? 'warn' : ''); }
  else if (n === 3) {
    if (excluded) { st = '<b>Excluido por el módulo de QC:</b> no entra al encoder ni al UMAP.'; cls = 'bad'; }
    else if (bgx) { st = '<b>Fondo:</b> descartado antes del encoder.'; cls = 'warn'; }
    else if (p.umapIndex >= UMAP_N) { st = `Punto UMAP #${p.umapIndex} · <b>contaminante</b> (artefacto sin filtrar)`; cls = 'bad'; }
    else if (p.umapIndex >= 0) { const sm = world.s3.umap.samples[p.umapIndex]; st = `Punto UMAP #${p.umapIndex} · ${MODALITIES[state.modality].clusters[sm.cluster].label}`; }
  } else if (n === 4) {
    if (excluded) { st = '<b>Instancia excluida por el módulo de QC</b> (a<sub>k</sub> = 0).'; cls = 'bad'; }
    else if (S && W) { st = `Instancia #${bi} · a<sub>k</sub> = <b>${(W[bi] * 100).toFixed(2)}%</b> (${AGG_LABEL[state.aggregator]})`; }
  } else {
    const hv = heatAt(p.u, p.v);
    st = `Calor XAI en el parche: <b>${hv.toFixed(2)}</b>${S ? ` · a<sub>k</sub> = ${(S.w.att[bi] * 100).toFixed(2)}%` : ''}`;
    if (excluded) { st = '<b>Excluido por el módulo de QC</b> · sin contribución al mapa.'; cls = 'bad'; }
  }
  const sig = [n, p.col, p.row, p.thumbnailDataUrl.length, st, state.aggregator, state.stage, p.qcStatus].join('|');
  hud.classList.add('show');
  if (sig === hudSig) return; hudSig = sig;
  hud.innerHTML = `<div class="hud-head"><span class="hud-title">Trazabilidad de parche</span><button type="button" class="btn btn-sm" data-action="unpin" style="padding:2px 8px">Soltar</button></div>
    <div class="hud-body"><img class="hud-thumb" src="${p.thumbnailDataUrl}" alt="Miniatura del parche fijado"><div class="hud-info mono"><div><span class="k">(col, row)</span> (${p.col}, ${p.row})</div><div><span class="k">tipo</span> ${TILE_TYPE_LABEL[p.tileType]}</div><div><span class="k">atipia</span> ${p.atypia.toFixed(2)}</div><div><span class="k">u,v</span> ${p.u.toFixed(3)}, ${p.v.toFixed(3)}</div></div></div>
    <div class="hud-state ${cls}">${st}</div>
    <div class="hud-links">${[2, 3, 4, 5].map(k => `<button type="button" data-goto="${k}" class="${k === n ? 'cur' : ''}">E${k}</button>`).join('')}</div>`;
}
let bannerSig = '';
function updateBanner() {
  const b = $('#challenge-banner'), ch = state.challenge;
  if (!(state.stage === 5 && ch.active)) { b.classList.remove('show'); bannerSig = ''; return; }
  const sig = [ch.pins.length, ch.revealed, ch.result ? ch.result.agreement : -1].join('|');
  b.classList.add('show'); if (sig === bannerSig) return; bannerSig = sig;
  if (!ch.revealed) b.innerHTML = `<div style="font-size:12.5px"><b>Reto Humano vs. IA</b> · el mapa de calor está oculto.<br>Marca hasta 3 sospechas sobre la lámina (${ch.pins.length}/3).</div>
      <div class="btn-row" style="margin-top:6px"><button type="button" class="btn btn-sm btn-danger" data-action="challenge-reveal" ${ch.pins.length ? '' : 'disabled'}>Revelar IA y Evaluar</button><button type="button" class="btn btn-sm" data-action="challenge-reset">Reiniciar</button></div>`;
  else b.innerHTML = `<div style="font-size:12.5px"><b>Resultado:</b> acuerdo Humano–IA <b>${ch.result.agreement}%</b> · ${ch.result.items.map((it, i) => `pin ${i + 1}: ${it.cls}`).join(' · ')}</div><div class="btn-row" style="margin-top:6px"><button type="button" class="btn btn-sm" data-action="challenge-reset">Reiniciar reto</button></div>`;
}

/* =====================================================================
   17. PARCHE FIJADO (TRAZABILIDAD END-TO-END)
   ===================================================================== */
function findUmapIndex(info) {
  if (info.bg || info.rejected) return -1;
  const U = world.s3.umap; if (!U) return -1;
  let best = -1, bd = 1e9;
  if (info.hasArtifact) {
    U.contam.forEach((c, j) => { if (!info.artifactKeys.includes(c.key)) return; const d = (c.u - info.u) ** 2 * 4 + (c.v - info.v) ** 2; if (d < bd) { bd = d; best = UMAP_N + j; } });
    return best;
  }
  U.samples.forEach((s, i) => { const d = (s.u - info.u) ** 2 * 4 + (s.v - info.v) ** 2 + (s.cluster === info.clusterIndex ? 0 : 1); if (d < bd) { bd = d; best = i; } });
  return best;
}
function makeThumb(info) {
  const c = makeCanvas(96, 96), x = c.getContext('2d'), du = 1 / info.cols, dv = 1 / info.rows;
  drawCompositeCrop(x, info.u - du / 2, info.v - dv / 2, info.u + du / 2, info.v + dv / 2, 96, 96);
  return c.toDataURL('image/png');
}
function fillPinned(p, info) {
  p.col = info.col; p.row = info.row; p.u = info.u; p.v = info.v;
  p.tileType = info.tileType; p.qcStatus = info.qcStatus; p.laplacian = info.lap; p.atypia = info.atypia;
  p.bagIndex = cellIndexUV(info.u, info.v); p.umapIndex = findUmapIndex(info); p.thumbnailDataUrl = makeThumb(info);
}
function pinPatchAtTile(col, row, silent) {
  const s2 = world.s2, info = s2.infos[row * s2.cols + col]; if (!info) return;
  state.pinned = { anchorU: info.u, anchorV: info.v };
  fillPinned(state.pinned, info); dirty.sidebarLive = true; hudSig = '';
  if (!silent) toast(`Parche (${col}, ${row}) fijado: ${TILE_TYPE_LABEL[info.tileType]} · ${info.qcStatus}`);
}
function pinPatchAtUV(u, v) {
  const s2 = world.s2; pinPatchAtTile(Math.min(s2.cols - 1, Math.floor(u * s2.cols)), Math.min(s2.rows - 1, Math.floor(v * s2.rows)));
}
function refreshPinned() {
  const p = state.pinned, s2 = world.s2; if (!p || !s2.infos.length) return;
  const col = Math.min(s2.cols - 1, Math.floor(p.anchorU * s2.cols)), row = Math.min(s2.rows - 1, Math.floor(p.anchorV * s2.rows));
  fillPinned(p, s2.infos[row * s2.cols + col]); hudSig = ''; dirty.sidebarLive = true;
}
function unpin() { state.pinned = null; hudSig = ''; dirty.sidebarLive = true; }
function pinQuick(kind) {
  const s2 = world.s2; if (!s2.infos.length) return;
  let list = s2.infos.filter(i => !i.bg);
  if (kind === 'artifact') {
    let cand = s2.infos.filter(i => i.hasArtifact);
    if (!cand.length) { state.artifacts.folds = true; markArtifactsChanged(); processDirty(true); cand = s2.infos.filter(i => i.hasArtifact); toast('Se activó «Pliegues / Acúmulos» para tener un artefacto que seguir.'); }
    cand.sort((a, b) => b.artifactKeys.length - a.artifactKeys.length || b.atypia - a.atypia);
    if (cand.length) pinPatchAtTile(cand[0].col, cand[0].row, true), toast(`Artefacto fijado en (${cand[0].col}, ${cand[0].row}): ${cand[0].qcStatus}`);
    return;
  }
  list = list.filter(i => !i.hasArtifact);
  if (kind === 'atypical') list.sort((a, b) => b.atypia - a.atypia);
  else list.sort((a, b) => (b.cov * (1 - b.atypia) * (b.atypia < 0.12 ? 1 : 0.2)) - (a.cov * (1 - a.atypia) * (a.atypia < 0.12 ? 1 : 0.2)));
  if (list.length) pinPatchAtTile(list[0].col, list[0].row);
}
function markArtifactsChanged() { dirty.composite = true; dirty.tiles = true; dirty.bag = true; dirty.mil = true; dirty.umap = true; dirty.pyramidTex = true; dirty.sidebarLive = true; dirty.heat = true; }

/* =====================================================================
   18. ESTADO, EVENTOS Y CAMBIO DE MODALIDAD
   ===================================================================== */
function setState(path, value) {
  const old = getPath(state, path); if (old === value) return;
  setPathVal(state, path, value);
  onStateChange(path);
  syncControls();
}
function onStateChange(path) {
  if (path === 'modality') return changeModality();
  if (path === 'pyramidLevel' || path === 'showPyramid' || path === 'showGigaGrid') { applyStage1State(); dirty.sidebarLive = true; }
  else if (path === 'patchSize') { rebuildTiles(); dirty.sidebarLive = true; }
  else if (path === 'discardBg' || path === 'explode') { dirty.tilesVisual = true; }
  else if (path.startsWith('artifacts.') || path === 'qcOn') { markArtifactsChanged(); dirty.legend = true; }
  else if (path === 'encoderTrained' || path === 'normMode' || path === 'umapColor') { dirty.umap = true; dirty.sidebarLive = true; dirty.legend = true; }
  else if (['aggregator', 'groundTruth', 'dilution', 'distractor'].includes(path)) { dirty.mil = true; dirty.sidebarLive = true; }
  else if (path === 'heatOpacity') applyHeatVisibility();
  else if (path === 'heatThreshold' || path === 'heatScale') { dirty.heatColor = true; dirty.sidebarLive = true; dirty.legend = true; }
  else if (path === 'tau') dirty.sidebarLive = true;
}
function changeModality() {
  const M = MODALITIES[state.modality];
  state.dilution = M.defaultDilution; state.selectedTop3 = -1;
  generateBaseModalityCanvas(state.modality, baseCanvas);
  rebuildCompositeTexture(); rebuildSlideLabelTexture();
  rebuildPyramid(); rebuildTop3Markers(); rebuildUmapData(); recomputeBagRank();
  world.s5.bio = null; world.s3.hospKey = '';
  resetChallenge();
  dirty.composite = false; dirty.tiles = true; dirty.bag = true; dirty.mil = true; dirty.umap = true; dirty.pyramidTex = true; dirty.heat = true; dirty.heatColor = true; dirty.sidebarLive = true; dirty.legend = true; dirty.top3Thumbs = true;
  hudSig = '';
  renderSidebar(true); updateLegend();
  toast(`Modalidad: ${M.name} · dilución por defecto ${(M.defaultDilution * 100).toFixed(1)} %`);
}
function setStage(n, instant) {
  n = Math.max(1, Math.min(5, n));
  state.stage = n;
  for (let i = 1; i <= 5; i++) stageGroups[i].visible = i === n;
  if (camera) flyToStagePreset(n, instant ? 0.01 : 0.9);
  world.s2.hoverIndex = -1; hideTooltip();
  dirty.pyramidTex = true; dirty.heat = true; dirty.heatColor = true; dirty.sidebarLive = true; dirty.top3Thumbs = true; hudSig = ''; bannerSig = '';
  renderSidebar(false); updateLegend(); updateBanner();
  $('#cam-prev').disabled = n === 1; $('#cam-next').disabled = n === 5;
}
function handleAction(a, el) {
  if (a === 'pin-atypical') pinQuick('atypical');
  else if (a === 'pin-healthy') pinQuick('healthy');
  else if (a === 'pin-artifact') pinQuick('artifact');
  else if (a === 'unpin') unpin();
  else if (a === 'top3') selectTop3(+el.dataset.i);
  else if (a === 'challenge-start') { startChallenge(); renderSidebar(true); }
  else if (a === 'challenge-reveal') { if (revealChallenge()) { renderSidebar(true); toast('Mapa de calor revelado.'); } }
  else if (a === 'challenge-reset') { resetChallenge(); renderSidebar(true); }
  else if (a === 'tau-preset') setState('tau', parseFloat(el.dataset.v));
}
function selectTop3(i) {
  state.selectedTop3 = i; const t = MODALITIES[state.modality].top3[i];
  if (!heatVisible()) { toast('Termina el reto para inspeccionar los Top-3.'); return; }
  flyToUV(t.u, t.v); dirty.sidebarLive = true;
}
function bindEvents() {
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-set]');
    if (s) { let v = s.dataset.value; if (s.dataset.num) v = parseFloat(v); else if (v === 'true') v = true; else if (v === 'false') v = false; setState(s.dataset.set, v); return; }
    const a = e.target.closest('[data-action]'); if (a) { handleAction(a.dataset.action, a); return; }
    const g = e.target.closest('[data-goto]'); if (g) { setStage(+g.dataset.goto); return; }
    const st = e.target.closest('.stage-btn'); if (st) setStage(+st.dataset.stage);
  });
  document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.slider) setState(el.dataset.slider, parseFloat(el.value) * parseFloat(el.dataset.scale || 1)); });
  document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.toggle) setState(el.dataset.toggle, el.checked); });
  $('#cam-prev').addEventListener('click', () => setStage(state.stage - 1));
  $('#cam-next').addEventListener('click', () => setStage(state.stage + 1));
  $('#cam-center').addEventListener('click', () => flyToStagePreset(state.stage));
  $('#btn-quiz').addEventListener('click', () => openQuiz(true));
  $('#btn-panel').addEventListener('click', () => { $('#main').classList.toggle('sidebar-collapsed'); setTimeout(resizeRenderer, 30); });
  const el = renderer.domElement;
  let down = null;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1; pointerPx.x = e.clientX - r.left; pointerPx.y = e.clientY - r.top; pointerIn = true; hoverDirty = true; dragging = !!(e.buttons & 1) && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4; if (dragging) hideTooltip(); });
  el.addEventListener('pointerleave', () => { pointerIn = false; hideTooltip(); if (world.s2.hoverIndex !== undefined) world.s2.hoverIndex = -1; });
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) handleViewportClick(); down = null; dragging = false; });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#quiz-modal').classList.contains('show')) closeQuiz(); });
  window.addEventListener('resize', resizeRenderer);
  window.addEventListener('pagehide', disposeAll);
  if (window.ResizeObserver) new ResizeObserver(resizeRenderer).observe($('#viewport'));
}
function resizeRenderer() {
  if (!renderer) return;
  const host = $('#gl-host'), w = host.clientWidth, h = host.clientHeight;
  if (w < 4 || h < 4) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function disposeAll() {
  Object.values(stageGroups).forEach(g => disposeObjectTree(g));
  if (renderer) { renderer.dispose(); }
}

/* =====================================================================
   19. INTERACCIÓN 3D: RAYCASTING, TOOLTIP Y CLIC
   ===================================================================== */
const pointerPx = { x: 0, y: 0 };
let pointerIn = false, hoverDirty = false, dragging = false;
function showTooltip(html) {
  const tt = $('#tooltip'), host = $('#viewport');
  tt.innerHTML = html; tt.style.display = 'block';
  const w = tt.offsetWidth, h = tt.offsetHeight;
  let x = pointerPx.x + 16, y = pointerPx.y + 14;
  if (x + w > host.clientWidth - 6) x = pointerPx.x - w - 14;
  if (y + h > host.clientHeight - 6) y = pointerPx.y - h - 12;
  tt.style.left = Math.max(4, x) + 'px'; tt.style.top = Math.max(4, y) + 'px';
}
function hideTooltip() { const t = $('#tooltip'); if (t) t.style.display = 'none'; if (renderer) renderer.domElement.style.cursor = 'grab'; }
const ttRow = (k, v) => `<div class="tt-r"><span>${k}</span><b>${v}</b></div>`;
function runHover() {
  hoverDirty = false;
  if (!pointerIn || dragging || camTween.active) return;
  raycaster.setFromCamera(pointer, camera);
  const n = state.stage, cv = renderer.domElement;
  let tip = null, cursor = 'grab';
  if (n === 1 && world.s1.pyr.visible) {
    const h = raycaster.intersectObjects(world.s1.planes, false)[0];
    if (h) { const L = PYR_LEVELS[h.object.userData.level]; tip = `<div class="tt-t">Plano ${L.mag}×</div>${ttRow('resolución', L.res + ' µm/px')}${ttRow('contexto', L.context + '%')}${ttRow('detalle', L.detail + '%')}<div style="color:#94A3B8;margin-top:3px">clic para activar</div>`; cursor = 'pointer'; }
  } else if (n === 2) {
    const h = raycaster.intersectObjects(world.s2.tiles, false)[0];
    world.s2.hoverIndex = h ? h.object.userData.tileIndex : -1;
    if (h) {
      const i = world.s2.infos[h.object.userData.tileIndex];
      if (i) { tip = `<div class="tt-t">Tesela (${i.col}, ${i.row}) · ${TILE_TYPE_LABEL[i.tileType]}</div>${ttRow('cobertura', (i.cov * 100).toFixed(0) + '%')}${ttRow('Var. Laplaciana', i.lap.toFixed(1))}${ttRow('atipia', i.atypia.toFixed(2))}${ttRow('estado QC', i.qcStatus)}${i.artifactKeys.length ? ttRow('artefacto', i.artifactKeys.map(k => ARTIFACTS[k].label.split(' ')[0]).join(', ')) : ''}<div style="color:#94A3B8;margin-top:3px">clic para fijar el parche</div>`; cursor = 'pointer'; }
    }
  } else if (n === 3) {
    const h = raycaster.intersectObject(world.s3.mesh, false)[0];
    if (h && h.instanceId !== undefined && contamActive(h.instanceId)) {
      const i = h.instanceId, U = world.s3.umap;
      if (i >= UMAP_N) tip = `<div class="tt-t">Contaminante #${i}</div>${ttRow('origen', ARTIFACTS[U.contam[i - UMAP_N].key].label)}<div style="color:#FCA5A5">Módulo de QC apagado</div>`;
      else { const s = U.samples[i]; tip = `<div class="tt-t">Parche UMAP #${i}</div>${ttRow('morfología', MODALITIES[state.modality].clusters[s.cluster].label)}${ttRow('hospital', HOSPITALS[s.hosp].name)}${ttRow('u, v', s.u.toFixed(2) + ', ' + s.v.toFixed(2))}<div style="color:#94A3B8;margin-top:3px">clic para fijar este parche</div>`; cursor = 'pointer'; }
    }
  } else if (n === 4) {
    const h = raycaster.intersectObject(world.s4.nodes, false)[0], S = world.s4.state;
    if (h && h.instanceId !== undefined && S) {
      const k = h.instanceId, W = activeWeights();
      tip = `<div class="tt-t">Instancia #${k} (${k % MIL_COLS}, ${Math.floor(k / MIL_COLS)})</div>${ttRow('s_k', S.s[k].toFixed(3))}${ttRow('a_k', (W[k] * 100).toFixed(2) + '%')}${ttRow('rol', S.excl[k] ? 'excluida por QC' : S.isDist[k] ? 'distractor' : S.isPos[k] ? 'positiva' : 'sana')}<div style="color:#94A3B8;margin-top:3px">clic para fijar este parche</div>`; cursor = 'pointer';
    }
  } else if (n === 5) {
    const vis = heatVisible();
    if (vis) { const mh = raycaster.intersectObjects(world.s5.markers.map(m => m.hit), false)[0]; if (mh) { const t = MODALITIES[state.modality].top3[mh.object.userData.top3]; tip = `<div class="tt-t">Top-${t.rank} · parche ${t.coords}</div>${ttRow('a_k', (world.s4.state.w.att[t.bagIndex] * 100).toFixed(1) + '%')}`; cursor = 'pointer'; } }
    if (!tip) {
      const h = raycaster.intersectObject(world.s5.slide.tissue, false)[0];
      if (h) {
        const u = h.uv.x, v = 1 - h.uv.y;
        if (state.challenge.active && !state.challenge.revealed) { tip = `<div class="tt-t">Reto activo</div>${ttRow('u, v', u.toFixed(2) + ', ' + v.toFixed(2))}<div style="color:#FDE68A">clic para marcar sospecha (${state.challenge.pins.length}/3)</div>`; cursor = 'crosshair'; }
        else if (vis) tip = `<div class="tt-t">Lámina XAI</div>${ttRow('u, v', u.toFixed(2) + ', ' + v.toFixed(2))}${ttRow('calor', heatAt(u, v).toFixed(2))}`;
      }
    }
  }
  if (tip) showTooltip(tip); else { $('#tooltip').style.display = 'none'; }
  cv.style.cursor = cursor;
}
function handleViewportClick() {
  if (camTween.active) return;
  raycaster.setFromCamera(pointer, camera);
  const n = state.stage;
  if (n === 1 && world.s1.pyr.visible) {
    const h = raycaster.intersectObjects(world.s1.planes, false)[0];
    if (h) setState('pyramidLevel', h.object.userData.level);
  } else if (n === 2) {
    const h = raycaster.intersectObjects(world.s2.tiles, false)[0];
    if (h) pinPatchAtTile(h.object.userData.col, h.object.userData.row);
  } else if (n === 3) {
    const h = raycaster.intersectObject(world.s3.mesh, false)[0];
    if (h && h.instanceId !== undefined && h.instanceId < UMAP_N && contamActive(h.instanceId)) { const s = world.s3.umap.samples[h.instanceId]; pinPatchAtUV(s.u, s.v); }
  } else if (n === 4) {
    const h = raycaster.intersectObject(world.s4.nodes, false)[0];
    if (h && h.instanceId !== undefined) { const k = h.instanceId; pinPatchAtUV(((k % MIL_COLS) + 0.5) / MIL_COLS, (Math.floor(k / MIL_COLS) + 0.5) / MIL_ROWS); }
  } else if (n === 5) {
    if (heatVisible()) { const mh = raycaster.intersectObjects(world.s5.markers.map(m => m.hit), false)[0]; if (mh) { selectTop3(mh.object.userData.top3); return; } }
    const ch = state.challenge;
    if (ch.active && !ch.revealed) {
      const h = raycaster.intersectObject(world.s5.slide.tissue, false)[0];
      if (h) { if (addChallengePin(h.uv.x, 1 - h.uv.y)) renderSidebar(true); else toast('Máximo 3 pines. Pulsa «Revelar IA y Evaluar».'); }
    }
  }
}

/* =====================================================================
   20. QUIZ CONCEPTUAL (8 PREGUNTAS)
   ===================================================================== */
const QUIZ = [
  { q: '¿Por qué un archivo WSI guarda varios niveles de aumento (5×, 10×, 20×, 40×) en lugar de una sola imagen?',
    o: ['Para comprimir los colores y reducir el peso del archivo.', 'Porque cada nivel ofrece un compromiso: 5× conserva el contexto arquitectural y 40× el detalle nuclear, y la imagen completa no cabe en memoria.', 'Porque el escáner repite la captura varias veces para promediar el ruido.', 'Porque los modelos de IA solo funcionan a 5×.'], c: 1,
    e: 'La pirámide permite elegir el aumento según la pregunta: a bajo aumento se localiza y se ve la arquitectura; a alto aumento se evalúa la atipia nuclear. Cargar los gigapíxeles del nivel base completo no es viable.' },
  { q: '¿Qué diferencia a una biopsia H&E de una citología Papanicolaou en cuanto a la señal positiva?',
    o: ['La biopsia siempre tiene menos células que el extendido citológico.', 'La citología se tiñe con DAB y la biopsia con hematoxilina.', 'En citología las células atípicas son una fracción mínima (≈1–2 %) de un extendido disperso; en la biopsia la lesión ocupa un área mayor y compacta (≈10–20 %).', 'No hay diferencia: la dilución de la señal es igual en ambas.'], c: 2,
    e: 'La dilución extrema de la citología cervical convencional hace que unas pocas células de alto grado queden rodeadas de miles de normales. Esto condiciona la elección del agregador en MIL.' },
  { q: '¿Por qué la varianza del Laplaciano sirve como criterio de control de calidad frente a desenfoque, tinta y pliegues?',
    o: ['Un parche desenfocado pierde bordes y su varianza Laplaciana cae bajo el umbral; la tinta y los pliegues se detectan con reglas de color y textura complementarias.', 'Porque mide el color promedio del parche y detecta la tinta verde.', 'Porque cuenta el número de núcleos por campo.', 'Porque indica cuánto fondo blanco hay en el parche.'], c: 0,
    e: 'El Laplaciano responde a cambios bruscos de intensidad. Una imagen fuera de foco es suave, con pocos bordes y varianza baja. Un parche de fondo también tiene varianza baja, por eso se distingue por cobertura de tejido.' },
  { q: '¿Qué representa el espacio latente UMAP de un Foundation Encoder (ViT)?',
    o: ['La posición física de cada parche sobre el portaobjetos.', 'La probabilidad de diagnóstico de cada parche.', 'Las coordenadas de píxel asignadas por el escáner.', 'Una proyección 3D de los vectores z de cada parche, donde la cercanía indica similitud aprendida por el encoder (idealmente morfológica).'], c: 3,
    e: 'UMAP reduce los vectores de alta dimensión a 3D conservando la vecindad. Con preentrenamiento, los parches con morfología parecida quedan juntos; con pesos aleatorios, no hay estructura.' },
  { q: 'En el simulador, los puntos del UMAP se agrupan por hospital y no por morfología. ¿Qué indica y cómo se corrige?',
    o: ['Indica que hay pocos parches; se corrige entrenando más épocas.', 'Es el efecto lote (domain shift): el encoder codifica tinción y escáner. Se reduce con normalización de Macenko o con un encoder SSL invariante al escáner.', 'Indica que el modelo ya distingue bien los diagnósticos; no requiere corrección.', 'Se corrige aumentando el umbral τ.'], c: 1,
    e: 'Si el espacio latente separa centros, el clasificador aprenderá atajos de color. Macenko alinea la tinción; los modelos SSL aprenden representaciones que dependen menos del escáner.' },
  { q: '¿Por qué Mean Pooling falla en MIL cuando la lesión ocupa menos del 2 % de la lámina?',
    o: ['Porque requiere etiquetas por parche.', 'Porque solo mira el parche más grande.', 'Porque promedia las puntuaciones: los pocos parches positivos se diluyen entre cientos de sanos y Ŷ queda bajo 0.50 (falso negativo).', 'Porque ignora los parches sanos.'], c: 2,
    e: 'Con a_k = 1/N, la contribución de K parches positivos es proporcional a K/N. Con K = 3 de 200, Ŷ queda cerca de la puntuación de los sanos.' },
  { q: '¿Qué ventaja tiene Gated Attention MIL (CLAM) frente a Max Pooling cuando hay un artefacto distractor?',
    o: ['Aprende pesos de atención que privilegian rasgos morfológicos reales y atenúan al distractor; Max Pooling toma el máximo sin discriminar y predice falso positivo.', 'Siempre da una probabilidad más alta que Max Pooling.', 'No necesita el softmax porque los pesos ya suman 1.', 'Elimina el distractor antes de calcular la atención, sin usar pesos.'], c: 0,
    e: 'La compuerta tanh ⊙ σ modula qué rasgos cuentan. El distractor tiene puntuación alta pero rasgos de artefacto, así que recibe peso casi nulo tras el softmax; Max Pooling solo ve el valor 0.92.' },
  { q: 'En un escenario de tamización poblacional, ¿cómo conviene fijar el umbral clínico τ en comparación con una confirmación diagnóstica?',
    o: ['Alto, para evitar cualquier falso positivo.', 'Siempre 0.50, porque es el punto equilibrado.', 'Da igual: la curva ROC es la misma para cualquier τ.', 'Bajo: prioriza la sensibilidad y minimiza falsos negativos, aceptando más falsos positivos que se resuelven con una prueba posterior. La confirmación usa un τ más alto.'], c: 3,
    e: 'En tamización, perder una lesión es más costoso que repetir o confirmar un caso. Un τ bajo sube la sensibilidad y el VPN, y baja el VPP. En confirmación se busca precisión.' }
];
let quiz = { i: 0, score: 0, answered: false, sel: -1, done: false }, quizLastFocus = null;
function openQuiz(reset) {
  if (reset) quiz = { i: 0, score: 0, answered: false, sel: -1, done: false };
  quizLastFocus = document.activeElement; $('#quiz-modal').classList.add('show'); renderQuiz();
}
function closeQuiz() { $('#quiz-modal').classList.remove('show'); if (quizLastFocus && quizLastFocus.focus) quizLastFocus.focus(); }
function renderQuiz() {
  const m = $('#quiz-modal'), Q = QUIZ[quiz.i], L = 'ABCD';
  let h;
  if (quiz.done) {
    const pct = Math.round(quiz.score / QUIZ.length * 100);
    h = `<div class="quiz-card"><div class="quiz-top"><span class="kicker" id="quiz-title">Quiz conceptual · resultado</span></div>
      <div class="quiz-prog"><div style="width:100%"></div></div>
      <div style="text-align:center;padding:14px 0 6px"><div class="score-big" style="font-size:44px;color:${pct >= 75 ? 'var(--teal)' : pct >= 50 ? 'var(--amber)' : 'var(--crimson)'}">${quiz.score} / ${QUIZ.length}</div>
      <p style="color:var(--ink2);margin:6px 0 0">${pct >= 87 ? 'Dominas el pipeline de punta a punta.' : pct >= 62 ? 'Buen avance. Revisa las etapas donde fallaste y vuelve a intentarlo.' : 'Recorre las 5 etapas con los controles interactivos y reintenta.'}</p></div>
      <div class="quiz-nav"><button type="button" class="btn" data-q="close">Cerrar</button><button type="button" class="btn btn-hema" data-q="retry">Reintentar</button></div></div>`;
  } else {
    h = `<div class="quiz-card"><div class="quiz-top"><span class="kicker" id="quiz-title">Pregunta ${quiz.i + 1} de ${QUIZ.length}</span><span class="mono" style="font-size:12px;color:var(--ink2)">Puntaje ${quiz.score}</span></div>
      <div class="quiz-prog"><div style="width:${(quiz.i + (quiz.answered ? 1 : 0)) / QUIZ.length * 100}%"></div></div>
      <p class="quiz-q">${Q.q}</p>
      ${Q.o.map((t, i) => { let c = ''; if (quiz.answered) c = i === Q.c ? 'ok' : (i === quiz.sel ? 'no' : ''); return `<button type="button" class="quiz-opt ${c}" data-qopt="${i}" ${quiz.answered ? 'disabled' : ''}><span class="lt">${L[i]}</span><span>${t}</span></button>`; }).join('')}
      ${quiz.answered ? `<div class="quiz-fb ${quiz.sel === Q.c ? 'ok' : 'no'}"><b>${quiz.sel === Q.c ? 'Correcto.' : 'No es esa.'}</b> ${Q.e}</div>` : ''}
      <div class="quiz-nav"><button type="button" class="btn" data-q="close">Salir</button>${quiz.answered ? `<button type="button" class="btn btn-hema" data-q="next">${quiz.i === QUIZ.length - 1 ? 'Ver resultado' : 'Siguiente'}</button>` : '<span></span>'}</div></div>`;
  }
  m.innerHTML = h;
  const f = m.querySelector('.btn-hema, .quiz-opt:not([disabled])'); if (f) f.focus({ preventScroll: true });
}
function bindQuiz() {
  $('#quiz-modal').addEventListener('click', e => {
    if (e.target.id === 'quiz-modal') return closeQuiz();
    const o = e.target.closest('[data-qopt]');
    if (o && !quiz.answered) { quiz.sel = +o.dataset.qopt; quiz.answered = true; if (quiz.sel === QUIZ[quiz.i].c) quiz.score++; renderQuiz(); return; }
    const b = e.target.closest('[data-q]'); if (!b) return;
    if (b.dataset.q === 'close') closeQuiz();
    else if (b.dataset.q === 'retry') { quiz = { i: 0, score: 0, answered: false, sel: -1, done: false }; renderQuiz(); }
    else if (b.dataset.q === 'next') { if (quiz.i === QUIZ.length - 1) quiz.done = true; else { quiz.i++; quiz.answered = false; quiz.sel = -1; } renderQuiz(); }
  });
}

/* =====================================================================
   21. BUCLE PRINCIPAL Y ARRANQUE
   ===================================================================== */
const clock = new THREE.Clock();
function processDirty(force) {
  if (dirty.composite) { dirty.composite = false; rebuildCompositeTexture(); dirty.pyramidTex = true; dirty.sidebarLive = true; world.s3.hospKey = ''; }
  if (dirty.tiles) { dirty.tiles = false; computeTileInfos(); applyTileStates(); refreshPinned(); dirty.sidebarLive = true; }
  if (dirty.tilesVisual) { dirty.tilesVisual = false; applyTileStates(); }
  if (dirty.bag) { dirty.bag = false; computeBag(); dirty.mil = true; }
  if (dirty.mil) { dirty.mil = false; computeMIL(); applyMILVisuals(); dirty.heat = true; dirty.sidebarLive = true; }
  if (dirty.umap) { dirty.umap = false; updateUmapTargets(); applyUmapColors(); dirty.sidebarLive = true; dirty.legend = true; }
  if (state.stage === 5 && dirty.heat) { dirty.heat = false; computeHeatField(); }
  if (state.stage === 5 && dirty.heatColor) { colorizeHeat(); applyHeatVisibility(); }
  if (state.stage === 5 && dirty.top3Thumbs) drawTop3Thumbs();
  if (state.stage === 1 && dirty.pyramidTex) refreshPyramidTextures();
  if (dirty.legend) { dirty.legend = false; updateLegend(); }
  if (dirty.sidebarLive) { dirty.sidebarLive = false; updateSidebarLive(); updateHUD(); updateBanner(); }
}
let liveTick = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  processDirty();
  stepCamTween(dt); controls.update();
  const n = state.stage;
  if (n === 1) animateStage1(dt, t);
  else if (n === 2) animateStage2(dt, t);
  else if (n === 3) { stepStage3(dt, t); liveTick += dt; if (liveTick > 0.12) { liveTick = 0; dirty.sidebarLive = true; } }
  else if (n === 4) animateStage4(dt, t);
  else if (n === 5) animateStage5(dt, t);
  if (hoverDirty || n === 2) { if (pointerIn) runHover(); hoverDirty = false; }
  renderer.render(scene, camera);
}
function initApp() {
  const host = $('#gl-host');
  try { initThree(host); } catch (err) { showFatal(err); return; }
  generateBaseModalityCanvas(state.modality, baseCanvas);
  rebuildCompositeTexture(); rebuildSlideLabelTexture();
  buildStage1(); buildStage2(); buildStage3(); buildStage4(); buildStage5();
  bindEvents(); bindQuiz();
  setStage(1, true);
  processDirty();
  resizeRenderer();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rebuildSlideLabelTexture(); dirty.sidebarLive = true; });
  animate();
  window.__pdia = { state, world, dirty, setState, setStage, processDirty, MODALITIES, evalTile, computeMIL, rocAt };   // utilidad de depuración
}
function bootApp() {
  try { initApp(); } catch (err) { showFatal(err); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootApp); else bootApp();
