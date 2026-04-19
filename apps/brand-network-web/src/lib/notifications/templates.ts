export interface AppointmentContext {
  customerFirstName: string;
  guardianFirstName: string;
  boutiqueName: string;
  appointmentDate: string;
  appointmentTime: string;
  confirmationCode: string;
  boutiqueAddress: string;
  boutiquePhone: string;
}

export interface ReservationContext {
  customerFirstName: string;
  guardianFirstName: string;
  boutiqueName: string;
  dressName: string;
  designerName: string;
  colorName: string;
  size: string;
  price: string;
  reservationExpiresAt: string;
}

export interface GuardianPortalContext {
  guardianFirstName: string;
  customerFirstName: string;
  portalUrl: string;
  expiresAt: string;
}

// ─── APPOINTMENT CONFIRMATION ─────────────────────────────────────────────────

export function appointmentConfirmationEmail(ctx: AppointmentContext): { subject: string; html: string; text: string } {
  return {
    subject: `Appointment Confirmed — ${ctx.customerFirstName} at ${ctx.boutiqueName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0A0E; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem 1.5rem; }
    .brand { color: #C9A96E; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2rem; }
    .heading { color: #F8F4F0; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
    .body { color: rgba(248,244,240,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
    .detail-label { color: rgba(248,244,240,0.5); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
    .detail-value { color: #F8F4F0; font-size: 1rem; font-weight: 600; margin-top: 0.25rem; margin-bottom: 1rem; }
    .code { color: #F24B9A; font-family: monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.1em; }
    .footer { color: rgba(248,244,240,0.35); font-size: 0.75rem; margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <p class="brand">TOP 10 PROM · GUARDIAN NOTIFICATION</p>
    <h1 class="heading">Appointment Confirmed</h1>
    <p class="body">Hi ${ctx.guardianFirstName}, this is a confirmation that ${ctx.customerFirstName}'s styling appointment has been booked at ${ctx.boutiqueName}.</p>
    <div class="card">
      <p class="detail-label">Confirmation Code</p>
      <p class="code">${ctx.confirmationCode}</p>
      <p class="detail-label">Date</p>
      <p class="detail-value">${ctx.appointmentDate}</p>
      <p class="detail-label">Time</p>
      <p class="detail-value">${ctx.appointmentTime}</p>
      <p class="detail-label">Location</p>
      <p class="detail-value">${ctx.boutiqueName}<br><span style="font-weight:400;color:rgba(248,244,240,0.7)">${ctx.boutiqueAddress}</span></p>
      <p class="detail-label">Questions?</p>
      <p class="detail-value">${ctx.boutiquePhone}</p>
    </div>
    <p class="body">Please save this confirmation code. If plans change, ${ctx.customerFirstName} can reschedule through her account or by calling us directly.</p>
    <div class="footer">
      <p>You're receiving this because you're listed as a guardian for ${ctx.customerFirstName}'s Top 10 Prom account. If this is incorrect, please contact us at support@toptenprom.com.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `TOP 10 PROM — APPOINTMENT CONFIRMED\n\nHi ${ctx.guardianFirstName},\n\n${ctx.customerFirstName}'s appointment is confirmed.\n\nConfirmation: ${ctx.confirmationCode}\nDate: ${ctx.appointmentDate}\nTime: ${ctx.appointmentTime}\nLocation: ${ctx.boutiqueName}, ${ctx.boutiqueAddress}\nPhone: ${ctx.boutiquePhone}\n\nTop 10 Prom`,
  };
}

export function appointmentConfirmationSMS(ctx: AppointmentContext): string {
  return `TOP 10 PROM: Hi ${ctx.guardianFirstName}! ${ctx.customerFirstName}'s appointment is confirmed for ${ctx.appointmentDate} at ${ctx.appointmentTime} at ${ctx.boutiqueName}. Confirmation: ${ctx.confirmationCode}. Questions? Call ${ctx.boutiquePhone}.`;
}

// ─── DRESS RESERVATION CREATED ────────────────────────────────────────────────

