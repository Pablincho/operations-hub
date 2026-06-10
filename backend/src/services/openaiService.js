import OpenAI from 'openai';

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const FUNC_LABELS = {
  'Tesorería': 'Tesorería (pagos, conciliación, caja chica, homebanking)',
  'Administración y Finanzas': 'Administración y Finanzas (gestión contable, facturación, reportes financieros)',
  'Operaciones Agropecuarias': 'Operaciones Agropecuarias (producción, campo, insumos, logística)',
  'Impositivo': 'Impositivo (presentaciones AFIP, vencimientos, VEP, Interbanking)',
  'Administrativo Junior': 'Administrativo Junior (soporte administrativo, archivo, gestión documental)',
  'RRHH': 'RRHH (liquidación de sueldos, legajos, incorporaciones, capacitación)',
  'Administrativo El Coro': 'Administrativo El Coro (administración local, operaciones de la sucursal El Coro)'
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

  const systemPrompt = `Sos el asistente operativo de Don Emilio, empresa agropecuaria argentina. Especializado en: ${funciones}.

BASE DE CONOCIMIENTO DISPONIBLE:
${entriesText || 'Sin información cargada todavía para estas funciones.'}

REGLAS ESTRICTAS:
- Respondé EXCLUSIVAMENTE usando la base de conocimiento provista arriba.
- Si la respuesta no está en la base de conocimiento, respondé: "Esa información no está registrada todavía en el sistema."
- No inventes datos, especialmente bancarios, contraseñas, usuarios o accesos.
- Sistema contable de la empresa: Albor.
- Si te preguntan por una función que no corresponde a este puesto, indicá que le corresponde a otro responsable.
- Usá siempre voz impersonal y tono institucional: "se debe", "corresponde", "el procedimiento indica", "está establecido que". Nunca uses primera persona ("yo") ni segunda persona directa ("vos", "te"). Escribí como un manual o reglamento interno.`;

  // Build messages array from history, excluding the last message (current user message)
  // since we'll use the full history minus duplicate
  const historyMessages = history
    .slice(0, -1) // exclude the last saved message (which is the current one)
    .map(m => ({ role: m.rol, content: m.contenido }));

  historyMessages.push({ role: 'user', content: mensajeActual });

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
    max_tokens: 1000,
    temperature: 0.3
  });

  return response.choices[0].message.content;
}

const BLOQUE_NOMBRES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
};

export async function generarPreguntasIA(funcion, prevAnswers, bloqueObjetivo = 'B4') {
  const answeredCount = prevAnswers.length;
  const prevSummary = prevAnswers
    .slice(-5)
    .map(p => `"${p.pregunta}": "${(p.respuesta || '').slice(0, 60)}"`)
    .join(' | ');

  const nombreBloque = BLOQUE_NOMBRES[bloqueObjetivo] || bloqueObjetivo;

  const prompt = `Sos un experto en procesos administrativos de empresas agropecuarias argentinas.
Tu tarea es generar exactamente 3 preguntas para documentar el puesto de "${funcion}" en Don Emilio.

Ya se documentaron ${answeredCount} respuestas sobre este puesto.
${prevSummary ? `Últimas respuestas: ${prevSummary}` : ''}

Enfocate en el bloque "${nombreBloque}" del manual de puesto.
Generá 3 preguntas concretas y operativas que profundicen ese bloque.
Devolvé SOLO un JSON: {"questions":[{"pregunta":"...","bloque":"${bloqueObjetivo}"},{"pregunta":"...","bloque":"${bloqueObjetivo}"},{"pregunta":"...","bloque":"${bloqueObjetivo}"}]}`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return parsed.questions || [];
}
