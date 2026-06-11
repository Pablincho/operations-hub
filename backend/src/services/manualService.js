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

// Agent 1 — extracts atomic facts from new Q&As
async function extractFacts(funcion, newQas) {
  const texto = newQas
    .map(({ titulo, contenido }) => `P: ${titulo}\nR: ${contenido}`)
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `A partir de las siguientes respuestas sobre el puesto "${funcion}", extraé una lista de hechos concretos y específicos que deben incorporarse a un manual de puesto. Eliminá relleno conversacional y quedáte solo con la información operativa relevante.
Devolvé SOLO un JSON: {"hechos": ["hecho concreto 1", "hecho concreto 2", ...]}

Respuestas:
${texto}`
    }],
    max_tokens: 500,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return parsed.hechos || [];
}

// Agent 2 — plans surgical changes: modify a specific sentence or append new text
async function planChanges(funcion, nombreBloque, existingText, hechos) {
  const hechosTexto = hechos.map((h, i) => `${i + 1}. ${h}`).join('\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Sos editor de manuales de puesto para una empresa agropecuaria argentina.

Texto actual del bloque "${nombreBloque}" del puesto "${funcion}":
[TEXTO ACTUAL]
${existingText}
[FIN TEXTO ACTUAL]

Nuevos hechos a incorporar:
${hechosTexto}

Para cada hecho decidí la acción mínima necesaria:
- Si el hecho expande o corrige algo ya mencionado en el texto: usá "modify" con la frase EXACTA (copiada textualmente del texto actual) y su reemplazo.
- Si el hecho es completamente nuevo y no tiene relación directa con ninguna frase existente: usá "append" con el texto nuevo redactado en primera persona, prosa fluida.

REGLA CRÍTICA: en "original" copiá la frase textualmente como aparece en el texto actual, sin cambiar ninguna palabra ni puntuación.
Usá separación numérica en español: punto para miles, coma para decimales (ej: 1.000 pesos, 10,5%).

Devolvé SOLO un JSON:
{
  "changes": [
    {"type": "modify", "original": "frase textual del texto actual", "replacement": "frase expandida o corregida"},
    {"type": "append", "text": "nuevo párrafo u oración a agregar al final"}
  ]
}`
    }],
    max_tokens: 1200,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return parsed.changes || [];
}

// Backend applies the plan — GPT never touches the full existing text in write mode
function applyChanges(existingText, changes) {
  let result = existingText;
  const appends = [];

  for (const change of changes) {
    if (change.type === 'modify' && change.original && change.replacement) {
      if (result.includes(change.original)) {
        result = result.replace(change.original, change.replacement);
      } else {
        // Original not found exactly — degrade to append to avoid data loss
        appends.push(change.replacement);
      }
    } else if (change.type === 'append' && change.text) {
      appends.push(change.text);
    }
  }

  if (appends.length > 0) {
    result = result.trimEnd() + '\n\n' + appends.join('\n\n');
  }

  return result;
}

// First generation — from scratch
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

async function generarBloque(funcion, nombreBloque, existingText, newQas, allQas) {
  if (existingText) {
    // Block already exists — only touch it if there are new/edited entries for this block
    if (newQas.length === 0) return existingText;

    // Agentic flow: extract facts → plan surgical changes → apply in code
    const hechos = await extractFacts(funcion, newQas);
    if (!hechos.length) return existingText;

    const changes = await planChanges(funcion, nombreBloque, existingText, hechos);
    if (!changes.length) return existingText;

    return applyChanges(existingText, changes);
  }

  // First generation — no existing text for this block
  return generarBloqueNuevo(funcion, nombreBloque, allQas);
}

export async function generarManual(funcion, organizacionId, usuarioId, KnowledgeEntry, currentManual) {
  const entries = await KnowledgeEntry.findAll({
    where: { funcion, organizacionId, usuarioId, categoria: 'checkin' },
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

  return contenido;
}