export function reservationCreatedEmail(ctx: ReservationContext): { subject: string; html: string; text: string } {
  return {
    subject: `Dress Reserved — ${ctx.dressName} for ${ctx.customerFirstName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dress Reserved</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0A0E; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem 1.5rem; }
    .brand { color: #C9A96E; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2rem; }
    .heading { color: #F8F4F0; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
    .body { color: rgba(248,244,240,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
    .detail-label { color: rgba(248,244,240,0.5); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
    .detail-value { color: #F8F4F0; font-size: 1rem; font-weight: 600; margin-top: 0.25rem; margin-bottom: 1rem; }
    .accent { color: #F24B9A; }
    .footer { color: rgba(248,244,240,0.35); font-size: 0.75rem; margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <p class="brand">TOP 10 PROM · GUARDIAN NOTIFICATION</p>
    <h1 class="heading">Dress Reserved</h1>
    <p class="body">Hi ${ctx.guardianFirstName}, ${ctx.customerFirstName} has reserved a dress at ${ctx.boutiqueName}. This dress will be held exclusively for her — no other customer at this boutique can reserve it in the same color and size.</p>
    <div class="card">
      <p class="detail-label">Dress</p>
      <p class="detail-value">${ctx.dressName}</p>
      <p class="detail-label">Designer</p>
      <p class="detail-value">${ctx.designerName}</p>
      <p class="detail-label">Color · Size</p>
      <p class="detail-value">${ctx.colorName} · Size ${ctx.size}</p>
      <p class="detail-label">Price</p>
      <p class="detail-value accent">$${ctx.price}</p>
      <p class="detail-label">Reservation Expires</p>
      <p class="detail-value">${ctx.reservationExpiresAt}</p>
    </div>
    <p class="body">The reservation holds the dress but does not constitute a purchase. ${ctx.customerFirstName} must complete the purchase before the expiration date to secure the dress.</p>
    <div class="footer">
      <p>You're receiving this because you're listed as a guardian for ${ctx.customerFirstName}'s Top 10 Prom account.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `TOP 10 PROM — DRESS RESERVED\n\nHi ${ctx.guardianFirstName},\n\n${ctx.customerFirstName} reserved: ${ctx.dressName} by ${ctx.designerName} (${ctx.colorName}, Size ${ctx.size}) at ${ctx.boutiqueName}.\n\nPrice: $${ctx.price}\nExpires: ${ctx.reservationExpiresAt}\n\nTop 10 Prom`,
  };
}

export function reservationCreatedSMS(ctx: ReservationContext): string {
  return `TOP 10 PROM: ${ctx.customerFirstName} reserved the ${ctx.dressName} (${ctx.colorName}, Size ${ctx.size}) at ${ctx.boutiqueName} for $${ctx.price}. Reservation expires ${ctx.reservationExpiresAt}.`;
}

// ─── GUARDIAN PORTAL INVITE ───────────────────────────────────────────────────

export function guardianPortalInviteEmail(ctx: GuardianPortalContext): { subject: string; html: string; text: string } {
  return {
    subject: `View ${ctx.customerFirstName}'s Dress Shortlist — Top 10 Prom`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guardian Portal Access</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0A0E; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem 1.5rem; }
    .brand { color: #C9A96E; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2rem; }
    .heading { color: #F8F4F0; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
    .body { color: rgba(248,244,240,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn { display: inline-block; background: #F24B9A; color: #0B0A0E; text-decoration: none; font-weight: 700; padding: 1rem 2.5rem; border-radius: 9999px; font-size: 1rem; letter-spacing: 0.05em; margin: 1.5rem 0; }
    .note { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; color: rgba(248,244,240,0.6); font-size: 0.875rem; line-height: 1.5; }
    .footer { color: rgba(248,244,240,0.35); font-size: 0.75rem; margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <p class="brand">TOP 10 PROM · GUARDIAN PORTAL</p>
    <h1 class="heading">See ${ctx.customerFirstName}'s Shortlist</h1>
    <p class="body">Hi ${ctx.guardianFirstName}, ${ctx.customerFirstName} has shared access to her dress shortlist and reservation details with you. Click the link below to view her selections.</p>
    <a href="${ctx.portalUrl}" class="btn">View Shortlist</a>
    <div class="note">
      <strong style="color:#F8F4F0">Important:</strong> This link is for your eyes only and expires in ${ctx.expiresAt}. It is read-only — no purchases or changes can be made through this link.
    </div>
    <div class="footer">
      <p>You're receiving this because ${ctx.customerFirstName} shared her Top 10 Prom shortlist with you. If you didn't expect this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `TOP 10 PROM — GUARDIAN PORTAL ACCESS\n\nHi ${ctx.guardianFirstName},\n\n${ctx.customerFirstName} has shared her dress shortlist with you.\n\nView it here (expires in ${ctx.expiresAt}):\n${ctx.portalUrl}\n\nThis link is read-only.\n\nTop 10 Prom`,
  };
}
