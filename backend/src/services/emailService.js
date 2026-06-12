import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Don Emilio <donemilio@email.tropabot.com>';
const LOGO = 'https://res.cloudinary.com/dmigevwah/image/upload/v1777495745/don_emilio/don_emilio_logo.svg';

function baseHtml(content) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <img src="${LOGO}" alt="Don Emilio" style="height:48px;width:auto;margin-bottom:24px;display:block" />
      ${content}
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px" />
      <p style="color:#999;font-size:11px;margin-top:12px">REMI — Registro de Experiencia y Memoria Institucional · Don Emilio</p>
    </div>
  `;
}

export async function sendBienvenidaEmail(toEmail, nombre, tempPassword) {
  const url = `${process.env.FRONTEND_URL}/login`;
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Bienvenido a REMI — Don Emilio',
    html: baseHtml(`
      <p style="color:#222;font-size:15px;font-weight:600;margin-bottom:8px">¡Bienvenido a REMI, ${nombre}!</p>
      <p style="color:#555">Se creó tu acceso al sistema de Registro de Experiencia y Memoria Institucional de Don Emilio.</p>
      <div style="background:#f5f5f0;border-radius:8px;padding:20px;margin:24px 0">
        <p style="color:#333;font-size:13px;margin:0 0 6px 0">Tus credenciales de acceso:</p>
        <p style="color:#333;font-size:13px;margin:0"><strong>Email:</strong> ${toEmail}</p>
        <p style="color:#333;font-size:13px;margin:4px 0 0 0"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
      </div>
      <p style="color:#555;font-size:13px">Al ingresar por primera vez deberás cambiar tu contraseña.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${url}" style="background:#1a3a1a;color:#e8d5a3;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Ingresar a REMI →</a>
      </div>
      <p style="color:#999;font-size:11px;margin-top:8px">Si no esperabas este mensaje, ignoralo.</p>
    `)
  });
}

export async function sendRecoveryEmail(toEmail, code) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Código de recuperación de contraseña',
    html: baseHtml(`
      <p style="color:#555;margin-bottom:24px">Administración Operativa</p>
      <p style="color:#222">Recibimos una solicitud para restablecer tu contraseña. Usá el siguiente código:</p>
      <div style="background:#f5f5f0;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a3a1a">${code}</span>
      </div>
      <p style="color:#555;font-size:14px">Este código es válido por <strong>15 minutos</strong>.</p>
      <p style="color:#999;font-size:12px;margin-top:16px">Si no solicitaste este código, ignorá este mensaje.</p>
    `)
  });
}

export async function sendManualEnviadoEmail(toEmail, ocupanteNombre, funcion, nota) {
  const url = `${process.env.FRONTEND_URL}/revisiones`;
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Manual de ${funcion} enviado a revisión`,
    html: baseHtml(`
      <p style="color:#222;font-size:15px;font-weight:600;margin-bottom:8px">Manual de puesto enviado a revisión</p>
      <p style="color:#555"><strong>${ocupanteNombre}</strong> envió el manual de <strong>${funcion}</strong> para tu revisión.</p>
      ${nota ? `<div style="background:#f5f5f0;border-radius:8px;padding:16px;margin:20px 0"><p style="color:#333;font-size:13px;margin:0"><em>"${nota}"</em></p></div>` : ''}
      <div style="text-align:center;margin:28px 0">
        <a href="${url}" style="background:#1a3a1a;color:#e8d5a3;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Ir a Revisiones →</a>
      </div>
    `)
  });
}

export async function sendManualAprobadoEmail(toEmail, funcion, aprobadorNombre) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Tu manual de ${funcion} fue aprobado`,
    html: baseHtml(`
      <p style="color:#222;font-size:15px;font-weight:600;margin-bottom:8px">Manual aprobado</p>
      <p style="color:#555">Tu manual de <strong>${funcion}</strong> fue aprobado por <strong>${aprobadorNombre}</strong> y ahora está vigente.</p>
      <div style="background:#f0faf4;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #2d7a4f">
        <p style="color:#2d7a4f;font-weight:600;margin:0">Estado: Vigente</p>
      </div>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/manual" style="background:#1a3a1a;color:#e8d5a3;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Ver manual aprobado →</a>
      </div>
    `)
  });
}

export async function sendRecordatorioEmail(toEmail, nombre, funcion, dias) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Recordatorio: continuá documentando tu puesto de ${funcion}`,
    html: baseHtml(`
      <p style="color:#222;font-size:15px;font-weight:600;margin-bottom:8px">Tenés documentación pendiente</p>
      <p style="color:#555">Hace <strong>${dias} día${dias !== 1 ? 's' : ''}</strong> que no registrás actividad en la documentación de <strong>${funcion}</strong>.</p>
      <p style="color:#555;font-size:13px">Cada sesión son solo 3 preguntas y demanda unos minutos. Tu conocimiento es clave para la organización.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/manual" style="background:#1a3a1a;color:#e8d5a3;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Continuar documentación →</a>
      </div>
    `)
  });
}

export async function sendRecordatorioSupervisorEmail(toEmail, supervisorNombre, ocupanteNombre, funcion, dias) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `El manual de ${funcion} lleva ${dias} días sin actividad`,
    html: baseHtml(`
      <p style="color:#222;font-size:15px;font-weight:600;margin-bottom:8px">Manual sin actividad</p>
      <p style="color:#555"><strong>${ocupanteNombre}</strong> lleva <strong>${dias} días</strong> sin registrar actividad en la documentación de <strong>${funcion}</strong>.</p>
      <p style="color:#555;font-size:13px">Podés recordarle directamente o revisar el avance desde el panel de administración.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/admin" style="background:#1a3a1a;color:#e8d5a3;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Ver panel de administración →</a>
      </div>
    `)
  });
}

export async function sendManualDevueltoEmail(toEmail, funcion, observaciones) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Tu manual de ${funcion} requiere correcciones`,
    html: baseHtml(`
      <p style="color:#222;font-size:15px;font-weight:600;margin-bottom:8px">Manual devuelto para correcciones</p>
      <p style="color:#555">Tu manual de <strong>${funcion}</strong> fue devuelto con las siguientes observaciones:</p>
      <div style="background:#fff8f0;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #c07a2d">
        <p style="color:#333;font-size:13px;margin:0">${observaciones}</p>
      </div>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/manual" style="background:#1a3a1a;color:#e8d5a3;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Ir a Mi Manual →</a>
      </div>
    `)
  });
}
