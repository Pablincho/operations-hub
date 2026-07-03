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

const BLOQUE_NOMBRES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
};

export async function llamarAsistente(user, manuales, fallbackEntries, sensibleEntries, history, mensajeActual, ocupantes = []) {
  const funciones = user.funciones?.length
    ? user.funciones.map(f => FUNC_LABELS[f] || f).join(', ')
    : 'consultas generales';

  // Format vigente manuals as structured context
  const manualesText = manuales.map(m => {
    const bloques = Object.entries(BLOQUE_NOMBRES)
      .filter(([k]) => m.contenido?.[k])
      .map(([k, nombre]) => `${nombre}:\n${m.contenido[k]}`)
      .join('\n\n');
    return `=== Manual de ${m.funcion} (v${m.version}) ===\n${bloques}`;
  }).join('\n\n---\n\n');

  // Fallback raw entries for functions without a vigente manual
  const fallbackText = fallbackEntries.length
    ? '\n\n--- Respuestas en proceso (sin manual aprobado aún) ---\n\n' +
      fallbackEntries.map(e => `[${e.funcion}] ${e.titulo}:\n${e.contenido}`).join('\n\n')
    : '';

  // Sensitive entries: included in context, authorized to show, but response won't be persisted
  const sensibleText = sensibleEntries.length
    ? '\n\n--- Información sensible (credenciales y datos de acceso) ---\n' +
      'El usuario que consulta tiene autorización sobre estos datos y esta respuesta no se almacena. Si los solicita, mostrá el valor exacto tal como está registrado.\n\n' +
      sensibleEntries.map(e => `[${e.funcion}] ${e.titulo}:\n${e.contenido}`).join('\n\n')
    : '';

  const usedSensitive = sensibleEntries.length > 0;

  const contexto = (manualesText + fallbackText + sensibleText) || 'Sin información cargada todavía para estas funciones.';

  // Directorio de personas: nombre → puesto (funciones asignadas, o rol si no tiene funciones)
  const directorioLines = ocupantes
    .filter(o => o.nombre)
    .map(o => {
      const puestos = (o.funciones || []).length > 0
        ? o.funciones.join(', ')
        : o.rol === 'superadmin' ? 'Gerente General' : null;
      return puestos ? `- ${o.nombre} → ${puestos}` : null;
    })
    .filter(Boolean);

  const directorioSection = directorioLines.length > 0
    ? `\n\nDIRECTORIO DE PERSONAS (Don Emilio):\n${directorioLines.join('\n')}\nCuando menciones a alguna de estas personas en una respuesta, indicá entre paréntesis su función en la empresa (ej: "Danilo Marchisone (Gerente General)").`
    : '';

  const systemPrompt = `Sos el asistente operativo de Don Emilio, empresa agropecuaria argentina. Especializado en: ${funciones}.

BASE DE CONOCIMIENTO DISPONIBLE:
${contexto}${directorioSection}

REGLAS ESTRICTAS:
- Respondé EXCLUSIVAMENTE usando la base de conocimiento provista arriba.
- Si la respuesta no está en la base de conocimiento, respondé: "Esa información no está registrada todavía en el sistema."
- No inventes datos. Si un dato (bancario, contraseña, usuario, acceso) figura en la base de conocimiento, proporcionalo cuando te lo pidan; si no figura, no lo inventes.
- Sistema contable de la empresa: Albor.
- Si te preguntan por una función que no corresponde a este puesto, indicá que le corresponde a otro responsable.
- Usá siempre voz impersonal y tono institucional: "se debe", "corresponde", "el procedimiento indica", "está establecido que". NUNCA uses primera persona ("yo", "utilizo", "tengo", "ingreso") ni segunda persona directa ("vos", "te"). Aunque la base de conocimiento esté escrita en primera persona, reformulá siempre en tercera persona o voz impersonal. Escribí como un manual o reglamento interno.
- Separación numérica en español: punto para miles, coma para decimales (ej: 1.000 pesos, 10,5%).`;

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

  return { reply: response.choices[0].message.content, usedSensitive };
}

export async function generarPreguntasIA(funcion, prevAnswers, bloqueObjetivo = 'B4', crossAreaRefs = []) {
  const answeredCount = prevAnswers.length;
  const prevSummary = prevAnswers
    .slice(-5)
    .map(p => `"${p.pregunta}": "${(p.respuesta || '').slice(0, 60)}"`)
    .join(' | ');

  const nombreBloque = BLOQUE_NOMBRES[bloqueObjetivo] || bloqueObjetivo;

  const crossAreaSection = crossAreaRefs.length > 0
    ? `\n\nOtras áreas mencionan a ${funcion} en sus respuestas documentadas:
${crossAreaRefs.map(r => `[${r.funcion}] "${r.titulo}": "${(r.contenido || '').slice(0, 150)}"`).join('\n')}
Si alguna de estas menciones revela una interacción con ${funcion} que aún no quedó documentada en este puesto, podés incluir una pregunta que confirme o amplíe ese proceso desde la perspectiva de ${funcion}. De lo contrario, ignoralas.`
    : '';

  const prompt = `Sos un experto en procesos administrativos de empresas agropecuarias argentinas.
Tu tarea es generar exactamente 3 preguntas para documentar el puesto de "${funcion}" en Don Emilio.

Ya se documentaron ${answeredCount} respuestas sobre este puesto.
${prevSummary ? `Últimas respuestas: ${prevSummary}` : ''}

Enfocate en el bloque "${nombreBloque}" del manual de puesto.
Generá 3 preguntas concretas y operativas que profundicen ese bloque.${crossAreaSection}
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
