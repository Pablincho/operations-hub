import OpenAI from 'openai';

const KEYWORDS = [
  'contraseña', 'password', 'clave', 'token', 'usuario', 'user', 'pass',
  'login', 'pin', 'credencial', 'api key', 'api_key', 'secret',
  'cbu', 'homebanking', 'clave fiscal', 'jwt', 'auth', 'acceso al sistema',
  'usuario y contraseña', 'clave de acceso', 'clave bancaria'
];

export function detectByKeyword(titulo, contenido) {
  const text = `${titulo} ${contenido}`.toLowerCase();
  return KEYWORDS.some(kw => text.includes(kw));
}

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function detectByAI(titulo, contenido) {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `¿El siguiente texto contiene contraseñas, credenciales de acceso, usuarios de sistema, tokens, claves bancarias u otro dato que debería guardarse de forma segura? Respondé solo "si" o "no".\n\nTítulo: ${titulo}\nContenido: ${contenido}`
      }],
      max_tokens: 5,
      temperature: 0
    });
    return response.choices[0].message.content.trim().toLowerCase().startsWith('si');
  } catch {
    return false;
  }
}

export async function detectSensitive(titulo, contenido) {
  if (detectByKeyword(titulo, contenido)) return true;
  return detectByAI(titulo, contenido);
}
