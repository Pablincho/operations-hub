import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendRecoveryEmail(toEmail, code) {
  await resend.emails.send({
    from: 'Don Emilio <donemilio@email.tropabot.com>',
    to: toEmail,
    subject: 'Código de recuperación de contraseña',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px">
        <img src="https://res.cloudinary.com/dmigevwah/image/upload/v1777495745/don_emilio/don_emilio_logo.svg" alt="Don Emilio" style="height:48px;width:auto;margin-bottom:24px;display:block" />
        <p style="color:#555;margin-bottom:24px">Administración Operativa</p>
        <p style="color:#222">Recibimos una solicitud para restablecer tu contraseña. Usá el siguiente código:</p>
        <div style="background:#f5f5f0;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a3a1a">${code}</span>
        </div>
        <p style="color:#555;font-size:14px">Este código es válido por <strong>15 minutos</strong>.</p>
        <p style="color:#999;font-size:12px;margin-top:32px">Si no solicitaste este código, ignorá este mensaje. Tu contraseña no será modificada.</p>
      </div>
    `
  });
}
