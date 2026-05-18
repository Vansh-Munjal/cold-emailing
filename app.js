/* ==============================
   ColdCraft — app.js (v2)
   ============================== */

const API_BASE = 'http://localhost:5001';  // Flask server

// ── State ──────────────────────────────────────────────────────────────────
let hrContacts = [];
let generatedEmails = [];
let gmailConnected = false;
let resumeFileB64 = null;
let resumeFileName = '';
let toastTimer;   // declared here to avoid TDZ error

// ── DOM refs ────────────────────────────────────────────────────────────────
const apiKeyEl = document.getElementById('apiKey');
const toggleApiBtn = document.getElementById('toggleApiKey');
const targetRoleEl = document.getElementById('targetRole');
const subjectEl = document.getElementById('emailSubject');
const templateEl = document.getElementById('emailTemplate');
const senderNameEl = document.getElementById('senderName');
const senderPhoneEl = document.getElementById('senderPhone');
const senderLinkedInEl = document.getElementById('senderLinkedIn');
const csvInputEl = document.getElementById('csvInput');
const generateBtn = document.getElementById('generateBtn');
const generateBtnText = document.getElementById('generateBtnText');
const progressSection = document.getElementById('progressSection');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const progressDetail = document.getElementById('progressDetail');
const resultsSection = document.getElementById('resultsSection');
const resultsSub = document.getElementById('resultsSub');
const emailCards = document.getElementById('emailCards');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const tablePreview = document.getElementById('tablePreview');
const previewCount = document.getElementById('previewCount');
const previewTableBody = document.getElementById('previewTableBody');
const toastEl = document.getElementById('toast');

// ── API Key Toggle ───────────────────────────────────────────────────────────
toggleApiBtn.addEventListener('click', () => {
  apiKeyEl.type = apiKeyEl.type === 'password' ? 'text' : 'password';
});

// ── Tab switching (generic) ──────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.step-card, .card, main') || document;
    const siblings = btn.closest('.tab-group').querySelectorAll('.tab-btn');
    siblings.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    // find sibling tab-contents in same parent section
    const section = btn.closest('section') || btn.closest('.card') || document.body;
    section.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById('tabContent' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (target) target.classList.add('active');
  });
});

// ── Resume PDF Upload ────────────────────────────────────────────────────────
const resumeFileInput = document.getElementById('resumeFileInput');
const resumeDropZone = document.getElementById('resumeDropZone');
const resumeUploadStatus = document.getElementById('resumeUploadStatus');
const resumeFileNameEl = document.getElementById('resumeFileName');

resumeFileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleResumeFile(e.target.files[0]);
});

// Drag & drop
resumeDropZone.addEventListener('dragover', e => { e.preventDefault(); resumeDropZone.classList.add('dragover'); });
resumeDropZone.addEventListener('dragleave', () => resumeDropZone.classList.remove('dragover'));
resumeDropZone.addEventListener('drop', e => {
  e.preventDefault();
  resumeDropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handleResumeFile(file);
  else showToast('Please drop a PDF file.', true);
});

async function handleResumeFile(file) {
  resumeFileName = file.name;
  // Store base64 for email attachment only (no text extraction)
  const arrBuf = await file.arrayBuffer();
  resumeFileB64 = btoa(String.fromCharCode(...new Uint8Array(arrBuf)));
  resumeFileNameEl.textContent = file.name;
  resumeUploadStatus.classList.remove('hidden');
  showToast(`✓ Resume attached: ${file.name}`);
}

window.clearResume = function () {
  resumeFileB64 = null;
  resumeFileName = '';
  resumeFileInput.value = '';
  resumeUploadStatus.classList.add('hidden');
};

// ── CSV File Upload ──────────────────────────────────────────────────────────
document.getElementById('csvFileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    csvInputEl.value = ev.target.result;
    parseCSV();
  };
  reader.readAsText(file);
});

// ── Parse CSV ────────────────────────────────────────────────────────────────
document.getElementById('parseCSVBtn').addEventListener('click', parseCSV);

