// Correos de los avisos: confirmación (doble opt-in) y aviso de reposición. Se envían con Resend.

export type Lang = 'es' | 'en';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface RestockItem {
  name: string;
  shop: string;
  url: string;
  price: number | null;
  image: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number | null, lang: Lang) =>
  n == null ? '' : new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(n);

function layout(body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#15171c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6eb;border-radius:12px">
<tr><td style="padding:24px 28px 8px;font-size:20px;font-weight:bold">PullRadar</td></tr>
<tr><td style="padding:8px 28px 24px;font-size:15px;line-height:1.55">${body}</td></tr>
</table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:#5f6672;margin:14px auto 0">${footer}</p>
</td></tr></table></body></html>`;
}

const T = {
  es: {
    confirmSubject: 'Confirma tu aviso de stock',
    confirmBody: (product: string) => `Has pedido que te avisemos cuando vuelva a haber stock de <strong>${esc(product)}</strong>. Para activar el aviso, confirma tu correo:`,
    confirmButton: 'Confirmar aviso',
    confirmIgnore: 'Si no has sido tú, ignora este correo y no te escribiremos más.',
    restockSubject: (n: number, first: string) => (n === 1 ? `Vuelve a haber stock: ${first}` : `Vuelve a haber stock de ${n} productos que sigues`),
    restockIntro: 'Hay stock de nuevo de lo que nos pediste que vigiláramos. Suele agotarse rápido:',
    at: 'en',
    buy: 'Ver en la tienda',
    restockNote: 'Comprobamos las tiendas cada pocos minutos, pero el stock puede haberse agotado otra vez cuando leas esto. PullRadar no vende nada ni cobra comisión por este aviso.',
    footer: (unsub: string) => `Recibes este correo porque te suscribiste a avisos de stock en PullRadar. <a href="${unsub}" style="color:#5f6672">Darme de baja de todos los avisos</a>.`,
  },
  en: {
    confirmSubject: 'Confirm your stock alert',
    confirmBody: (product: string) => `You asked us to let you know when <strong>${esc(product)}</strong> is back in stock. To turn the alert on, confirm your email:`,
    confirmButton: 'Confirm alert',
    confirmIgnore: 'If this was not you, ignore this email and we will not write again.',
    restockSubject: (n: number, first: string) => (n === 1 ? `Back in stock: ${first}` : `${n} products you follow are back in stock`),
    restockIntro: 'Something you asked us to watch is back in stock. It usually sells out fast:',
    at: 'at',
    buy: 'View in shop',
    restockNote: 'We check shops every few minutes, but stock may have sold out again by the time you read this. PullRadar sells nothing and earns no commission from this alert.',
    footer: (unsub: string) => `You get this email because you signed up for stock alerts on PullRadar. <a href="${unsub}" style="color:#5f6672">Unsubscribe from all alerts</a>.`,
  },
};

export function confirmMail(to: string, lang: Lang, product: string, confirmUrl: string, unsubUrl: string): Mail {
  const t = T[lang];
  const body = `<p>${t.confirmBody(product)}</p>
<p style="margin:22px 0"><a href="${confirmUrl}" style="background:#d0262b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">${t.confirmButton}</a></p>
<p style="color:#5f6672;font-size:13px">${t.confirmIgnore}</p>`;
  return {
    to, subject: t.confirmSubject, html: layout(body, t.footer(unsubUrl)),
    text: `${t.confirmBody(product).replace(/<[^>]+>/g, '')}\n\n${confirmUrl}\n\n${t.confirmIgnore}`,
  };
}

export function restockMail(to: string, lang: Lang, items: RestockItem[], unsubUrl: string, oneClickUrl: string): Mail {
  const t = T[lang];
  const rows = items.map((i) => `<tr>
<td width="72" style="padding:10px 12px 10px 0;vertical-align:top">${i.image ? `<img src="${esc(i.image)}" width="64" alt="" style="border-radius:6px;display:block">` : ''}</td>
<td style="padding:10px 0;vertical-align:top"><strong>${esc(i.name)}</strong><br>
<span style="color:#5f6672">${t.at} ${esc(i.shop)}${i.price != null ? `, ${money(i.price, lang)}` : ''}</span><br>
<a href="${esc(i.url)}" style="color:#c4232a;font-weight:bold">${t.buy}</a></td></tr>`).join('');
  const body = `<p>${t.restockIntro}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="color:#5f6672;font-size:13px;margin-top:18px">${t.restockNote}</p>`;
  return {
    to, subject: t.restockSubject(items.length, items[0]?.name ?? ''), html: layout(body, t.footer(unsubUrl)),
    text: `${t.restockIntro}\n\n${items.map((i) => `${i.name} (${i.shop}${i.price != null ? `, ${money(i.price, lang)}` : ''})\n${i.url}`).join('\n\n')}\n\n${t.restockNote}\n\n${unsubUrl}`,
    headers: { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

/** Envía uno o varios correos con Resend. Sin clave (desarrollo) solo los muestra en el registro. */
export async function sendMail(mails: Mail[], env: { RESEND_API_KEY?: string; MAIL_FROM: string }, fetchFn: typeof fetch = fetch) {
  if (!mails.length) return;
  if (!env.RESEND_API_KEY) {
    for (const m of mails) console.log(`[correo sin enviar] ${m.to}: ${m.subject}\n${m.text}`);
    return;
  }
  const payload = mails.map((m) => ({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, headers: m.headers }));
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const res = await fetchFn(chunk.length === 1 ? 'https://api.resend.com/emails' : 'https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.length === 1 ? chunk[0] : chunk),
    });
    if (!res.ok) throw new Error(`Resend: HTTP ${res.status} ${await res.text()}`);
  }
}

export function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i.test(email);
}
