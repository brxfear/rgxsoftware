// Firebase Auth e-posta şablonlarını (şifre belirleme/sıfırlama, e-posta doğrulama, e-posta değişikliği)
// RGX temasıyla günceller. Çalıştırma: node scripts/auth-email-templates.mjs  (Firebase CLI ile giriş yapılmış olmalı)
// Yer tutucular: %LINK% %EMAIL% %APP_NAME% %DISPLAY_NAME% %NEW_EMAIL%
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'rgxsoftware';
const LOGO = 'https://raw.githubusercontent.com/brxfear/rgxsoftware/main/public/media/email-logo.png';
const DISCORD = 'https://discord.gg/rgxsoftware1';

const layout = ({ preheader, title, intro, button, after, note }) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0708;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0708;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#140d0f;border:1px solid #2a1c1f;border-radius:18px;overflow:hidden;">
    <tr><td style="height:4px;background:#e0262f;background:linear-gradient(90deg,#f0333c,#8f0f16);font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:30px 32px 6px;">
      <img src="${LOGO}" width="84" height="84" alt="RGX Software" style="display:block;border:0;outline:none;">
    </td></tr>
    <tr><td align="center" style="padding:10px 32px 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;color:#f5f5f6;font-weight:800;">${title}</h1>
    </td></tr>
    <tr><td style="padding:16px 32px 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#d6cfd1;">
      ${intro}
    </td></tr>
    <tr><td align="center" style="padding:24px 32px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="#e0262f" style="border-radius:12px;">
          <a href="%LINK%" target="_blank" style="display:inline-block;padding:14px 30px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background:#e0262f;">${button}</a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 32px 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#9b9497;">
      ${after}
      <p style="margin:12px 0 0;">Düğme çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>
      <a href="%LINK%" style="color:#ff6a70;word-break:break-all;font-size:12px;">%LINK%</a></p>
    </td></tr>
    <tr><td style="padding:20px 32px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2a1c1f;"><tr>
        <td style="padding-top:16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#7d7578;">
          ${note}<br>
          Yardım için <a href="${DISCORD}" style="color:#ff6a70;text-decoration:none;">Discord sunucumuzdan</a> ulaşabilirsin.
        </td>
      </tr></table>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#5c5557;">© RGX Software</p>
</td></tr>
</table>
</body></html>`;

const templates = {
  resetPasswordTemplate: {
    senderDisplayName: 'RGX Software',
    senderLocalPart: 'noreply',
    subject: 'RGX Software — Şifreni belirle',
    bodyFormat: 'HTML',
    body: layout({
      preheader: 'RGX Software hesabın için şifre belirleme bağlantın.',
      title: 'Şifreni belirle',
      intro: `<p style="margin:0;">Merhaba,</p>
      <p style="margin:12px 0 0;"><strong style="color:#f5f5f6;">%EMAIL%</strong> hesabın için RGX Software şifresi belirleme / sıfırlama isteği aldık.
      Aşağıdaki düğmeye tıklayıp yeni şifreni belirleyebilirsin.</p>`,
      button: 'Şifremi belirle',
      after: `<p style="margin:0;">Şifreni belirledikten sonra e-posta adresin ve şifrenle giriş yapabilirsin. Bağlantı güvenliğin için kısa süre geçerlidir; süresi dolarsa yenisini isteyebilirsin.</p>`,
      note: 'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.',
    }),
  },
  verifyEmailTemplate: {
    senderDisplayName: 'RGX Software',
    senderLocalPart: 'noreply',
    subject: 'RGX Software — E-posta adresini doğrula',
    bodyFormat: 'HTML',
    body: layout({
      preheader: 'RGX Software hesabının e-posta adresini doğrula.',
      title: 'E-posta adresini doğrula',
      intro: `<p style="margin:0;">Merhaba %DISPLAY_NAME%,</p>
      <p style="margin:12px 0 0;">RGX Software hesabını tamamlamak için e-posta adresini doğrula.</p>`,
      button: 'E-postamı doğrula',
      after: '<p style="margin:0;">Doğrulama, siparişlerin ve lisans bilgilerin için hesabının güvende olmasını sağlar.</p>',
      note: 'Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.',
    }),
  },
  changeEmailTemplate: {
    senderDisplayName: 'RGX Software',
    senderLocalPart: 'noreply',
    subject: 'RGX Software — Giriş e-postan değiştirildi',
    bodyFormat: 'HTML',
    body: layout({
      preheader: 'RGX Software hesabının giriş e-postası değiştirildi.',
      title: 'Giriş e-postan değiştirildi',
      intro: `<p style="margin:0;">Merhaba %DISPLAY_NAME%,</p>
      <p style="margin:12px 0 0;">RGX Software hesabının giriş e-postası <strong style="color:#f5f5f6;">%NEW_EMAIL%</strong> olarak değiştirildi.</p>`,
      button: 'Değişikliği geri al',
      after: '<p style="margin:0;">Bu değişikliği sen yaptıysan bir şey yapmana gerek yok.</p>',
      note: 'Bu değişikliği sen yapmadıysan hemen yukarıdaki düğmeyle geri al ve şifreni değiştir.',
    }),
  },
};

// --preview-only <dosya>: Firebase'e göndermeden şifre e-postasının önizlemesini yazar
if (process.argv.includes('--preview-only')) {
  const out = process.argv[process.argv.indexOf('--preview-only') + 1];
  fs.writeFileSync(out, templates.resetPasswordTemplate.body.replaceAll('%LINK%', 'https://example.com/islem').replaceAll('%EMAIL%', 'ornek@gmail.com'));
  console.log('önizleme yazıldı:', out);
  process.exit(0);
}

const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8')).tokens.access_token;
// Firebase, spam'i önlemek için bazı şablonların gövdesinin değiştirilmesine izin vermez;
// --only resetPasswordTemplate,... ile sadece istenenler gönderilir.
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : Object.keys(templates);
for (const k of Object.keys(templates)) if (!only.includes(k)) delete templates[k];
const mask = Object.keys(templates).map((k) => `notification.sendEmail.${k}`).join(',');
const r = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=${encodeURIComponent(mask)}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ notification: { sendEmail: templates } }),
});
const out = await r.json();
if (!r.ok) {
  console.error('Hata', r.status, JSON.stringify(out).slice(0, 600));
  process.exit(1);
}
const t = out.notification.sendEmail;
console.log('Güncellendi:', Object.keys(templates).map((k) => `${k} → "${t[k].subject}" (${t[k].senderDisplayName || '-'})`).join('\n'));
if (process.argv.includes('--preview') && templates.resetPasswordTemplate) fs.writeFileSync(process.argv[process.argv.indexOf('--preview') + 1], templates.resetPasswordTemplate.body.replaceAll('%LINK%', 'https://example.com/islem').replaceAll('%EMAIL%', 'ornek@gmail.com'));
