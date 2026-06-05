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

async function generarBloque(funcion, nombreBloque, qas) {
  if (!qas.length) return null;

  const texto = qas
    .map(({ titulo, contenido }) => `P: ${titulo}\nR: ${contenido}`)
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Sos redactor de manuales de puesto para una empresa agropecuaria argentina.
A partir de las siguientes respuestas del ocupante del puesto de "${funcion}", redactá el bloque "${nombreBloque}" del manual de forma clara y profesional.
Escribí en primera persona, como si fuera el propio ocupante describiendo su trabajo.
Máximo 300 palabras. Sin títulos ni listas — solo prosa fluida.

Respuestas del ocupante:
${texto}`
    }],
    max_tokens: 600,
    temperature: 0.4
  });

  return response.choices[0].message.content.trim();
}

export async function generarManual(funcion, organizacionId, usuarioId, KnowledgeEntry) {
  const entries = await KnowledgeEntry.findAll({
    where: { funcion, organizacionId, usuarioId, categoria: 'checkin' },
    attributes: ['titulo', 'contenido', 'bloque']
  });

  // Group by bloque
  const grouped = {};
  for (const e of entries) {
    const b = e.bloque || 'B4';
    if (!grouped[b]) grouped[b] = [];
    grouped[b].push({ titulo: e.titulo, contenido: e.contenido });
  }

  // Also include entries without bloque under B4
  const contenido = {};
  await Promise.all(
    Object.entries(BLOQUES).map(async ([bloque, nombre]) => {
      const qas = grouped[bloque] || [];
      if (qas.length > 0) {
        contenido[bloque] = await generarBloque(funcion, nombre, qas);
      }
    })
  );

  return contenido;
}