function parseCSV() {
  const raw = csvInputEl.value.trim();
  if (!raw) { showToast('Please paste or upload CSV data first.', true); return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) { showToast('Need at least a header row + 1 data row.', true); return; }

  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const nameIdx = findIdx(headers, ['name', 'full name', 'contact name']);
  const emailIdx = findIdx(headers, ['email', 'email address', 'mail']);
  const titleIdx = findIdx(headers, ['title', 'designation', 'position', 'role']);
  const companyIdx = findIdx(headers, ['company', 'organization', 'org', 'firm']);

  if (emailIdx === -1) { showToast('Could not find an "Email" column.', true); return; }

  hrContacts = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim);
    const c = {
      name: nameIdx !== -1 ? clean(cols[nameIdx]) : 'Hiring Manager',
      email: emailIdx !== -1 ? clean(cols[emailIdx]) : '',
      title: titleIdx !== -1 ? clean(cols[titleIdx]) : 'HR',
      company: companyIdx !== -1 ? clean(cols[companyIdx]) : 'your company',
    };
    if (c.email) hrContacts.push(c);
  }

  if (!hrContacts.length) { showToast('No valid contacts found.', true); return; }
  renderPreview();
  showToast(`✓ ${hrContacts.length} contacts loaded`);
}

function findIdx(headers, opts) {
  for (const o of opts) { const i = headers.findIndex(h => h.includes(o)); if (i !== -1) return i; }
  return -1;
}
function splitLine(line, delim) {
  const res = []; let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === delim && !inQ) { res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  res.push(cur); return res;
}
function clean(s) { return (s || '').replace(/['"]/g, '').trim(); }

function renderPreview() {
  tablePreview.classList.remove('hidden');
  previewCount.textContent = `${hrContacts.length} contact${hrContacts.length !== 1 ? 's' : ''} loaded`;
  previewTableBody.innerHTML = hrContacts.map((c, i) => `
    <tr>
      <td>${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.email)}</td>
      <td>${esc(c.title)}</td><td>${esc(c.company)}</td>
    </tr>`).join('');
}

document.getElementById('clearTableBtn').addEventListener('click', () => {
  hrContacts = []; tablePreview.classList.add('hidden'); csvInputEl.value = '';
  showToast('Table cleared');
});

// ── Manual Table ─────────────────────────────────────────────────────────────
window.addRow = function () {
  const tbody = document.getElementById('hrTableBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="table-input" placeholder="Name" data-col="name"/></td>
    <td><input class="table-input" placeholder="email@co.com" data-col="email"/></td>
    <td><input class="table-input" placeholder="HR Manager" data-col="title"/></td>
    <td><input class="table-input" placeholder="Company" data-col="company"/></td>
    <td><button class="btn-remove" onclick="removeRow(this)">✕</button></td>`;
  tbody.appendChild(tr);
};
window.removeRow = function (btn) {
  const tbody = document.getElementById('hrTableBody');
  if (tbody.rows.length > 1) btn.closest('tr').remove();
};
function collectManualTable() {
  return [...document.querySelectorAll('#hrTableBody tr')].reduce((acc, row) => {
    const o = {};
    row.querySelectorAll('.table-input').forEach(i => { o[i.dataset.col] = i.value.trim(); });
    if (o.email) acc.push({ name: o.name || 'Hiring Manager', email: o.email, title: o.title || 'HR', company: o.company || 'your company' });
    return acc;
  }, []);
}

// ── Gmail OAuth ───────────────────────────────────────────────────────────────
window.connectGmail = async function () {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, { credentials: 'include' });
    const data = await res.json();
    if (data.error) { showToast(data.error, true); return; }
    // Redirect the main window (not a popup) so session cookies are shared
    window.location.href = data.auth_url;
  } catch (e) {
    showToast('Could not reach Flask server. Run: python3 server.py', true);
  }
};

window.disconnectGmail = async function () {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  updateGmailUI(false, '');
};

function updateGmailUI(connected, email) {
  gmailConnected = connected;
  const box = document.getElementById('gmailConnectBox');
  const connectBtn = document.getElementById('gmailConnectBtn');
  const disconnBtn = document.getElementById('gmailDisconnectBtn');
  const statusText = document.getElementById('gmailStatusText');
  if (connected) {
    box.classList.add('connected');
    connectBtn.textContent = '✓ Connected';
    connectBtn.classList.add('connected');
    connectBtn.disabled = true;
    disconnBtn.classList.remove('hidden');
    statusText.textContent = `Sending as: ${email}`;
    showToast(`✓ Gmail connected: ${email}`);
  } else {
    box.classList.remove('connected');
    connectBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg> Connect Gmail`;
    connectBtn.classList.remove('connected');
    connectBtn.disabled = false;
    disconnBtn.classList.add('hidden');
    statusText.textContent = 'Not connected — emails will only be generated, not sent';
    showToast('Gmail disconnected');
  }
}

// Check auth on page load (if server is running)
(async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
    const data = await res.json();
    if (data.authenticated) updateGmailUI(true, data.email);
  } catch (_) { /* server not running yet */ }
})();

// Check if redirected back after auth
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('auth') === 'success') {
  const email = urlParams.get('email') || '';
  updateGmailUI(true, email);
  window.history.replaceState({}, '', '/');
}

