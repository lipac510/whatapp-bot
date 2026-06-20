// Public legal pages served by the bot itself, so App Review has a stable Privacy Policy URL
// and Data Deletion Instructions URL without needing changes to the marketing website.

const COMPANY = "Lipack Packaging";
const WEBSITE = "https://www.cnlipack.com";
const CONTACT_EMAIL = "contact@cnlipack.com";
const SALES_EMAIL = "emma@cnlipack.com";
const ADDRESS =
  "Building 6, No. 198 Changjian Road, Luojing Town, Baoshan District, Shanghai, China";
const UPDATED = "20 June 2026";

function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · ${COMPANY}</title>
  <style>
    body { max-width: 760px; margin: 40px auto; padding: 0 18px; font-family: -apple-system, Arial, sans-serif; color: #1f2937; line-height: 1.6; }
    h1 { font-size: 24px; } h2 { font-size: 18px; margin-top: 28px; }
    a { color: #2563eb; } .muted { color: #6b7280; font-size: 14px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
${bodyHtml}
<p class="muted">Last updated: ${UPDATED} · <a href="${WEBSITE}">${WEBSITE}</a></p>
</body>
</html>`;
}

export function renderPrivacyPage() {
  return page(
    "Privacy Policy",
    `
  <h1>Privacy Policy</h1>
  <p>${COMPANY} ("we", "us") operates an automated customer-service assistant that
  replies to messages people send to our official Instagram and WhatsApp business
  accounts. This policy explains what we collect through that assistant and how we use it.</p>

  <h2>1. Information we collect</h2>
  <p>We only collect information when you message one of our business accounts:</p>
  <ul>
    <li>Your Instagram username and Instagram-scoped user ID, or your WhatsApp phone number and profile name.</li>
    <li>The content of the messages, photos, videos, or links you send us.</li>
    <li>The inquiry details you choose to provide: product of interest, quantity, shipping country/address, and a WhatsApp contact number.</li>
  </ul>
  <p>We do not collect data from people who have not contacted us first, and we do not buy or scrape personal data.</p>

  <h2>2. How we use it</h2>
  <ul>
    <li>To reply to your message and answer your product inquiry.</li>
    <li>To prepare quotations and arrange follow-up by our sales team.</li>
    <li>To maintain a record of your inquiry in our CRM (OKKI) so we can serve you.</li>
  </ul>
  <p>We use Instagram/WhatsApp messaging permissions solely to receive and send messages
  in these customer conversations. We never send unsolicited, bulk, or promotional messages
  to people who have not contacted us.</p>

  <h2>3. How we share it</h2>
  <p>Your information is accessible to our own sales staff and is stored in our CRM provider
  (OKKI / Xiaoman) and hosting infrastructure used to operate the assistant. We do not sell
  your personal information or share it for advertising.</p>

  <h2>4. Data retention</h2>
  <p>We keep inquiry records for as long as needed to serve you and for our legitimate
  business records, after which they are deleted. You may request deletion at any time
  (see below).</p>

  <h2>5. How to access or delete your data</h2>
  <p>To request access to or deletion of your data, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
  with the Instagram username or WhatsApp number you used to contact us. See our
  <a href="/data-deletion">Data Deletion Instructions</a>.</p>

  <h2>6. Contact</h2>
  <p>${COMPANY}<br>${ADDRESS}<br>
  Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> · Sales: <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a></p>
`
  );
}

export function renderDataDeletionPage() {
  return page(
    "Data Deletion Instructions",
    `
  <h1>Data Deletion Instructions</h1>
  <p>If you have messaged a ${COMPANY} Instagram or WhatsApp business account and want us to
  delete the information we collected from that conversation, you can request deletion at any time.</p>

  <h2>How to request deletion</h2>
  <ul>
    <li>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with the subject "Data deletion request".</li>
    <li>Include the Instagram username (@handle) or the WhatsApp number you used to contact us, so we can locate your records.</li>
  </ul>
  <p>We will delete your inquiry records and any stored message content associated with that
  account, normally within 30 days, and confirm by email.</p>

  <h2>Contact</h2>
  <p>${COMPANY}<br>${ADDRESS}<br>Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`
  );
}
