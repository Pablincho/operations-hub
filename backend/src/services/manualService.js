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

async function generarBloque(funcion, nombreBloque, existingText, newQas, allQas) {
  let content;

  if (existingText && newQas.length > 0) {
    // Incremental: preserve existing text, incorporate only new Q&As
    const nuevasTexto = newQas
      .map(({ titulo, contenido }) => `P: ${titulo}\nR: ${contenido}`)
      .join('\n\n');

    content = `Sos redactor de manuales de puesto para una empresa agropecuaria argentina.

Tenés el texto actual del bloque "${nombreBloque}" del manual del puesto "${funcion}":

[TEXTO ACTUAL]
${existingText}
[FIN TEXTO ACTUAL]

El ocupante registró las siguientes respuestas nuevas que deben incorporarse:

[NUEVAS RESPUESTAS]
${nuevasTexto}
[FIN NUEVAS RESPUESTAS]

Actualizá el texto incorporando la información nueva. Conservá el texto existente tanto como sea posible — solo modificá o agregá lo estrictamente necesario para integrar coherentemente la información nueva. Si la nueva información no cambia el sentido de algo ya escrito, no lo reformules.
Escribí en primera persona. Sin títulos ni listas — solo prosa fluida.`;
  } else {
    // First generation — generate from scratch
    const qas = allQas.length > 0 ? allQas : newQas;
    const texto = qas
      .map(({ titulo, contenido }) => `P: ${titulo}\nR: ${contenido}`)
      .join('\n\n');

    content = `Sos redactor de manuales de puesto para una empresa agropecuaria argentina.
A partir de las siguientes respuestas del ocupante del puesto de "${funcion}", redactá el bloque "${nombreBloque}" del manual de forma clara y profesional.
Escribí en primera persona, como si fuera el propio ocupante describiendo su trabajo.
Sin títulos ni listas — solo prosa fluida.

Respuestas del ocupante:
${texto}`;
  }

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    max_tokens: 1500,
    temperature: 0.3
  });

  return response.choices[0].message.content.trim();
}

export async function generarManual(funcion, organizacionId, usuarioId, KnowledgeEntry, currentManual) {
  const entries = await KnowledgeEntry.findAll({
    where: { funcion, organizacionId, usuarioId, categoria: 'checkin' },
    attributes: ['titulo', 'contenido', 'bloque', 'createdAt'],
    order: [['createdAt', 'ASC']]
  });

  const lastGeneratedAt = currentManual?.generadoEn ? new Date(currentManual.generadoEn) : null;
  const existingContenido = currentManual?.contenido || {};

  // Group entries by bloque — all vs new (created after last generation)
  const allGrouped = {};
  const newGrouped = {};
  for (const e of entries) {
    const b = e.bloque || 'B4';
    if (!allGrouped[b]) allGrouped[b] = [];
    if (!newGrouped[b]) newGrouped[b] = [];
    allGrouped[b].push({ titulo: e.titulo, contenido: e.contenido });
    if (!lastGeneratedAt || new Date(e.createdAt) > lastGeneratedAt) {
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