// ── Generate Emails ───────────────────────────────────────────────────────────
async function generateEmails() {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { showToast('Please enter your Gemini API key.', true); return; }

  const role = targetRoleEl.value.trim() || 'Software Development Intern';
  const template = templateEl.value.trim();
  const sender = senderNameEl.value.trim() || 'Your Name';
  const phone = senderPhoneEl.value.trim() || 'Your Phone';
  const linkedin = senderLinkedInEl.value.trim() || 'Your LinkedIn';

  const activeTab = document.querySelector('#step-table .tab-btn.active')?.dataset.tab;
  let contacts = activeTab === 'paste' ? hrContacts : collectManualTable();

  if (!contacts.length) { showToast('No HR contacts found.', true); return; }
  if (!resumeFileB64) { showToast('Please upload your resume PDF.', true); return; }

  generatedEmails = [];
  emailCards.innerHTML = '';
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  progressSection.classList.remove('hidden');
  progressBarFill.style.width = '0%';
  generateBtn.disabled = true;
  generateBtnText.textContent = 'Generating...';

  const userSubject = subjectEl ? subjectEl.value.trim() : '';
  let successCount = 0;
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const pct = Math.round((i / contacts.length) * 100);
    progressBarFill.style.width = pct + '%';
    progressText.textContent = `Building email ${i + 1} of ${contacts.length}...`;
    progressDetail.textContent = `→ ${c.name} · ${c.company}`;

    const result = buildEmail(c, { subject: userSubject, template, sender, phone, linkedin });
    generatedEmails.push(result);
    appendEmailCard(result, i);
    successCount++;
    await sleep(50);
  }

  progressBarFill.style.width = '100%';
  progressText.textContent = 'Done!';
  progressDetail.textContent = `${successCount} of ${contacts.length} emails ready.`;

  setTimeout(() => {
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    resultsSub.textContent = `${successCount} email${successCount !== 1 ? 's' : ''} ready`;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 600);

  generateBtn.disabled = false;
  generateBtnText.textContent = 'Generate Personalized Emails';
  showToast(`✓ ${successCount} emails ready!`);
}

// ── Template email builder ────────────────────────────────────────────────────
function buildEmail(contact, { subject, template, sender, phone, linkedin }) {
  const firstName = contact.name.split(' ')[0];
  const replace = (str) => (str || '')
    .replace(/\[Name\]/gi, firstName)
    .replace(/\[HR\]/gi, firstName)
    .replace(/\[Company\]/gi, contact.company)
    .replace(/\[Role\]/gi, contact.title || '');

  const finalSubject = replace(subject) || `Opportunity at ${contact.company}`;
  let finalBody = replace(template);

  // Append signature if sender name not already in body
  if (sender && !finalBody.includes(sender)) {
    finalBody += `\n\nRegards,\n${sender}${phone ? '\n' + phone : ''}${linkedin ? '\n' + linkedin : ''}`;
  }
  return { to: contact.email, subject: finalSubject, body: finalBody, name: contact.name, company: contact.company };
}

// ── Email Cards ───────────────────────────────────────────────────────────────
function appendEmailCard(email, index) {
  const card = document.createElement('div');
  card.className = 'email-card';
  card.id = `email-card-${index}`;
  card.innerHTML = `
    <div class="email-card-header" onclick="toggleCard(${index})">
      <div class="email-card-meta">
        <span class="email-card-name">${esc(email.name)}</span>
        <span class="email-card-company">${esc(email.company)}</span>
        <span class="email-card-email">${esc(email.to)}</span>
      </div>
      <div class="email-card-actions">
        <button class="btn-copy" id="copy-btn-${index}" onclick="event.stopPropagation();copyEmail(${index})">Copy</button>
        <button class="btn-edit" id="edit-btn-${index}" onclick="event.stopPropagation();editEmail(${index})">Edit</button>
        <button class="btn-send" id="send-btn-${index}" onclick="event.stopPropagation();sendSingleEmail(${index})">Send</button>
        <span class="chevron">▾</span>
      </div>
    </div>
    <div class="email-card-body">
      <p class="email-subject"><strong>Subject:</strong> ${esc(email.subject)}</p>
      <div class="email-body-text" id="body-display-${index}">${esc(email.body)}</div>
      <textarea class="email-body-edit hidden" id="body-edit-${index}" rows="12">${esc(email.body)}</textarea>
    </div>`;
  emailCards.appendChild(card);
  if (index === 0) window.toggleCard(0);
}

