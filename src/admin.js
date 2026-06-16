function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function latestCreatedAt(items) {
  return items
    .map((item) => new Date(item.createdAt || item.updatedAt || 0).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0] || 0;
}

function inferStatus({ customerId, messages, inquiries, failures, okkiSyncs, sessions, knownCustomers }) {
  const customerFailures = failures.filter((item) => item.customerId === customerId);
  const customerSyncs = okkiSyncs.filter((item) => item.customerId === customerId);
  const customerInquiries = inquiries.filter((item) => item.customerId === customerId);

  if (customerFailures.length) return "Needs review";
  if (customerSyncs.some((item) => item.ok === true)) return "OKKI synced";
  if (knownCustomers[customerId]) return "Known customer";
  if (customerInquiries.length) return "Inquiry saved";
  if (sessions[customerId]) return "Collecting";
  if (messages.some((item) => item.category === "official_notice")) return "Official notice";
  return "Not synced";
}

export function buildAdminModel({
  messages = [],
  inquiries = [],
  failures = [],
  okkiSyncs = [],
  sessions = {},
  knownCustomers = {},
  handoffWindows = {},
  emmaReplies = {},
  query = ""
} = {}) {
  const customerIds = new Set([
    ...messages.map((item) => item.customerId),
    ...inquiries.map((item) => item.customerId),
    ...failures.map((item) => item.customerId),
    ...okkiSyncs.map((item) => item.customerId),
    ...Object.keys(sessions),
    ...Object.keys(knownCustomers),
    ...Object.keys(handoffWindows),
    ...Object.keys(emmaReplies)
  ].filter(Boolean));

  const conversations = [...customerIds].map((customerId) => {
    const customerMessages = messages.filter((item) => item.customerId === customerId);
    const customerInquiries = inquiries.filter((item) => item.customerId === customerId);
    const customerFailures = failures.filter((item) => item.customerId === customerId);
    const customerSyncs = okkiSyncs.filter((item) => item.customerId === customerId);
    const lastMessage = customerMessages.at(-1) || {};
    const latestInquiry = customerInquiries.at(-1) || {};
    const session = sessions[customerId] || null;
    const profileName =
      lastMessage.profileName ||
      latestInquiry.profileName ||
      session?.profileName ||
      "";
    const status = inferStatus({
      customerId,
      messages: customerMessages,
      inquiries,
      failures,
      okkiSyncs,
      sessions,
      knownCustomers
    });

    return {
      customerId,
      profileName,
      status,
      messageCount: customerMessages.length,
      inquiryCount: customerInquiries.length,
      failureCount: customerFailures.length,
      okkiSyncCount: customerSyncs.filter((item) => item.ok === true).length,
      sessionStep: session?.step || "",
      product: latestInquiry.product || session?.data?.product || "",
      quantity: latestInquiry.quantity || session?.data?.quantity || "",
      address: latestInquiry.address || session?.data?.address || "",
      knownReason: knownCustomers[customerId]?.reason || "",
      handoff: handoffWindows[customerId] || null,
      emmaReply: emmaReplies[customerId] || null,
      lastText: lastMessage.text || lastMessage.label || "",
      lastAt: latestCreatedAt([
        ...customerMessages,
        ...customerInquiries,
        ...customerFailures,
        ...customerSyncs,
        session || {},
        knownCustomers[customerId] || {},
        handoffWindows[customerId] || {},
        emmaReplies[customerId] || {}
      ])
    };
  }).sort((a, b) => b.lastAt - a.lastAt);

  const needle = normalize(query);
  const filteredConversations = needle
    ? conversations.filter((item) =>
        [
          item.customerId,
          item.profileName,
          item.status,
          item.product,
          item.quantity,
          item.address,
          item.lastText
        ].some((value) => normalize(value).includes(needle))
      )
    : conversations;

  return {
    conversations: filteredConversations,
    totals: {
      conversations: conversations.length,
      okkiSynced: conversations.filter((item) => item.status === "OKKI synced").length,
      collecting: conversations.filter((item) => item.status === "Collecting").length,
      needsReview: conversations.filter((item) => item.status === "Needs review").length,
      messages: messages.length,
      failures: failures.length
    }
  };
}

function renderBadge(status) {
  const className = status.toLowerCase().replaceAll(" ", "-");
  return `<span class="badge ${escapeHtml(className)}">${escapeHtml(status)}</span>`;
}

function renderMessage(message) {
  const direction = message.direction === "out" ? "out" : message.direction === "system" ? "system" : "in";
  const text = message.text || message.label || "";
  const media = message.mediaUrl ? `<div><a href="${escapeHtml(message.mediaUrl)}" target="_blank">Open media</a></div>` : "";
  return `
    <div class="message ${direction}">
      <div class="meta">${escapeHtml(direction.toUpperCase())} · ${escapeHtml(message.type || "text")} · ${escapeHtml(formatTime(message.createdAt))}</div>
      <pre>${escapeHtml(text)}</pre>
      ${media}
    </div>`;
}

