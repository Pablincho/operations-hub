import OpenAI from 'openai';

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const BLOQUES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
};

// Generates a block from scratch using all current entries for that block
async function generarBloqueNuevo(funcion, nombreBloque, allQas) {
  const texto = allQas
    .map(({ titulo, contenido }) => `P: ${titulo}\nR: ${contenido}`)
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Sos redactor de manuales de puesto para una empresa agropecuaria argentina.
A partir de las siguientes respuestas del ocupante del puesto de "${funcion}", redactá el bloque "${nombreBloque}" del manual de forma clara y profesional.
Escribí en primera persona, como si fuera el propio ocupante describiendo su trabajo.
Sin títulos ni listas — solo prosa fluida.
Separación numérica en español: punto para miles, coma para decimales (ej: 1.000 pesos, 10,5%).

Respuestas del ocupante:
${texto}`
    }],
    max_tokens: 1500,
    temperature: 0.3
  });

  return response.choices[0].message.content.trim();
}

// Applies minimum changes to an existing block based only on the updated entries.
async function actualizarBloqueMinimo(funcion, nombreBloque, existingText, newQas) {
  const texto = newQas
    .map(({ titulo, contenido }) => `P: ${titulo}\nR: ${contenido}`)
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Sos editor de manuales de puesto para una empresa agropecuaria argentina.
Tu única tarea es hacer la modificación MÍNIMA al texto existente para reflejar los datos actualizados.

TEXTO ACTUAL DEL BLOQUE "${nombreBloque}" (puesto: ${funcion}):
${existingText}

DATOS ACTUALIZADOS:
${texto}

REGLAS ESTRICTAS:
- Modificá ÚNICAMENTE las oraciones directamente relacionadas con los datos actualizados.
- Conservá el resto del texto exactamente igual: misma redacción, misma puntuación, mismo formato numérico.
- Si los datos actualizados eliminan información → removela del texto sin tocar lo demás.
- Si los datos actualizados agregan información nueva → incorporala de forma mínima.
- Devolvé el texto completo con los cambios mínimos y nada más.`
    }],
    max_tokens: 1500,
    temperature: 0.1
  });

  return response.choices[0].message.content.trim();
}

// No new entries → keep verbatim. New entries on existing block → minimal update.
// New block → full generation from scratch.
async function generarBloque(funcion, nombreBloque, existingText, newQas, allQas) {
  if (existingText && newQas.length === 0) return existingText;
  if (!existingText) return generarBloqueNuevo(funcion, nombreBloque, allQas);
  return actualizarBloqueMinimo(funcion, nombreBloque, existingText, newQas);
}

export async function generarManual(funcion, organizacionId, KnowledgeEntry, currentManual) {
  const entries = await KnowledgeEntry.findAll({
    where: { funcion, organizacionId, categoria: 'checkin', esSensible: false },
    attributes: ['titulo', 'contenido', 'bloque', 'createdAt', 'updatedAt'],
    order: [['createdAt', 'ASC']]
  });

  const lastGeneratedAt = currentManual?.generadoEn ? new Date(currentManual.generadoEn) : null;
  const existingContenido = currentManual?.contenido || {};

  const allGrouped = {};
  const newGrouped = {};
  for (const e of entries) {
    const b = e.bloque || 'B4';
    if (!allGrouped[b]) allGrouped[b] = [];
    if (!newGrouped[b]) newGrouped[b] = [];
    allGrouped[b].push({ titulo: e.titulo, contenido: e.contenido });
    const isNew = !lastGeneratedAt
      || new Date(e.createdAt) > lastGeneratedAt
      || new Date(e.updatedAt) > lastGeneratedAt;
    if (isNew) {
      newGrouped[b].push({ titulo: e.titulo, contenido: e.contenido });
    }
  }

  const contenido = {};
  await Promise.all(
    Object.entries(BLOQUES).map(async ([bloque, nombre]) => {
      const allQas = allGrouped[bloque] || [];
      if (allQas.length === 0) return;
      const newQas = newGrouped[bloque] || [];
      const existingText = existingContenido[bloque] || null;
      contenido[bloque] = await generarBloque(funcion, nombre, existingText, newQas, allQas);
    })
  );

  // Verificador: warn if a block had detected changes but produced identical output
  const bloquesConCambiosSinDiferencia = Object.keys(BLOQUES).filter(bloque => {
    const hayCambios = (newGrouped[bloque] || []).length > 0;
    const mismoTexto = contenido[bloque] && existingContenido[bloque]
      && contenido[bloque] === existingContenido[bloque];
    return hayCambios && mismoTexto;
  });

  if (bloquesConCambiosSinDiferencia.length > 0) {
    console.warn('⚠️ Bloques con cambios detectados pero texto idéntico al anterior:', bloquesConCambiosSinDiferencia);
  }

  return contenido;
}