window.editEmail = function (i) {
  const display = document.getElementById(`body-display-${i}`);
  const editor = document.getElementById(`body-edit-${i}`);
  const btn = document.getElementById(`edit-btn-${i}`);
  if (!display || !editor) return;
  if (editor.classList.contains('hidden')) {
    editor.value = generatedEmails[i].body;
    display.classList.add('hidden');
    editor.classList.remove('hidden');
    btn.textContent = 'Save';
    btn.style.background = 'rgba(99,102,241,0.25)';
  } else {
    generatedEmails[i].body = editor.value;
    display.textContent = editor.value;
    display.classList.remove('hidden');
    editor.classList.add('hidden');
    btn.textContent = 'Edit';
    btn.style.background = '';
    showToast('Email saved ✓');
  }
};

window.toggleCard = function (i) {
  document.getElementById(`email-card-${i}`)?.classList.toggle('expanded');
};


// ── Copy ──────────────────────────────────────────────────────────────────────
window.copyEmail = async function (i) {
  const e = generatedEmails[i];
  if (!e) return;
  await copyToClipboard(formatEmailText(e));
  const btn = document.getElementById(`copy-btn-${i}`);
  if (btn) { btn.textContent = 'Copied!'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000); }
};

window.copyAll = async function () {
  await copyToClipboard(generatedEmails.map(formatEmailText).join('\n\n' + '-'.repeat(50) + '\n\n'));
  showToast('All emails copied!');
};

// ── Download ──────────────────────────────────────────────────────────────────
window.downloadAll = function () {
  const text = generatedEmails.map(formatEmailText).join('\n\n' + '-'.repeat(50) + '\n\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: 'coldcraft_emails.txt' });
  a.click();
  showToast('Downloaded coldcraft_emails.txt');
};

// ── Send via Gmail ────────────────────────────────────────────────────────────
window.sendSingleEmail = async function (i) {
  if (!gmailConnected) { showToast('Connect Gmail first (Step 01)', true); return; }
  const e = generatedEmails[i];
  const btn = document.getElementById(`send-btn-${i}`);
  if (!e || e.error) { showToast('Cannot send an errored email.', true); return; }
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    await sendEmailToServer(e);
    btn.textContent = 'Sent ✓';
    btn.style.color = 'var(--green)';
    showToast(`✓ Sent to ${e.to}`);
  } catch (err) {
    btn.textContent = 'Failed';
    btn.disabled = false;
    showToast(`Failed: ${err.message}`, true);
  }
};

window.sendAllEmails = async function () {
  if (!gmailConnected) { showToast('Connect Gmail first (Step 01)', true); return; }
  const valid = generatedEmails.filter(e => !e.error);
  if (!valid.length) { showToast('No valid emails to send.', true); return; }

  // Show send progress log below results header
  let logEl = document.getElementById('sendLog');
  if (!logEl) {
    const div = document.createElement('div');
    div.className = 'send-progress-card';
    div.innerHTML = `<div class="progress-header"><div class="progress-spinner"></div><span>Sending emails...</span></div><div class="send-log" id="sendLog"></div>`;
    resultsSection.querySelector('.results-header').after(div);
    logEl = document.getElementById('sendLog');
  }
  logEl.innerHTML = '';

  const btn = document.getElementById('sendAllBtn');
  const txt = document.getElementById('sendAllBtnText');
  btn.disabled = true;
  txt.textContent = `Sending 0/${valid.length}...`;

  let sent = 0;
  for (const e of valid) {
    const line = document.createElement('div');
    line.className = 'send-log-line';
    line.textContent = `→ ${e.to}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    try {
      await sendEmailToServer(e);
      line.textContent = `✓ ${e.to}`;
      line.classList.add('ok');
      sent++;
    } catch (err) {
      line.textContent = `✗ ${e.to} — ${err.message}`;
      line.classList.add('err');
    }
    txt.textContent = `Sending ${sent}/${valid.length}...`;
    await sleep(300);
  }
  btn.disabled = false;
  txt.textContent = 'Send All via Gmail';
  showToast(`✓ Sent ${sent} of ${valid.length} emails`);
};

async function sendEmailToServer(email) {
  const res = await fetch(`${API_BASE}/send_email`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email.to,
      subject: email.subject,
      body: email.body,
      resume_b64: resumeFileB64 || null,
      resume_name: resumeFileName || 'resume.pdf',
    })
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatEmailText(e) { return `To: ${e.to}\nSubject: ${e.subject}\n\n${e.body}`; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
window.dismissError = function () { errorSection.classList.add('hidden'); };

function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3500);
}
