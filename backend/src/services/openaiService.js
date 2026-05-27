import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FUNC_LABELS = {
  Tesorería: 'Tesorería (pagos, conciliación, caja chica, homebanking)',
  Impuestos: 'Impuestos (presentaciones AFIP, vencimientos, VEP, Interbanking)',
  Sueldos: 'Sueldos (liquidación, F931, SIPA, cargas sociales)',
  Autorizaciones: 'Autorizaciones (aprobación de pagos, control de facturas)'
};

export async function llamarAsistente(user, knowledgeEntries, history, mensajeActual) {
  const funciones = user.funciones?.length
    ? user.funciones.map(f => FUNC_LABELS[f] || f).join(', ')
    : 'consultas generales';

  const entriesText = knowledgeEntries
    .map(e => {
      const sensibleTag = e.esSensible ? ' [ACCESO RESTRINGIDO]' : '';
      return `[${e.funcion}${sensibleTag}] ${e.titulo}:\n${e.contenido}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `Sos el asistente operativo de Don Emilio, empresa agropecuaria argentina. Especializado en: ${funciones}. Respondés en español rioplatense, de forma directa y práctica.

BASE DE CONOCIMIENTO DISPONIBLE:
${entriesText || 'Sin información cargada todavía para estas funciones.'}

REGLAS ESTRICTAS:
- Respondé EXCLUSIVAMENTE usando la base de conocimiento provista arriba.
- Si la respuesta no está en la base de conocimiento, decí: "Esa información no está cargada todavía. Te sugiero agregarla en Mi Área para que quede disponible."
- No inventes datos, especialmente bancarios, contraseñas, usuarios o accesos.
- Sistema contable de la empresa: Albor.
- Si te preguntan por otra función que no es la tuya, decí que lo maneja otro responsable.`;

  // Build messages array from history, excluding the last message (current user message)
  // since we'll use the full history minus duplicate
  const historyMessages = history
    .slice(0, -1) // exclude the last saved message (which is the current one)
    .map(m => ({ role: m.rol, content: m.contenido }));

  historyMessages.push({ role: 'user', content: mensajeActual });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
    max_tokens: 1000,
    temperature: 0.3
  });

  return response.choices[0].message.content;
}

export async function generarPreguntasIA(funcion, prevAnswers) {
  const answeredCount = prevAnswers.length;
  const prevSummary = prevAnswers
    .slice(-5)
    .map(p => `"${p.pregunta}": "${(p.respuesta || '').slice(0, 60)}"`)
    .join(' | ');

  const prompt = `Sos un experto en procesos administrativos de empresas agropecuarias argentinas.
Tu tarea es generar exactamente 3 preguntas para documentar el puesto de "${funcion}" en Don Emilio / GTF.

Ya se documentaron ${answeredCount} respuestas sobre este puesto.
${prevSummary ? `Últimas respuestas: ${prevSummary}` : ''}

Generá 3 preguntas concretas y operativas. Priorizá temas no cubiertos o profundizá donde las respuestas son escasas.
Cubrí procedimientos paso a paso, datos de acceso (usuarios/contraseñas de sistemas), cuentas bancarias, vencimientos y decisiones del día a día.
Devolvé SOLO un JSON: {"questions":["pregunta1","pregunta2","pregunta3"]}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return parsed.questions || [];
}
