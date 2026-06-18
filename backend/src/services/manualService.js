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

// Regla de enmascarado para respuestas con datos sensibles (reutilizada en ambos prompts)
const REGLA_SENSIBLE = `Las respuestas marcadas [SENSIBLE] contienen datos confidenciales (usuarios, contraseñas, claves, números de cuenta o de documento). De esas respuestas incluí SOLO la información general no confidencial (nombre del sistema, herramienta o proceso) y reemplazá CUALQUIER credencial, usuario, contraseña, clave, PIN o número confidencial por "***". Nunca escribas una credencial real en el texto.`;

// Generates a block from scratch using all current entries for that block
async function generarBloqueNuevo(funcion, nombreBloque, allQas) {
  const texto = allQas
    .map(({ titulo, contenido, esSensible }) =>
      `${esSensible ? '[SENSIBLE] ' : ''}P: ${titulo}\nR: ${contenido}`)
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Sos redactor de manuales de puesto para una empresa agropecuaria argentina.
A partir de las siguientes respuestas del ocupante del puesto de "${funcion}", redactá el bloque "${nombreBloque}" del manual de forma clara y profesional.
El texto debe ser IMPERSONAL y descriptivo del puesto, en tercera persona. Nunca uses primera persona (nada de "mi", "yo", "me", "mis"). Ejemplo correcto: "El tesorero gestiona...", "El puesto requiere...", "Se espera que...".
Sin títulos ni listas — solo prosa fluida.
Cada respuesta corresponde a un aspecto distinto del puesto. Tratá cada una de forma independiente; no mezcles información entre respuestas.
${REGLA_SENSIBLE}
Separación numérica en español: punto para miles, coma para decimales (ej: 1.000 pesos, 10,5%).

Respuestas del ocupante:
${texto}`
    }],
    max_tokens: 1500,
    temperature: 0.3
  });

  return response.choices[0].message.content.trim();
}

// Applies minimum changes to an existing block.
// Receives ALL Q&As for the block, marking which ones changed, so GPT can anchor
// each changed entry to its corresponding prose fragment by semantic similarity.
async function actualizarBloqueMinimo(funcion, nombreBloque, existingText, newQas, allQas) {
  const changedTitles = new Set(newQas.map(q => q.titulo));
  const texto = allQas
    .map(({ titulo, contenido, esSensible }) => {
      const estado = changedTitles.has(titulo) ? '[MODIFICADA]' : '[SIN CAMBIOS]';
      const sens = esSensible ? ' [SENSIBLE]' : '';
      return `${estado}${sens} P: ${titulo}\nR: ${contenido}`;
    })
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Sos editor de manuales de puesto para una empresa agropecuaria argentina.
Tu única tarea es hacer la modificación MÍNIMA al texto existente para reflejar las respuestas marcadas como [MODIFICADA].

TEXTO ACTUAL DEL BLOQUE "${nombreBloque}" (puesto: ${funcion}):
${existingText}

TODAS LAS RESPUESTAS DEL BLOQUE (con su estado):
${texto}

REGLAS ESTRICTAS:
- Las respuestas [SIN CAMBIOS] sirven como contexto para identificar qué fragmentos del texto NO debés tocar. Dejá exactamente esos fragmentos intactos: misma redacción, misma puntuación, mismo orden.
- Para cada respuesta [MODIFICADA]: encontrá el fragmento del texto que habla de ESE tema y actualizalo con la nueva información. Si la respuesta eliminó información, eliminá esas oraciones. Si agregó información nueva, incorporala de forma mínima.
- Nunca mezcles contenido entre respuestas distintas.
- ${REGLA_SENSIBLE}
- Si en las oraciones que modificás hay lenguaje en primera persona ("mi", "yo", "me", "mis") → reescribí solo esas oraciones en tercera persona impersonal ("El ${funcion}...", "El puesto requiere..."). No toques las demás.
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
  return actualizarBloqueMinimo(funcion, nombreBloque, existingText, newQas, allQas);
}

export async function generarManual(funcion, organizacionId, KnowledgeEntry, currentManual) {
  // Incluye entradas sensibles (el hook afterFind las descifra); el prompt enmascara
  // las credenciales con *** pero conserva la info general (ej: nombre del sistema).
  const entries = await KnowledgeEntry.findAll({
    where: { funcion, organizacionId, categoria: 'checkin' },
    attributes: ['titulo', 'contenido', 'bloque', 'esSensible', 'createdAt', 'updatedAt'],
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
    allGrouped[b].push({ titulo: e.titulo, contenido: e.contenido, esSensible: e.esSensible });
    const isNew = !lastGeneratedAt
      || new Date(e.createdAt) > lastGeneratedAt
      || new Date(e.updatedAt) > lastGeneratedAt;
    if (isNew) {
      newGrouped[b].push({ titulo: e.titulo, contenido: e.contenido, esSensible: e.esSensible });
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