function renderDetails({ customerId, messages, inquiries, failures, okkiSyncs, sessions, knownCustomers, handoffWindows, emmaReplies }) {
  if (!customerId) {
    return `<section class="panel empty"><h2>Conversation</h2><p>Select a customer to view full history.</p></section>`;
  }

  const customerMessages = messages.filter((item) => item.customerId === customerId);
  const customerInquiries = inquiries.filter((item) => item.customerId === customerId);
  const customerFailures = failures.filter((item) => item.customerId === customerId);
  const customerSyncs = okkiSyncs.filter((item) => item.customerId === customerId);
  const session = sessions[customerId] || null;
  const facts = [
    ["Customer", customerId],
    ["Current step", session?.step || "none"],
    ["Known customer", knownCustomers[customerId]?.reason || "no"],
    ["Handoff completed", handoffWindows[customerId]?.completedAt || ""],
    ["Emma reply", emmaReplies[customerId]?.sentAt || ""],
    ["Inquiries", customerInquiries.length],
    ["OKKI syncs", customerSyncs.length],
    ["Failures", customerFailures.length]
  ];

  return `
    <section class="panel detail">
      <h2>Conversation: ${escapeHtml(customerId)}</h2>
      <div class="facts">
        ${facts.map(([key, value]) => `<div><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join("")}
      </div>
      <h3>Messages</h3>
      <div class="messages">
        ${customerMessages.length ? customerMessages.map(renderMessage).join("") : "<p>No message log yet.</p>"}
      </div>
      <h3>Inquiry / OKKI / Failures</h3>
      <pre class="json">${escapeHtml(JSON.stringify({ inquiries: customerInquiries, okkiSyncs: customerSyncs, failures: customerFailures }, null, 2))}</pre>
    </section>`;
}

export function renderAdminPage({
  model,
  messages = [],
  inquiries = [],
  failures = [],
  okkiSyncs = [],
  sessions = {},
  knownCustomers = {},
  handoffWindows = {},
  emmaReplies = {},
  selectedCustomerId = "",
  query = ""
}) {
  const rows = model.conversations.map((item) => {
    const active = item.customerId === selectedCustomerId ? " active" : "";
    const href = `/admin?customer=${encodeURIComponent(item.customerId)}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
    return `
      <tr class="${active}">
        <td><a href="${href}">${escapeHtml(item.customerId)}</a><br><small>${escapeHtml(item.profileName)}</small></td>
        <td>${renderBadge(item.status)}<br><small>${escapeHtml(item.knownReason)}</small></td>
        <td>${escapeHtml(item.product)}<br><small>${escapeHtml(item.quantity)} · ${escapeHtml(item.address)}</small></td>
        <td>${escapeHtml(item.messageCount)}</td>
        <td>${escapeHtml(item.failureCount)}</td>
        <td>${escapeHtml(formatTime(item.lastAt))}</td>
      </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WhatsApp Bot Admin</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #17212b; background: #f5f7fa; }
    body { margin: 0; }
    header { position: sticky; top: 0; z-index: 2; background: #111827; color: white; padding: 16px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 20px; }
    h2 { margin: 0 0 16px; font-size: 18px; }
    h3 { margin: 22px 0 10px; font-size: 15px; }
    form { display: flex; gap: 8px; }
    input { min-width: 260px; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
    button { padding: 9px 14px; border: 0; border-radius: 6px; background: #2563eb; color: white; font-weight: 700; }
    main { padding: 22px; display: grid; grid-template-columns: minmax(620px, 1fr) minmax(420px, 0.75fr); gap: 18px; align-items: start; }
    .stats { display: grid; grid-template-columns: repeat(5, minmax(100px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .stat, .panel { background: white; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .stat { padding: 12px; }
    .stat strong { display: block; font-size: 22px; margin-top: 4px; }
    .panel { padding: 16px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #edf2f7; text-align: left; vertical-align: top; }
    th { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr.active { background: #eff6ff; }
    a { color: #2563eb; text-decoration: none; }
    small { color: #64748b; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; background: #e2e8f0; font-size: 12px; font-weight: 700; }
    .okki-synced { background: #dcfce7; color: #166534; }
    .needs-review { background: #fee2e2; color: #991b1b; }
    .collecting { background: #fef3c7; color: #92400e; }
    .known-customer { background: #e0e7ff; color: #3730a3; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .facts div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px; }
    .facts strong { display: block; color: #64748b; font-size: 12px; margin-bottom: 3px; }
    .message { border-radius: 8px; padding: 10px; margin: 8px 0; border: 1px solid #e2e8f0; }
    .message.in { background: #f8fafc; }
    .message.out { background: #ecfdf5; }
    .message.system { background: #fff7ed; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.45; }
    .json { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 12px; max-height: 420px; overflow: auto; }
    .empty { min-height: 180px; color: #64748b; }
    @media (max-width: 1100px) { main { grid-template-columns: 1fr; } .stats { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <header>
    <h1>WhatsApp Bot Admin</h1>
    <form action="/admin" method="get">
      <input name="q" value="${escapeHtml(query)}" placeholder="Search phone, name, status, product">
      ${selectedCustomerId ? `<input type="hidden" name="customer" value="${escapeHtml(selectedCustomerId)}">` : ""}
      <button type="submit">Search</button>
    </form>
  </header>
  <main>
    <section>
      <div class="stats">
        <div class="stat">Customers<strong>${model.totals.conversations}</strong></div>
        <div class="stat">OKKI synced<strong>${model.totals.okkiSynced}</strong></div>
        <div class="stat">Collecting<strong>${model.totals.collecting}</strong></div>
        <div class="stat">Needs review<strong>${model.totals.needsReview}</strong></div>
        <div class="stat">Messages<strong>${model.totals.messages}</strong></div>
      </div>
      <section class="panel">
        <h2>Customers</h2>
        <table>
          <thead><tr><th>Customer</th><th>Status</th><th>Inquiry</th><th>Msgs</th><th>Fails</th><th>Last activity</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">No customers found.</td></tr>`}</tbody>
        </table>
      </section>
    </section>
    ${renderDetails({ customerId: selectedCustomerId, messages, inquiries, failures, okkiSyncs, sessions, knownCustomers, handoffWindows, emmaReplies })}
  </main>
</body>
</html>`;
}
