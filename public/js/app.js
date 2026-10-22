const STR = { paidCash: 'Cash', paidOnline: 'Online', paidCheque: 'Cheque', closeBtn: 'Close', noInvoices: 'No invoices yet.' };
function t(key) { return STR[key] || key; }

let parties = [], invoices = [], varieties = [];
let selectedPartyId = null;
let ledgerNewestFirst = false;

// ---------- server API ----------
async function api(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]').content },
        body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401 || res.status === 419) { location.href = '/login'; throw new Error('Session expired. Please log in again.'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Server error');
    return data;
}
function toEntry(e) {
    const base = { id: e.id, date: e.date, type: e.type, amount: e.amount, invoiceId: e.invoiceId };
    if (e.type === 'credit') {
        const inv = invoices.find(i => i.id === e.invoiceId);
        return { ...base, note: inv ? invoiceNote(inv) : 'invoicePrefix|0||0|dz' };
    }
    return { ...base, note: methodNote(e.method) };
}
async function loadAll() {
    const d = await api('GET', '/api/bootstrap');
    varieties = d.varieties;
    invoices = d.invoices;
    _invMap = null;
    parties = d.parties.map(p => ({ id: p.id, name: p.name, entries: p.entries.map(toEntry) }));
    if (d.user) renderProfile(d.user);
}
function renderProfile(user) {
    const initials = user.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('profileCardAvatar').textContent = initials;
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileCardName').textContent = user.name;
    document.getElementById('profileCardEmail').textContent = user.email;
    document.getElementById('profileEmail').textContent = user.email;
}
function editProfileName(editing) {
    const card = document.getElementById('profileCard');
    card.classList.toggle('editing', editing);
    document.getElementById('profileNameErr').style.display = 'none';
    if (editing) {
        const input = document.getElementById('profileNameInput');
        input.value = document.getElementById('profileCardName').textContent;
        input.focus();
        input.select();
    }
}
async function saveProfileName(ev) {
    ev.preventDefault();
    const name = document.getElementById('profileNameInput').value.trim();
    const err = document.getElementById('profileNameErr');
    const btn = document.getElementById('profileNameSave');
    if (!name) { err.textContent = 'Name cannot be empty.'; err.style.display = 'block'; return; }
    btn.disabled = true;
    try { renderProfile(await api('PUT', '/api/profile', { name })); editProfileName(false); }
    catch (e) { err.textContent = e.message; err.style.display = 'block'; }
    finally { btn.disabled = false; }
}
function toggleProfile(open) {
    const card = document.getElementById('profileCard');
    const show = open ?? !card.classList.contains('show');
    if (!show) editProfileName(false);
    card.classList.toggle('show', show);
    document.getElementById('profileBtn').setAttribute('aria-expanded', show);
}
document.addEventListener('click', e => { if (!e.target.closest('#profile')) toggleProfile(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleProfile(false); });
async function logout() {
    try { await fetch('/logout', { method: 'POST', headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]').content } }); } catch (e) { }
    location.replace('/login');
}
// If the browser restores this page from its back/forward cache, reload so the server can redirect to login
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

// ---------- helpers ----------
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function party(id) { return parties.find(p => String(p.id) === String(id)); }
function fmt(n) { return Math.round(Math.abs(n)).toLocaleString('en-PK'); }
function fmtDate(iso) {
    if (!iso) return '-';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso;
}
function todayISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function pad3(n) { const x = parseInt(n, 10); return isNaN(x) ? String(n) : String(x).padStart(3, '0'); }
function invNo(inv) { const n = parseInt(inv.no ?? inv.id, 10); return isNaN(n) ? 0 : n; }
function nextInvNo() { return invoices.reduce((m, i) => Math.max(m, invNo(i)), 0) + 1; }
function byName(a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); }
function balance(p) { return p.entries.reduce((s, e) => s + (e.type === 'credit' ? e.amount : -e.amount), 0); }
const CATS = { Romal: { unit: 'dz' }, Shawl: { unit: 'pcs' }, Lungi: { unit: 'sets' } };
const UNIT_SIZE = { dz: 12, pcs: 1, sets: 4 };
function catOf(v) { return (v && CATS[v.category]) ? v.category : 'Romal'; }
function nameHtml(n) { const t = esc(n); return /[\u0600-\u06FF]/.test(String(n || '')) ? `<span class="urn" dir="rtl">${t}</span>` : t; }
const CAT_UR = { Romal: 'رومال', Shawl: 'شال', Lungi: 'لنگی' };
const SOLD_UR = { Romal: 'درجن', Shawl: 'پیس', Lungi: 'چوکڑہ' };
// whole numbers only: amount fields are text inputs stripped to digits (see the 'input' listener below)
function intOf(el) { return parseInt(el.value, 10) || 0; }
function pcsOf(qty, unit) { return qty * (UNIT_SIZE[unit] || 12); }
function methodNote(m) { return m === 'Online' ? 'paidOnline' : m === 'Cheque' ? 'paidCheque' : 'paidCash'; }
function fillVarietySelect(sel, placeholder, addLabel, allMode) {
    const prev = sel.value;
    let html = allMode ? `<option value="">${placeholder}</option>` : `<option value="" disabled hidden>${placeholder}</option>`;
    if (addLabel) html += `<option value="new">${addLabel}</option>`;
    Object.keys(CATS).forEach(c => {
        const items = varieties.filter(v => catOf(v) === c).sort(byName);
        if (items.length) html += `<optgroup label="${c}">` + items.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('') + `</optgroup>`;
    });
    sel.innerHTML = html;
    sel.value = [...sel.options].some(o => o.value === prev && (prev !== '' || allMode)) ? prev : '';
}
function invPieces(inv) { return inv.items.reduce((s, i) => s + pcsOf(i.qty, i.unit), 0); }
function qtySummary(inv) {
    const by = {}; inv.items.forEach(i => { by[i.unit] = (by[i.unit] || 0) + (+i.qty || 0); });
    return ['dz', 'pcs', 'sets'].filter(u => by[u]).map(u => `${fmt(by[u])} ${unitName(u)}`).join('، ');
}
function itemsLine(inv, max) {
    const its = inv.items; max = max || 2;
    if (its.length === 1) return `${its[0].product}، ${its[0].qty} ${unitName(its[0].unit)}`;
    const shown = its.slice(0, max).map(i => `${i.product} ${i.qty} ${unitName(i.unit)}`).join('، ');
    return its.length > max ? `${shown} +${its.length - max} مزید` : shown;
}
let _invMap = null, _invMapLen = -1;
function invoiceByNo(no) {
    if (!_invMap || _invMapLen !== invoices.length) { _invMap = new Map(invoices.map(i => [invNo(i), i])); _invMapLen = invoices.length; }
    return _invMap.get(parseInt(no, 10));
}
function invoiceNote(inv) {
    const it = inv.items;
    return it.length === 1 ? `invoicePrefix|${inv.no}|${it[0].product}|${it[0].qty}|${it[0].unit}` : `invoicePrefix|${inv.no}|${it.length} items|${qtySummary(inv)}|`;
}
// ---------- whole-number fields ----------
// capture phase, so the digits are cleaned before any field's own input handler reads them
document.addEventListener('input', e => {
    const el = e.target;
    if (!el.matches || !el.matches('input.int')) return;
    // Urdu keyboards type ۰-۹ / ٠-٩; map them to 0-9 rather than dropping them
    const digits = el.value.replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) & 0xF)).replace(/\D/g, '');
    if (digits !== el.value) el.value = digits;
}, true);

// ---------- date fields (dd/mm/yyyy) ----------
function isoToDMY(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }
function dmyToISO(txt) {
    const m = String(txt || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function readDate(id) { return dmyToISO(document.getElementById(id).value); }
function writeDate(id, iso) {
    const txt = document.getElementById(id);
    txt.value = isoToDMY(iso);
    const nat = txt.parentElement.querySelector('.dnative');
    if (nat) nat.value = iso || '';
}
document.querySelectorAll('.date-field').forEach(box => {
    const txt = box.querySelector('.dtext'), nat = box.querySelector('.dnative');
    txt.addEventListener('input', () => {
        const digits = txt.value.replace(/\D/g, '').slice(0, 8);
        let out = digits.slice(0, 2);
        if (digits.length > 2) out += '/' + digits.slice(2, 4);
        if (digits.length > 4) out += '/' + digits.slice(4);
        txt.value = out;
        const iso = dmyToISO(out);
        if (iso) nat.value = iso;
    });
    nat.addEventListener('change', () => { txt.value = isoToDMY(nat.value); txt.dispatchEvent(new Event('change')); });
    nat.addEventListener('click', () => { try { nat.showPicker && nat.showPicker(); } catch (e) { } });
});

['ffFrom', 'ffTo'].forEach(id => {
    const el = document.getElementById(id);
    const go = () => { const v = el.value.trim(); if (!v || readDate(id)) onSearch('invoices'); };
    el.addEventListener('input', go);
    el.parentElement.querySelector('.dnative').addEventListener('change', () => setTimeout(go, 0));
});

// ---------- pagination (50 per page) ----------
const PAGE_SIZE = 50;
const pageState = {};
const RENDER = {};
function paginate(key, rows) {
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const cur = Math.min(Math.max(pageState[key] || 1, 1), pages);
    pageState[key] = cur;
    const el = document.getElementById('pager-' + key);
    if (el) {
        if (pages <= 1) { el.style.display = 'none'; el.innerHTML = ''; }
        else {
            const nums = new Set([1, pages, cur - 2, cur - 1, cur, cur + 1, cur + 2].filter(n => n >= 1 && n <= pages));
            const sorted = [...nums].sort((a, b) => a - b);
            let html = `<button ${cur === 1 ? 'disabled' : ''} onclick="goPage('${key}',${cur - 1})" aria-label="Previous page">&lsaquo;</button>`;
            let prev = 0;
            sorted.forEach(n => {
                if (n - prev > 1) html += `<span class="gap">...</span>`;
                html += `<button class="${n === cur ? 'cur' : ''}" onclick="goPage('${key}',${n})">${n}</button>`;
                prev = n;
            });
            html += `<button ${cur === pages ? 'disabled' : ''} onclick="goPage('${key}',${cur + 1})" aria-label="Next page">&rsaquo;</button>`;
            const from = (cur - 1) * PAGE_SIZE + 1, to = Math.min(cur * PAGE_SIZE, total);
            el.innerHTML = `<span class="info">${total} میں سے ${from} تا ${to}</span><div class="pages">${html}</div>`;
            el.style.display = 'flex';
        }
    }
    return rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
}
function goPage(key, n) { pageState[key] = n; RENDER[key](); }
function onSearch(key) { pageState[key] = 1; RENDER[key](); }

// ---------- views ----------
const VIEWS = ['invoices', 'ledger', 'payments', 'parties', 'varieties', 'history'];
function setView(v) {
    document.querySelectorAll('.nav .item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    VIEWS.forEach(name => {
        document.getElementById('view-' + name).style.display = (name === v) ? 'block' : 'none';
    });
    if (v === 'ledger') renderLedgerView();
    if (v === 'invoices') renderInvoices();
    if (v === 'payments') renderPaymentsView();
    if (v === 'parties') renderPartiesList();
    if (v === 'varieties') renderVarietiesList();
    if (v === 'history') renderHistoryView();
    Object.keys(FLOWS).forEach(key => showFlow(key, 'cta'));
}

// ---------- add flows (Payments, Parties, Varieties): button -> form -> success message ----------
const FLOWS = { pay: { focus: 'pDate', err: 'pErr' }, party: { focus: 'newPartyName', err: 'partyDupErr' }, variety: { focus: 'newVarietyName', err: 'varietyDupErr' } };
function showFlow(key, step) {
    document.getElementById(key + 'Cta').style.display = step === 'cta' ? 'flex' : 'none';
    document.getElementById(key + 'Panel').style.display = step === 'form' ? 'block' : 'none';
    const success = document.getElementById(key + 'Success');
    success.style.display = step === 'success' ? 'block' : 'none';
    if (step === 'success') success.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function openFlowForm(key) {
    document.getElementById(FLOWS[key].err).style.display = 'none';
    showFlow(key, 'form');
    document.getElementById(FLOWS[key].focus).focus();
}
function showFormError(el, message) {
    el.textContent = message;
    el.style.display = 'block';
}
document.querySelectorAll('.nav .item[data-view]').forEach(el => el.addEventListener('click', () => setView(el.dataset.view)));

// ---------- INVOICES ----------
function fillFilter(sel, allLabel, items) {
    const prev = sel.value;
    sel.innerHTML = `<option value="">${allLabel}</option>` + items.slice().sort(byName).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === prev) ? prev : '';
}
function toggleFilters(force) {
    const panel = document.getElementById('filterPanel');
    const open = typeof force === 'boolean' ? force : panel.classList.contains('hide');
    panel.classList.toggle('hide', !open);
    document.getElementById('filterBtn').setAttribute('aria-expanded', String(open));
}
function removeFilter(k) {
    if (k === 'from') writeDate('ffFrom', ''); else if (k === 'to') writeDate('ffTo', '');
    else document.getElementById({ party: 'ffParty', cat: 'ffCat', variety: 'ffVariety' }[k]).value = '';
    onSearch('invoices');
}
function clearFilters() {
    writeDate('ffFrom', ''); writeDate('ffTo', '');
    document.getElementById('ffParty').value = '';
    document.getElementById('ffVariety').value = '';
    document.getElementById('ffCat').value = '';
    onSearch('invoices');
}
function renderInvoices() {
    fillFilter(document.getElementById('ffParty'), 'All parties', parties);
    fillVarietySelect(document.getElementById('ffVariety'), 'All varieties', null, true);
    const fc = document.getElementById('ffCat').value;
    const from = readDate('ffFrom'), to = readDate('ffTo');
    const fp = document.getElementById('ffParty').value;
    const fvId = document.getElementById('ffVariety').value;
    const fv = fvId ? (varieties.find(v => String(v.id) === fvId) || {}).name : '';
    const filtered = invoices.filter(inv =>
        (!from || inv.date >= from) && (!to || inv.date <= to) &&
        (!fp || String(inv.partyId) === fp) && (!fv || inv.items.some(i => i.product === fv)) && (!fc || inv.items.some(i => i.category === fc)));
    const all = filtered.sort((a, b) => invNo(b) - invNo(a));
    const active = from || to || fp || fv || fc;
    const nActive = [from, to, fp, fv, fc].filter(Boolean).length;
    const badge = document.getElementById('filterCount');
    badge.textContent = nActive; badge.style.display = nActive ? 'inline-block' : 'none';
    document.getElementById('filterBtn').classList.toggle('on', nActive > 0);
    const chipList = [];
    if (from) chipList.push(['from', 'از ' + isoToDMY(from)]);
    if (to) chipList.push(['to', 'تا ' + isoToDMY(to)]);
    if (fp) { const pp = party(fp); chipList.push(['party', 'پارٹی: ' + (pp ? pp.name : '')]); }
    if (fc) chipList.push(['cat', 'کوالٹی: ' + CAT_UR[fc]]);
    if (fv) chipList.push(['variety', 'ورائٹی: ' + fv]);
    const chipsEl = document.getElementById('filterChips');
    chipsEl.style.display = chipList.length ? 'flex' : 'none';
    chipsEl.innerHTML = chipList.length ? `<span class="lbl"><svg class="ico" aria-hidden="true"><use href="#i-filter"/></svg>Filters applied:</span>` +
        chipList.map(([k, l]) => `<span class="chip">${esc(l)}<button onclick="removeFilter('${k}')" aria-label="Remove ${esc(l)}"><svg><use href="#i-x"/></svg></button></span>`).join('') +
        `<button class="clear-all" onclick="clearFilters()">Clear all</button>` : '';
    const sumTotal = all.reduce((s, i) => s + i.total, 0), sumDz = all.reduce((s, i) => s + invPieces(i), 0);
    document.getElementById('filterInfo').innerHTML = active
        ? `<span>${invoices.length} میں سے <b>${all.length}</b> بل</span><span>کل پیس <b>${fmt(sumDz)}</b>، کل رقم <b>${fmt(sumTotal)}</b></span>`
        : `<span><b>${invoices.length}</b> بل</span><span>کل پیس <b>${fmt(sumDz)}</b>، کل رقم <b>${fmt(sumTotal)}</b></span>`;
    const rows = paginate('invoices', all);
    const invOff = (pageState.invoices - 1) * PAGE_SIZE;
    document.getElementById('invoiceRows').innerHTML = rows.map((inv, ri) => {
        const p = party(inv.partyId);
        return `<tr><td class="rn"><span class="sn">${invOff + ri + 1}</span></td><td class="inv-no sm-text">${pad3(invNo(inv))}</td><td class="nw">${fmtDate(inv.date)}</td><td class="pname">${p ? nameHtml(p.name) : '-'}</td>
    <td class="sm-text">${esc(inv.shipping) || '-'}</td>
    <td class="num">${fmt(inv.total)}</td>
    <td class="act"><button class="icon-btn" title="View invoice" aria-label="View invoice" onclick="preview('${esc(inv.id)}')"><svg><use href="#i-eye"/></svg></button><button class="icon-btn" title="Edit" aria-label="Edit" onclick="event.stopPropagation();openEditInvoice('${esc(inv.id)}')"><svg><use href="#i-edit"/></svg></button>${delBtn(`deleteInvoice('${esc(inv.id)}')`)}</td></tr>`;
    }).join('') || `<tr><td colspan="7" class="empty">${active ? 'No invoices match these filters.' : t('noInvoices')}</td></tr>`;
    const next = pad3(nextInvNo());
    document.getElementById('ctaNextNo').textContent = next;
    document.getElementById('fNoBadge').textContent = next;
    refreshFormDropdowns();
}
RENDER.invoices = renderInvoices;
function fillSelect(sel, placeholder, items, addLabel) {
    const prev = sel.value;
    sel.innerHTML = `<option value="" disabled hidden>${placeholder}</option>`
        + (addLabel ? `<option value="new">${addLabel}</option>` : '')
        + items.slice().sort(byName).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === prev && prev !== '') ? prev : '';
}
function refreshFormDropdowns() {
    fillSelect(document.getElementById('fParty'), '-- Select party --', parties, '+ Add new party');
}
function openForm() {
    resetForm();
    document.getElementById('fParty').value = '';
    onPartyChange();
    document.getElementById('ctaBar').style.display = 'none';
    document.getElementById('successPanel').style.display = 'none';
    document.getElementById('formPanel').style.display = 'block';
}
function cancelForm() {
    document.getElementById('formPanel').style.display = 'none';
    document.getElementById('ctaBar').style.display = 'flex';
}
function closeSuccess() {
    document.getElementById('successPanel').style.display = 'none';
    document.getElementById('ctaBar').style.display = 'flex';
}
function resetForm() {
    document.getElementById('fShip').value = ''; document.getElementById('fNewParty').value = '';
    writeDate('fDate', todayISO());
    document.getElementById('fItems').innerHTML = '';
    { const sg = document.getElementById('fSign'); if (sg) sg.value = ''; }
    addItemRow('fItems');
    document.getElementById('formErr').style.display = 'none';
}
function onPartyChange() {
    document.getElementById('newPartyBox').style.display = document.getElementById('fParty').value === 'new' ? 'block' : 'none';
}
// ----- line item editor (shared by the new invoice form and the edit window) -----
const CAT_OPTS_HTML = Object.keys(CATS).map(c => `<option value="${c}">${CAT_UR[c]} (${SOLD_UR[c]})</option>`).join('');
function addItemRow(tbodyId, item) {
    const tb = document.getElementById(tbodyId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rn"></td>
    <td><select class="it-var" aria-label="Variety"></select>
      <div class="new-var"><input type="text" class="it-newname" placeholder="New variety name" aria-label="New variety name"><select class="it-newcat" aria-label="Category">${CAT_OPTS_HTML}</select></div></td>
    <td><div class="qty-wrap"><input type="text" inputmode="numeric" autocomplete="off" class="int it-qty" aria-label="تعداد"><span class="u"></span></div><div class="sub-hint it-pcs"></div></td>
    <td><div class="qty-wrap rate-wrap"><input type="text" inputmode="numeric" autocomplete="off" class="int it-rate" aria-label="ریٹ"><span class="u" dir="ltr">/-</span></div><div class="sub-hint it-per"></div></td>
    <td class="num amt">0</td>
    <td class="act"><button type="button" class="icon-btn it-del" title="Remove item" aria-label="Remove item"><svg><use href="#i-x"/></svg></button></td>`;
    tb.appendChild(tr);
    const sel = tr.querySelector('.it-var');
    fillVarietySelect(sel, '-- کوالٹی --', '+ Add new variety');
    if (item) {
        const v = varieties.find(x => x.id === item.varietyId);
        if (v) sel.value = String(v.id);
        else { sel.value = 'new'; tr.querySelector('.it-newname').value = item.product; tr.querySelector('.it-newcat').value = item.category || 'Romal'; }
        tr.querySelector('.it-qty').value = item.qty;
        tr.querySelector('.it-rate').value = item.price;
    }
    sel.addEventListener('change', () => refreshItems(tbodyId));
    tr.querySelector('.it-newcat').addEventListener('change', () => refreshItems(tbodyId));
    tr.querySelector('.it-qty').addEventListener('input', () => refreshItems(tbodyId));
    tr.querySelector('.it-rate').addEventListener('input', () => refreshItems(tbodyId));
    tr.querySelector('.it-del').addEventListener('click', () => {
        if (tb.children.length > 1) tr.remove();
        else { sel.value = ''; tr.querySelector('.it-qty').value = ''; tr.querySelector('.it-rate').value = ''; }
        refreshItems(tbodyId);
    });
    refreshItems(tbodyId);
    if (!item && tb.children.length > 1) sel.focus();
}
function rowCategory(tr) {
    const sel = tr.querySelector('.it-var').value;
    if (sel === 'new') return tr.querySelector('.it-newcat').value;
    const v = varieties.find(x => String(x.id) === sel);
    return v ? catOf(v) : null;
}
const BILL_ROWS = 6;
function renderFiller() {
    const fill = document.getElementById('fFill'); if (!fill) return;
    const n = document.getElementById('fItems').children.length;
    const blanks = Math.max(1, BILL_ROWS - n);
    let html = `<tr class="bf-next"><td class="rn"><button type="button" class="bf-plus" onclick="addItemRow('fItems')" title="آئٹم شامل کریں" aria-label="آئٹم شامل کریں"><svg><use href="#i-plus"/></svg></button></td><td></td><td></td><td></td><td class="amt"></td><td class="act"></td></tr>`;
    for (let i = 1; i < blanks; i++) html += `<tr class="bf-blank"><td class="rn"></td><td></td><td></td><td></td><td class="amt"></td><td class="act"></td></tr>`;
    fill.innerHTML = html;
}
function refreshItems(tbodyId) {
    if (tbodyId === 'fItems') renderFiller();
    const tb = document.getElementById(tbodyId);
    let total = 0;
    [...tb.children].forEach((tr, i) => {
        tr.querySelector('.rn').innerHTML = `<span class="sn">${i + 1}</span>`;
        const isNew = tr.querySelector('.it-var').value === 'new';
        tr.querySelector('.new-var').classList.toggle('on', isNew);
        const c = rowCategory(tr);
        const q = intOf(tr.querySelector('.it-qty')), r = intOf(tr.querySelector('.it-rate'));
        tr.querySelector('.u').textContent = c ? unitName(CATS[c].unit) : '';
        tr.querySelector('.it-per').textContent = c ? `فی ${unitName(CATS[c].unit)}` : '';
        tr.querySelector('.it-pcs').textContent = (c && c !== 'Shawl' && q > 0) ? `= ${fmt(pcsOf(q, CATS[c].unit))} پیس` : '';
        tr.querySelector('.amt').textContent = fmt(q * r);
        total += q * r;
    });
    const totalEl = document.getElementById(tbodyId === 'fItems' ? 'fTotal' : 'eiTotal');
    if (totalEl) totalEl.textContent = fmt(total);
}
// Reads and validates the rows. Creates any new varieties on save.
async function collectItems(tbodyId) {
    const rows = [...document.getElementById(tbodyId).children];
    const items = [];
    for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const sel = tr.querySelector('.it-var').value;
        const q = intOf(tr.querySelector('.it-qty')), r = intOf(tr.querySelector('.it-rate'));
        const newName = tr.querySelector('.it-newname').value.trim();
        const blank = !sel && !tr.querySelector('.it-qty').value && !tr.querySelector('.it-rate').value;
        if (blank && rows.length > 1) continue;
        if (!sel || (sel === 'new' && !newName)) return { error: `آئٹم ${i + 1}: ورائٹی منتخب کریں۔` };
        if (!(q > 0)) return { error: `آئٹم ${i + 1}: مقدار درج کریں۔` };
        if (!(r > 0)) return { error: `آئٹم ${i + 1}: ریٹ درج کریں۔` };
        items.push({ sel, newName, newCat: tr.querySelector('.it-newcat').value, qty: q, price: r });
    }
    if (!items.length) return { error: 'Add at least one item.' };
    const out = [];
    for (const it of items) {
        let v;
        if (it.sel === 'new') {
            v = varieties.find(x => x.name.trim().toLowerCase() === it.newName.toLowerCase());
            if (!v) {
                v = await api('POST', '/api/varieties', { name: it.newName, category: it.newCat });
                varieties.push(v);
            }
        } else v = varieties.find(x => String(x.id) === it.sel);
        const c = catOf(v);
        out.push({ varietyId: v.id, product: v.name, category: c, qty: it.qty, unit: CATS[c].unit, price: it.price, total: it.qty * it.price });
    }
    return { items: out };
}
function isDupName(list, name) { return list.some(x => x.name.trim().toLowerCase() === name.trim().toLowerCase()); }
let saving = false;
async function saveInvoice() {
    if (saving) return;
    const selP = document.getElementById('fParty').value;
    const date = readDate('fDate');
    const shipping = document.getElementById('fShip').value.trim();
    const newPartyName = document.getElementById('fNewParty').value.trim();
    const err = document.getElementById('formErr');
    const fail = msg => { err.textContent = msg; err.style.display = 'block'; };
    if (!selP || (selP === 'new' && !newPartyName)) return fail('Choose a party.');
    if (!date) return fail('Enter a valid date (dd/mm/yyyy).');
    err.style.display = 'none';
    saving = true;
    try {
        const res = await collectItems('fItems');
        if (res.error) { fail(res.error); return; }

        let partyId;
        if (selP === 'new') {
            const existing = parties.find(p => p.name.trim().toLowerCase() === newPartyName.toLowerCase());
            if (existing) { partyId = existing.id; }
            else { const np = await api('POST', '/api/parties', { name: newPartyName }); parties.push(np); partyId = np.id; }
        } else { partyId = selP; }

        const signedBy = (document.getElementById('fSign') || {}).value || '';
        const saved = await api('POST', '/api/invoices', {
            date, party_id: partyId, shipping_no: shipping, signed_by: signedBy,
            items: res.items.map(i => ({ variety_id: i.varietyId, qty: i.qty, price: i.price }))
        });
        await loadAll();
        const inv = invoices.find(i => i.id === saved.id);
        const p = party(partyId);
        pageState.invoices = 1;
        renderInvoices();
        showSuccess(inv, p);
    } catch (e) { fail(e.message); }
    finally { saving = false; }
}
function showSuccess(inv, p) {
    document.getElementById('formPanel').style.display = 'none';
    document.getElementById('ctaBar').style.display = 'none';
    document.getElementById('successTitle').textContent = `بل ${pad3(inv.no)} بن گیا`;
    document.getElementById('successText').textContent =
        `${p.name}: ${inv.items.length === 1 ? itemsLine(inv) : `${inv.items.length} آئٹمز (${qtySummary(inv)})`}۔ کل رقم ${fmt(inv.total)}۔ پارٹی کے کھاتے میں درج کر دی گئی۔`;
    document.getElementById('successView').onclick = () => preview(inv.id);
    const s = document.getElementById('successPanel');
    s.style.display = 'block';
    s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
const BILL_BRAND = `
      <div class="bp-brand">
        <div class="bp-phones">
          <span class="nm">حاجی ایم اسلم</span><b dir="ltr">0333-7638272</b>
          <span class="nm">حاجی قیصر شہزاد</span><b dir="ltr">0300-7301442</b>
          <span class="nm">حاجی افضل شہزاد</span><b dir="ltr">0301-7475473</b>
        </div>
        <div class="bp-logo">
          <svg viewBox="0 0 240 190" width="124" height="98" role="img" aria-label="BS">
            <rect x="0" y="0" width="240" height="190" fill="#5B50B4"/>
            <path d="M24 34H212V148H186L218 178L150 148H24Z" fill="#FFFFFF" stroke="#3B3290" stroke-width="2.5" stroke-linejoin="round"/>
            <text x="121" y="131" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="92" fill="#8E3F16" opacity=".55">BS</text>
            <text x="118" y="128" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="92" fill="#F0823F">BS</text>
          </svg>
          <div class="bp-mail" dir="ltr">E-mail: faisal.shahzad5@yahoo.com</div>
        </div>
        <div class="bp-addr">
          <div>پلاٹ نمبر <span class="n" dir="ltr">206-207</span>، گلی نمبر <span class="n">1</span>، شاہین آباد</div>
          <div>نزد چونگی نمبر <span class="n">11</span>، انصار کالونی روڈ ملتان</div>
        </div>
      </div>
`;
document.getElementById('fBrand').innerHTML = BILL_BRAND;
function preview(id) {
    const inv = invoices.find(i => String(i.id) === String(id));
    const p = party(inv.partyId);
    showBill(inv, p ? p.name : '');
}
// also used for deleted bills in History, whose snapshot carries the party name instead of a partyId
function showBill(inv, partyName) {
    const MIN_ROWS = 10;
    const rows = inv.items.map((i, n) => `<tr>
      <td class="b-sn"><span dir="ltr">${n + 1}</span></td>
      <td class="b-desc">${nameHtml(i.product)} <span class="b-cat">(${CAT_UR[i.category]})</span></td>
      <td class="b-qty"><span dir="ltr">${i.qty}</span> ${unitName(i.unit)}</td>
      <td class="b-rate"><span dir="ltr">${fmt(i.price)}/-</span></td>
      <td class="b-amt"><span dir="ltr">${fmt(i.total)}</span></td></tr>`).join('')
        + Array.from({ length: Math.max(0, MIN_ROWS - inv.items.length) }, () => '<tr class="b-empty"><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    document.getElementById('previewBody').innerHTML = `
    <div class="bill-paper">
      ${BILL_BRAND}
      <div class="bp-meta">
        <div class="bm-cell bm-no"><span class="bm-lbl">نمبر</span><span class="bm-val bm-num" dir="ltr">${pad3(invNo(inv))}</span></div>
        <div class="bm-cell bm-side"><span class="bm-lbl">تاریخ</span><span class="bm-val" dir="ltr">${fmtDate(inv.date).replace(/\//g, '-')}</span></div>
        <div class="bm-cell bm-name"><span class="bm-lbl">بل بنام</span><span class="bm-val">${nameHtml(partyName)}</span></div>
        <div class="bm-cell bm-side"><span class="bm-lbl">بلٹی نمبر</span><span class="bm-val" dir="ltr">${esc(inv.shipping || '')}</span></div>
      </div>
      <table class="bp-tbl">
        <thead><tr><th class="b-sn">نمبر</th><th class="b-desc">تفصیل</th><th class="b-qty">تعداد</th><th class="b-rate">ریٹ</th><th class="b-amt">کل رقم</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td class="b-sign" colspan="3"><span>دستخط</span><span class="bp-dots">${esc(inv.signedBy || '')}</span></td><td class="b-total-lbl">میزان</td><td class="b-amt b-total"><span dir="ltr">${fmt(inv.total)}</span></td></tr></tfoot>
      </table>
    </div>
    <div class="modal-close"><button class="btn ghost" onclick="closePreview()">${t('closeBtn')}</button></div>
  `;
    document.getElementById('previewBody').classList.add('wide', 'bill-modal');
    document.getElementById('previewBg').style.display = 'flex';
}
function closePreview() { document.getElementById('previewBg').style.display = 'none'; }

// ---------- LEDGER ----------
function renderLedgerView() {
    fillSelect(document.getElementById('ledgerPartySel'), '-- Select party --', parties, null);
    if (selectedPartyId) document.getElementById('ledgerPartySel').value = String(selectedPartyId);
    renderLedger();
}
function openLedger() {
    const val = document.getElementById('ledgerPartySel').value;
    const err = document.getElementById('pickErr');
    if (!val) { err.style.display = 'block'; return; }
    err.style.display = 'none';
    selectedPartyId = val;
    pageState.ledger = 1;
    togglePayBox(false);
    document.getElementById('ledgerOk').style.display = 'none';
    renderLedger();
    document.getElementById('ledgerPanel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function goToLedger(id) {
    selectedPartyId = String(id);
    setView('ledger');
    document.getElementById('ledgerPartySel').value = String(id);
    openLedger();
}
function togglePayBox(force) {
    const box = document.getElementById('payBox');
    const show = typeof force === 'boolean' ? force : box.style.display !== 'block';
    box.style.display = show ? 'block' : 'none';
    document.getElementById('addPayBtn').style.display = show ? 'none' : '';
    if (show) {
        writeDate('payDate', '');
        document.getElementById('payAmt').value = '';
        document.getElementById('payErr').style.display = 'none';
        document.getElementById('ledgerOk').style.display = 'none';
        document.getElementById('payDate').focus();
    }
}
function toggleOrder() {
    ledgerNewestFirst = !ledgerNewestFirst;
    pageState.ledger = 1;
    renderLedger();
}
function renderLedger() {
    const p = party(selectedPartyId);
    const panel = document.getElementById('ledgerPanel');
    if (!p) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    document.getElementById('selName').innerHTML = nameHtml(p.name);
    const ordered = p.entries.map((e, idx) => ({ e, idx })).sort((a, b) => new Date(a.e.date) - new Date(b.e.date));
    const nInv = ordered.filter(x => x.e.type === 'credit').length, nPay = ordered.length - nInv;
    const last = ordered.length ? fmtDate(ordered[ordered.length - 1].e.date) : '';
    document.getElementById('selSub').textContent = ordered.length
        ? `${nInv} بل، ${nPay} ادائیگیاں۔ آخری اندراج ${last}۔`
        : 'ابھی کوئی اندراج نہیں۔';
    document.getElementById('entryCount').textContent = ordered.length ? `کل ${ordered.length}` : '';
    const totInv = ordered.filter(x => x.e.type === 'credit').reduce((s, x) => s + x.e.amount, 0);
    const totPay = ordered.filter(x => x.e.type === 'debit').reduce((s, x) => s + x.e.amount, 0);
    const bal = totInv - totPay;
    document.getElementById('sumInv').textContent = fmt(totInv);
    document.getElementById('sumPay').textContent = fmt(totPay);
    document.getElementById('sumBal').textContent = fmt(bal);
    document.getElementById('sumBalLabel').textContent = bal > 0 ? 'Balance due' : bal < 0 ? 'Advance paid' : 'Settled';
    document.querySelector('.lg-summary .due').classList.toggle('clear', bal <= 0);
    document.getElementById('orderLabel').textContent = ledgerNewestFirst ? 'Newest first' : 'Oldest first';
    { const ob = document.getElementById('orderBtn'); const tt = ledgerNewestFirst ? 'نئے پہلے، الٹنے کے لیے کلک کریں' : 'پرانے پہلے، الٹنے کے لیے کلک کریں'; ob.title = tt; ob.setAttribute('aria-label', tt); ob.classList.toggle('on', ledgerNewestFirst); }
    document.getElementById('ledgerEmpty').style.display = ordered.length ? 'none' : 'block';

    let running = 0;
    const withBal = ordered.map((x, n) => { running += (x.e.type === 'credit' ? x.e.amount : -x.e.amount); return { ...x, bal: running, n: n + 1 }; });
    if (ledgerNewestFirst) withBal.reverse();
    const rows = paginate('ledger', withBal);
    const dash = '<span class="dash">-</span>';
    document.getElementById('ledgerRows').innerHTML = rows.map(({ e, idx, bal, n }) => {
        const isInv = e.type === 'credit';
        const invNoStr = e.note.split('|')[1];
        const lInv = isInv ? invoiceByNo(invNoStr) : null;
        const editCall = isInv ? `openEditInvoiceByNo('${esc(invNoStr)}')` : `openEditPayment('${esc(p.id)}',${idx})`;
        const delCall = isInv ? `deleteInvoice('${esc(e.invoiceId)}')` : `deletePayment('${esc(p.id)}',${idx})`;
        const method = t(e.note);
        return `<tr>
      <td class="rn"><span class="sn">${n}</span></td>
      <td class="nw">${fmtDate(e.date)}</td>
      <td>${isInv ? '<span class="tag inv"><svg><use href="#i-invoice"/></svg>Invoice</span>' : '<span class="tag pay"><svg><use href="#i-cash"/></svg>Payment</span>'}</td>
      <td class="nw">${isInv ? `<span class="inv-no">بل نمبر ${pad3(invNoStr)}</span>` : `<span class="tag m-${esc(method)}">${esc(method)}</span>`}</td>
      <td class="num">${isInv ? `<span class="amt-inv">${fmt(e.amount)}</span>` : dash}</td>
      <td class="num">${!isInv ? `<span class="amt-pay">${fmt(e.amount)}</span>` : dash}</td>
      <td class="num c-bal">${fmt(bal)}</td>
      <td class="act">${lInv ? `<button class="icon-btn" title="View invoice" aria-label="View invoice" onclick="event.stopPropagation();preview('${esc(lInv.id)}')"><svg><use href="#i-eye"/></svg></button>` : '<span class="icon-gap"></span>'}<button class="icon-btn" title="Edit" aria-label="Edit" onclick="event.stopPropagation();${editCall}"><svg><use href="#i-edit"/></svg></button>${delBtn(delCall)}</td></tr>`;
    }).join('');
    document.getElementById('ledgerFoot').innerHTML = ordered.length ? `<tr>
    <td colspan="4">Closing balance</td>
    <td class="num">${fmt(totInv)}</td><td class="num">${fmt(totPay)}</td><td class="num c-bal">${fmt(bal)}</td><td></td></tr>` : '';
}
RENDER.ledger = renderLedger;
async function postPayment(pid, date, method, amt) {
    await api('POST', '/api/payments', { party_id: pid, date, method, amount: amt });
    await loadAll();
    return party(pid);
}
async function addPayment() {
    const date = readDate('payDate');
    const method = document.getElementById('payMethod').value;
    const amt = intOf(document.getElementById('payAmt'));
    const err = document.getElementById('payErr');
    if (!date || amt <= 0) { err.style.display = 'block'; return; }
    err.style.display = 'none';
    try { await postPayment(selectedPartyId, date, method, amt); } catch (e) { alert(e.message); return; }
    togglePayBox(false);
    const ok = document.getElementById('ledgerOk');
    ok.textContent = `${fmt(amt)} کی ادائیگی (${UR[method] || method}) ${isoToDMY(date)} کو درج ہو گئی۔`;
    ok.style.display = 'block';
    renderLedger();
}

// ---------- PAYMENTS ----------
function renderPaymentsView() {
    fillSelect(document.getElementById('pParty'), '-- Select party --', parties, null);
    renderPayments();
}
function renderPayments() {
    const q = (document.getElementById('paySearch').value || '').trim().toLowerCase();
    const all = [];
    parties.forEach(p => p.entries.forEach((e, i) => {
        if (e.type === 'debit' && p.name.toLowerCase().includes(q)) all.push({ p, e, i });
    }));
    all.sort((a, b) => String(b.e.date).localeCompare(String(a.e.date)) || b.i - a.i);
    const rows = paginate('payments', all);
    const payOff = (pageState.payments - 1) * PAGE_SIZE;
    document.getElementById('paymentRows').innerHTML = rows.map(({ p, e, i }, ri) =>
        `<tr><td class="rn"><span class="sn">${payOff + ri + 1}</span></td><td class="nw">${fmtDate(e.date)}</td><td class="pname">${nameHtml(p.name)}</td><td><span class="tag m-${esc(t(e.note))}">${esc(t(e.note))}</span></td><td class="num">${fmt(e.amount)}</td>
    <td class="act"><button class="icon-btn" title="Edit" aria-label="Edit" onclick="event.stopPropagation();openEditPayment('${esc(p.id)}',${i})"><svg><use href="#i-edit"/></svg></button>${delBtn(`deletePayment('${esc(p.id)}',${i})`)}</td></tr>`
    ).join('') || `<tr><td colspan="6" class="empty">No payments yet.</td></tr>`;
}
RENDER.payments = renderPayments;
async function recordPaymentTab() {
    const date = readDate('pDate');
    const pid = document.getElementById('pParty').value;
    const method = document.getElementById('pMethod').value;
    const amt = intOf(document.getElementById('pAmt'));
    const err = document.getElementById('pErr');
    if (!date || !pid || !method || amt <= 0) { err.style.display = 'block'; return; }
    err.style.display = 'none';
    let p; try { p = await postPayment(pid, date, method, amt); } catch (e) { alert(e.message); return; }
    writeDate('pDate', '');
    document.getElementById('pParty').value = '';
    document.getElementById('pAmt').value = '';
    document.getElementById('paySuccessText').textContent = `${p.name} سے ${fmt(amt)} (${UR[method] || method}) بتاریخ ${isoToDMY(date)}۔ ان کے کھاتے میں شامل کر دی گئی۔`;
    showFlow('pay', 'success');
    pageState.payments = 1;
    renderPayments();
}

// ---------- PARTIES ----------
async function addPartyStandalone() {
    const input = document.getElementById('newPartyName');
    const name = input.value.trim();
    const err = document.getElementById('partyDupErr');
    if (!name) { showFormError(err, 'پارٹی کا نام درج کریں۔'); return; }
    if (isDupName(parties, name)) { showFormError(err, 'یہ پارٹی پہلے سے موجود ہے۔'); return; }
    err.style.display = 'none';
    try { const np = await api('POST', '/api/parties', { name }); parties.push({ id: np.id, name: np.name, entries: [] }); }
    catch (e) { showFormError(err, e.message); return; }
    input.value = '';
    document.getElementById('partySuccessText').textContent = `${name} کو پارٹیوں میں شامل کر دیا گیا۔`;
    showFlow('party', 'success');
    renderPartiesList();
}
function renderPartiesList() {
    const q = (document.getElementById('partySearch').value || '').trim().toLowerCase();
    const all = parties.filter(p => p.name.toLowerCase().includes(q)).sort(byName);
    const rows = paginate('parties', all);
    const off = (pageState.parties - 1) * PAGE_SIZE;
    document.getElementById('partiesListRows').innerHTML = rows.map((p, i) => {
        const bal = balance(p);
        return `<tr class="row" onclick="goToLedger('${esc(p.id)}')"><td class="rn"><span class="sn">${off + i + 1}</span></td><td class="nm">${nameHtml(p.name)}</td><td class="num" style="color:${bal > 0 ? 'var(--clay)' : 'var(--teal)'};font-weight:600">${fmt(bal)}</td>
    <td class="act"><button class="icon-btn" title="ترمیم" aria-label="ترمیم" onclick="event.stopPropagation();openEditName('party','${esc(p.id)}')"><svg><use href="#i-edit"/></svg></button>${delBtn(`deleteName('party','${esc(p.id)}')`)}</td></tr>`;
    }).join('') || `<tr><td colspan="4" class="empty">کوئی پارٹی نہیں ملی۔</td></tr>`;
}
RENDER.parties = renderPartiesList;

// ---------- VARIETIES ----------
async function addVarietyStandalone() {
    const input = document.getElementById('newVarietyName');
    const name = input.value.trim();
    const category = document.getElementById('newVarietyCat').value;
    const err = document.getElementById('varietyDupErr');
    if (!name) { showFormError(err, 'ورائٹی کا نام درج کریں۔'); return; }
    if (isDupName(varieties, name)) { showFormError(err, 'یہ ورائٹی پہلے سے موجود ہے۔'); return; }
    err.style.display = 'none';
    try { const nv = await api('POST', '/api/varieties', { name, category }); varieties.push(nv); }
    catch (e) { showFormError(err, e.message); return; }
    input.value = '';
    document.getElementById('varietySuccessText').textContent = `${name} (${CAT_UR[category]}) ورائٹیز میں شامل کر دی گئی۔`;
    showFlow('variety', 'success');
    renderVarietiesList();
}
function renderVarietiesList() {
    const q = (document.getElementById('varietySearch').value || '').trim().toLowerCase();
    const fc = document.getElementById('varietyCatFilter').value;
    const order = Object.keys(CATS);
    const all = varieties.filter(v => v.name.toLowerCase().includes(q) && (!fc || catOf(v) === fc))
        .sort((a, b) => order.indexOf(catOf(a)) - order.indexOf(catOf(b)) || byName(a, b));
    const rows = paginate('varieties', all);
    const off = (pageState.varieties - 1) * PAGE_SIZE;
    document.getElementById('varietiesListRows').innerHTML = rows.map((v, i) => {
        const c = catOf(v);
        return `<tr><td class="rn"><span class="sn">${off + i + 1}</span></td><td class="nm">${nameHtml(v.name)}</td><td><span class="cat ${c}">${CAT_UR[c]}</span></td><td>${SOLD_UR[c]}</td>
    <td class="act"><button class="icon-btn" title="ترمیم" aria-label="ترمیم" onclick="event.stopPropagation();openEditName('variety','${esc(v.id)}')"><svg><use href="#i-edit"/></svg></button>${delBtn(`deleteName('variety','${esc(v.id)}')`)}</td></tr>`;
    }).join('') || `<tr><td colspan="5" class="empty">کوئی ورائٹی نہیں ملی۔</td></tr>`;
}
RENDER.varieties = renderVarietiesList;

// ---------- HISTORY ----------
// read-only: deleted bills/payments and a before/after log of edits, fetched each time the view opens
let historyData = { deleted: [], edits: [] };
async function renderHistoryView() {
    const err = document.getElementById('historyErr');
    err.style.display = 'none';
    try { historyData = await api('GET', '/api/history'); }
    catch (e) { showFormError(err, e.message); return; }
    pageState.historyDeleted = 1; pageState.historyEdits = 1;
    renderDeleted();
    renderEdits();
}
function fmtDateTime(s) { const [d, tm] = String(s || '').split(' '); return `${fmtDate(d)} <span class="sm-text" dir="ltr">${esc(tm || '')}</span>`; }
function whoWhen(at, by) { return `<span class="nw">${fmtDateTime(at)}</span>${by ? `<div class="sm-text">${nameHtml(by)}</div>` : ''}`; }
function typeTag(type) {
    return type === 'invoice' ? '<span class="tag inv"><svg><use href="#i-invoice"/></svg>بل</span>' : '<span class="tag pay"><svg><use href="#i-cash"/></svg>ادائیگی</span>';
}
function recordLabel(type, r) { return type === 'invoice' ? `<span class="inv-no">بل نمبر ${pad3(r.no)}</span>` : `<span class="tag m-${esc(r.method)}">${esc(UR[r.method] || r.method)}</span>`; }
function renderDeleted() {
    const all = historyData.deleted;
    document.getElementById('deletedCount').textContent = all.length ? `کل ${all.length}` : '';
    const rows = paginate('historyDeleted', all);
    const off = (pageState.historyDeleted - 1) * PAGE_SIZE;
    document.getElementById('deletedRows').innerHTML = rows.map((d, ri) => {
        const r = d.record, isInv = d.type === 'invoice';
        return `<tr><td class="rn"><span class="sn">${off + ri + 1}</span></td><td>${typeTag(d.type)}</td><td class="nw">${recordLabel(d.type, r)}</td>
    <td class="pname">${nameHtml(r.party || '-')}</td><td class="nw">${fmtDate(r.date)}</td><td class="num">${fmt(isInv ? r.total : r.amount)}</td><td>${whoWhen(d.deletedAt, d.by)}</td>
    <td class="act">${isInv ? `<button class="icon-btn" title="بل دیکھیں" aria-label="بل دیکھیں" onclick="showBill(historyData.deleted[${off + ri}].record, historyData.deleted[${off + ri}].record.party)"><svg><use href="#i-eye"/></svg></button>` : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="8" class="empty">ابھی کوئی حذف شدہ بل یا ادائیگی نہیں۔</td></tr>`;
}
RENDER.historyDeleted = renderDeleted;
function itemsText(items) { return (items || []).map(i => `${i.product} ${i.qty} ${unitName(i.unit)} × ${fmt(i.price)}`).join('، '); }
// [label, value as shown] for each field that can be edited, compared before vs after
const HISTORY_FIELDS = {
    invoice: [['تاریخ', r => fmtDate(r.date)], ['پارٹی', r => r.party || '-'], ['بلٹی نمبر', r => r.shipping || '-'], ['دستخط', r => r.signedBy || '-'], ['آئٹمز', r => itemsText(r.items)], ['کل رقم', r => fmt(r.total)]],
    payment: [['تاریخ', r => fmtDate(r.date)], ['پارٹی', r => r.party || '-'], ['ادائیگی کی قسم', r => UR[r.method] || r.method], ['رقم', r => fmt(r.amount)]]
};
function changesHtml(type, before, after) {
    return HISTORY_FIELDS[type].map(([label, show]) => [label, show(before), show(after)]).filter(([, a, b]) => a !== b)
        .map(([label, a, b]) => `<div class="chg"><span class="k">${label}:</span> <bdi class="old">${esc(a)}</bdi> ← <bdi class="new">${esc(b)}</bdi></div>`).join('');
}
function renderEdits() {
    const all = historyData.edits;
    document.getElementById('editsCount').textContent = all.length ? `کل ${all.length}` : '';
    const rows = paginate('historyEdits', all);
    const off = (pageState.historyEdits - 1) * PAGE_SIZE;
    document.getElementById('editRows').innerHTML = rows.map((e, ri) =>
        `<tr><td class="rn"><span class="sn">${off + ri + 1}</span></td><td>${whoWhen(e.at, e.by)}</td><td>${typeTag(e.type)}</td>
    <td class="nw">${recordLabel(e.type, e.after)}${e.type === 'payment' ? `<div class="sm-text">${nameHtml(e.after.party || '')}</div>` : ''}</td><td class="changes">${changesHtml(e.type, e.before, e.after)}</td></tr>`
    ).join('') || `<tr><td colspan="5" class="empty">ابھی کوئی ترمیم نہیں۔ ترامیم آج سے ریکارڈ ہو رہی ہیں۔</td></tr>`;
}
RENDER.historyEdits = renderEdits;

// ---------- EDITING ----------
let editCtx = null;
function showEdit(kind, title, sub) {
    ['editInvoice', 'editPayment', 'editName'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(kind).style.display = 'grid';
    document.getElementById('editTitle').textContent = title;
    document.getElementById('editSub').textContent = sub || '';
    document.getElementById('editErr').style.display = 'none';
    document.getElementById('editSaveBtn').disabled = false;
    const m = document.querySelector('#editBg .modal');
    document.getElementById('editCancelTxt').textContent = 'منسوخ کریں';
    document.getElementById('editSaveBtn').textContent = 'محفوظ کریں';
    m.classList.toggle('wide', kind === 'editInvoice');
    document.getElementById('editBg').style.display = 'flex';
}
function closeEdit() { document.getElementById('editBg').style.display = 'none'; editCtx = null; }
function editError(msg) { const e = document.getElementById('editErr'); e.textContent = msg; e.style.display = 'block'; }
function openEditInvoiceByNo(no) {
    const inv = invoices.find(i => String(invNo(i)) === String(parseInt(no, 10)));
    if (inv) openEditInvoice(inv.id);
}
function openEditInvoice(id) {
    const inv = invoices.find(i => String(i.id) === String(id));
    if (!inv) return;
    editCtx = { kind: 'invoice', id: inv.id };
    fillSelect(document.getElementById('eiParty'), '-- Select party --', parties, null);
    document.getElementById('eiParty').value = String(inv.partyId);
    writeDate('eiDate', inv.date);
    document.getElementById('eiShip').value = inv.shipping || '';
    document.getElementById('eiItems').innerHTML = '';
    inv.items.forEach(it => addItemRow('eiItems', it));
    showEdit('editInvoice', `بل ${pad3(invNo(inv))} میں ترمیم`, 'تبدیلیاں پارٹی کے کھاتے میں بھی ہو جائیں گی۔');
}
function openEditPayment(pid, idx) {
    const p = party(pid); const e = p && p.entries[idx];
    if (!e || e.type !== 'debit') return;
    editCtx = { kind: 'payment', pid: String(pid), idx };
    fillSelect(document.getElementById('epParty'), '-- Select party --', parties, null);
    document.getElementById('epParty').value = String(pid);
    writeDate('epDate', e.date);
    document.getElementById('epMethod').value = t(e.note);
    document.getElementById('epAmt').value = e.amount;
    showEdit('editPayment', 'Edit payment', `${p.name}, ${fmtDate(e.date)}`);
}
function openEditName(kind, id) {
    const item = kind === 'party' ? party(id) : varieties.find(v => String(v.id) === String(id));
    if (!item) return;
    editCtx = { kind, id: String(id) };
    document.getElementById('enLabel').textContent = kind === 'party' ? 'پارٹی کا نام' : 'ورائٹی کا نام';
    document.getElementById('enName').value = item.name;
    document.getElementById('enCatBox').style.display = kind === 'variety' ? 'block' : 'none';
    if (kind === 'variety') document.getElementById('enCat').value = catOf(item);
    showEdit('editName', kind === 'party' ? 'پارٹی کا نام تبدیل کریں' : 'ورائٹی میں ترمیم',
        kind === 'variety' ? 'پرانے بل اپنی اکائی برقرار رکھیں گے۔ نئی کوالٹی آئندہ بلوں پر لاگو ہوگی۔' : '');
    document.getElementById('enName').focus();
}
async function saveEdit() {
    if (!editCtx) return;
    const btn = document.getElementById('editSaveBtn');
    const busy = () => { btn.disabled = true; btn.textContent = 'محفوظ ہو رہا ہے...'; };
    const idle = () => { btn.disabled = false; btn.textContent = 'محفوظ کریں'; };
    try {
        if (editCtx.kind === 'invoice') {
            const date = readDate('eiDate'), pid = document.getElementById('eiParty').value;
            if (!date || !pid) { editError('Fill in a valid date (dd/mm/yyyy) and party.'); return; }
            busy();
            const res = await collectItems('eiItems');
            if (res.error) { editError(res.error); idle(); return; }
            const inv = invoices.find(i => String(i.id) === String(editCtx.id));
            await api('PUT', '/api/invoices/' + inv.id, {
                date, party_id: pid, shipping_no: document.getElementById('eiShip').value.trim(), signed_by: inv.signedBy || '',
                items: res.items.map(i => ({ variety_id: i.varietyId, qty: i.qty, price: i.price }))
            });
        }
        else if (editCtx.kind === 'payment') {
            const date = readDate('epDate'), pid = document.getElementById('epParty').value;
            const method = document.getElementById('epMethod').value, amt = intOf(document.getElementById('epAmt'));
            if (!date || !pid || !(amt > 0)) { editError('Fill in a valid date (dd/mm/yyyy), party and amount.'); return; }
            busy();
            const e = party(editCtx.pid).entries[editCtx.idx];
            await api('PUT', '/api/payments/' + e.id, { party_id: pid, date, method, amount: amt });
        }
        else {
            const name = document.getElementById('enName').value.trim();
            const list = editCtx.kind === 'party' ? parties : varieties;
            if (!name) { editError('نام خالی نہیں ہو سکتا۔'); return; }
            if (list.some(x => String(x.id) !== editCtx.id && x.name.trim().toLowerCase() === name.toLowerCase())) { editError('یہ نام پہلے سے موجود ہے۔'); return; }
            busy();
            if (editCtx.kind === 'party') await api('PUT', '/api/parties/' + editCtx.id, { name });
            else await api('PUT', '/api/varieties/' + editCtx.id, { name, category: document.getElementById('enCat').value });
        }
        await loadAll();
    } catch (e) { editError(e.message); idle(); return; }
    closeEdit();
    refreshView();
}
function refreshView() {
    const v = currentView();
    if (v === 'invoices') renderInvoices(); else if (v === 'ledger') renderLedger(); else setView(v);
}

// ---------- DELETING ----------
let confirmAction = null;
function delBtn(call) {
    return `<button class="icon-btn del" title="حذف کریں" aria-label="حذف کریں" onclick="event.stopPropagation();${call}"><svg><use href="#i-trash"/></svg></button>`;
}
// Asks "are you sure?" first. If `blocked` is set the record can't be deleted, so only the reason is shown.
function confirmDelete({ title, text, action, blocked }) {
    confirmAction = blocked ? null : action;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    const err = document.getElementById('confirmErr');
    err.textContent = blocked || '';
    err.style.display = blocked ? 'block' : 'none';
    const yes = document.getElementById('confirmYes');
    yes.style.display = blocked ? 'none' : '';
    yes.disabled = false; document.getElementById('confirmYesTxt').textContent = 'ہاں، حذف کریں';
    document.getElementById('confirmCancelTxt').textContent = blocked ? 'ٹھیک ہے' : 'منسوخ کریں';
    document.getElementById('confirmBg').style.display = 'flex';
    document.getElementById('confirmCancel').focus();
}
function closeConfirm() { document.getElementById('confirmBg').style.display = 'none'; confirmAction = null; }
async function runConfirm() {
    if (!confirmAction) return;
    const yes = document.getElementById('confirmYes'), yesTxt = document.getElementById('confirmYesTxt');
    yes.disabled = true; yesTxt.textContent = 'حذف ہو رہا ہے...';
    try { await confirmAction(); await loadAll(); }
    catch (e) {
        const err = document.getElementById('confirmErr');
        err.textContent = e.message; err.style.display = 'block';
        yes.disabled = false; yesTxt.textContent = 'ہاں، حذف کریں';
        return;
    }
    closeConfirm();
    refreshView();
}
function deleteInvoice(id) {
    const inv = invoices.find(i => String(i.id) === String(id));
    if (!inv) return;
    const p = party(inv.partyId);
    confirmDelete({
        title: `کیا آپ واقعی بل ${pad3(invNo(inv))} حذف کرنا چاہتے ہیں؟`,
        text: `${p ? p.name + '، ' : ''}${fmtDate(inv.date)}، کل رقم ${fmt(inv.total)}۔ یہ بل پارٹی کے کھاتے سے بھی نکل جائے گا۔`,
        action: () => api('DELETE', '/api/invoices/' + inv.id)
    });
}
function deletePayment(pid, idx) {
    const p = party(pid), e = p && p.entries[idx];
    if (!e || e.type !== 'debit') return;
    confirmDelete({
        title: 'کیا آپ واقعی یہ ادائیگی حذف کرنا چاہتے ہیں؟',
        text: `${p.name} سے ${fmt(e.amount)} (${UR[t(e.note)]}) بتاریخ ${isoToDMY(e.date)}۔ یہ پارٹی کے کھاتے سے بھی نکل جائے گی۔`,
        action: () => api('DELETE', '/api/payments/' + e.id)
    });
}
function deleteName(kind, id) {
    const isParty = kind === 'party';
    const item = isParty ? party(id) : varieties.find(v => String(v.id) === String(id));
    if (!item) return;
    const inUse = isParty ? item.entries.length > 0 : invoices.some(inv => inv.items.some(i => i.varietyId === item.id));
    confirmDelete({
        title: `کیا آپ واقعی "${item.name}" حذف کرنا چاہتے ہیں؟`,
        text: isParty ? 'یہ پارٹی فہرست سے ہٹ جائے گی۔' : 'یہ ورائٹی فہرست سے ہٹ جائے گی۔',
        blocked: !inUse ? null : isParty
            ? 'اس پارٹی کے کھاتے میں اندراجات موجود ہیں۔ پہلے اس کے بل اور ادائیگیاں حذف کریں۔'
            : 'یہ ورائٹی بلوں میں استعمال ہو رہی ہے۔ پہلے وہ بل حذف کریں یا ان میں ورائٹی تبدیل کریں۔',
        action: () => api('DELETE', `/api/${isParty ? 'parties' : 'varieties'}/${item.id}`)
    });
}
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('confirmBg').style.display === 'flex') closeConfirm();
    else if (document.getElementById('editBg').style.display === 'flex') closeEdit();
});


// ---------- URDU TEXT ----------
const UNIT_UR = { dz: 'درجن', pcs: 'پیس', sets: 'چوکڑہ' };
function unitName(u) { return UNIT_UR[u] || u; }
const UR = {
    "Invoice": "بل", "New invoice": "نیا بل", "Next invoice number:": "اگلا بل نمبر:", "Invoice generated": "بل بن گیا",
    "View invoice": "بل دیکھیں", "Create another invoice": "ایک اور بل بنائیں", "Done": "ٹھیک ہے",
    "Party": "پارٹی", "-- Select party --": "-- پارٹی منتخب کریں --", "+ Add new party": "+ نئی پارٹی شامل کریں",
    "New party name": "نئی پارٹی کا نام", "e.g. Imran General Store": "مثلاً عمران جنرل اسٹور", "Date": "تاریخ",
    "Shipping number (optional)": "بلٹی نمبر (اختیاری)", "Leave blank if hand-delivered": "دستی ترسیل ہو تو خالی چھوڑ دیں",
    "Items": "آئٹمز", "Add as many varieties as you need, from any category.": "کسی بھی کوالٹی سے جتنی چاہیں ورائٹیز شامل کریں۔",
    "Variety": "ورائٹی", "Quantity": "مقدار", "Qty": "مقدار", "Rate": "ریٹ", "Amount": "رقم",
    "-- Select variety --": "-- ورائٹی منتخب کریں --", "+ Add new variety": "+ نئی ورائٹی شامل کریں", "New variety name": "نئی ورائٹی کا نام",
    "Add item": "آئٹم شامل کریں", "Remove item": "آئٹم ہٹائیں", "Total:": "کل:", "Cancel": "منسوخ کریں", "Clear": "صاف کریں", "Generate invoice": "بل بنائیں",
    "Recent invoices": "حالیہ بل", "Filters": "فلٹرز", "Filter invoices": "بل فلٹر کریں", "Clear all": "سب صاف کریں",
    "From date": "تاریخ سے", "To date": "تاریخ تک", "Category": "کوالٹی", "All parties": "تمام پارٹیاں", "All categories": "تمام کوالٹیز",
    "All varieties": "تمام ورائٹیز", "Filters applied:": "لاگو فلٹرز:", "Inv #": "بل نمبر", "Shipping #": "بلٹی نمبر", "Total": "کل رقم",
    "Edit": "ترمیم", "Open calendar": "کیلنڈر کھولیں", "Previous page": "پچھلا صفحہ", "Next page": "اگلا صفحہ",
    "Ledger": "کھاتہ", "Running balance per shopkeeper.": "ہر دکاندار کا چلتا ہوا بیلنس۔", "Select party": "پارٹی منتخب کریں", "Open ledger": "کھاتہ کھولیں",
    "Select a party first.": "پہلے پارٹی منتخب کریں۔", "Add payment": "ادائیگی شامل کریں", "Total invoiced": "کل بل رقم",
    "Total received": "کل وصولی", "Balance due": "واجب الادا بیلنس", "Advance paid": "پیشگی ادائیگی", "Settled": "حساب برابر",
    "Payment date": "ادائیگی کی تاریخ", "Payment type": "ادائیگی کی قسم", "Amount received": "وصول شدہ رقم", "e.g. 5000": "مثلاً 5000",
    "Record payment": "ادائیگی درج کریں", "Enter a valid payment date (dd/mm/yyyy) and amount.": "ادائیگی کی درست تاریخ (dd/mm/yyyy) اور رقم درج کریں۔",
    "Entries": "اندراجات", "Oldest first": "پرانے پہلے", "Newest first": "نئے پہلے", "Type": "قسم", "Details": "تفصیل", "Payment": "ادائیگی",
    "Balance": "موجودہ بیلنس", "Closing balance": "اختتامی بیلنس", "No entries yet for this party.": "اس پارٹی کا ابھی کوئی اندراج نہیں۔",
    "Cash": "نقد", "Online": "آن لائن", "Cheque": "چیک", "Payments": "ادائیگیاں",
    "Money received from parties. Each payment posts to that party's ledger.": "پارٹیوں سے وصول شدہ رقم۔ ہر ادائیگی اس پارٹی کے کھاتے میں درج ہوتی ہے۔",
    "Record a payment": "ادائیگی درج کریں", "Fill in a valid date (dd/mm/yyyy), party, payment type and amount.": "درست تاریخ (dd/mm/yyyy)، پارٹی، ادائیگی کی قسم اور رقم درج کریں۔",
    "Payment recorded": "ادائیگی درج ہو گئی", "Record another payment": "ایک اور ادائیگی درج کریں", "All payments": "تمام ادائیگیاں",
    "Search by party": "پارٹی کے نام سے تلاش کریں", "Romal": "رومال", "Shawl": "شال", "Lungi": "لنگی",
    "Shipping number": "بلٹی نمبر", "Blank if hand-delivered": "دستی ترسیل ہو تو خالی چھوڑ دیں", "Save changes": "محفوظ کریں",
    "Edit payment": "ادائیگی میں ترمیم", "Choose a party.": "پارٹی منتخب کریں۔", "Enter a valid date (dd/mm/yyyy).": "درست تاریخ (dd/mm/yyyy) درج کریں۔",
    "Add at least one item.": "کم از کم ایک آئٹم شامل کریں۔", "Fill in a valid date (dd/mm/yyyy) and party.": "درست تاریخ (dd/mm/yyyy) اور پارٹی درج کریں۔",
    "Fill in a valid date (dd/mm/yyyy), party and amount.": "درست تاریخ (dd/mm/yyyy)، پارٹی اور رقم درج کریں۔",
    "No invoices match these filters.": "ان فلٹرز سے کوئی بل نہیں ملا۔", "No invoices yet.": "ابھی کوئی بل نہیں۔",
    "No payments yet.": "ابھی کوئی ادائیگی نہیں۔", "Hand delivered": "دستی ترسیل", "Close": "بند کریں", "View": "دیکھیں"
};
const TR_ATTRS = ['placeholder', 'title', 'aria-label', 'label'];
function trStr(sv) { if (!sv) return sv; const k = sv.trim(); if (!k) return sv; const u = UR[k]; return u === undefined ? sv : sv.replace(k, u); }
function inUrdu(el) { return el && el.closest && el.closest('.urdu'); }
function trText(n) { if (!inUrdu(n.parentElement)) return; const v = n.nodeValue, o = trStr(v); if (o !== v) n.nodeValue = o; }
function trAttrs(el) {
    if (!el.getAttribute || !inUrdu(el)) return;
    for (const a of TR_ATTRS) { if (!el.hasAttribute(a)) continue; const v = el.getAttribute(a), o = trStr(v); if (o !== v) el.setAttribute(a, o); }
}
function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
    trAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
}
new MutationObserver(muts => {
    for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(translateTree);
        else if (m.type === 'characterData') trText(m.target);
        else if (m.type === 'attributes') trAttrs(m.target);
    }
}).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TR_ATTRS });
translateTree(document.body);

function currentView() { return VIEWS.find(n => document.getElementById('view-' + n).style.display !== 'none'); }

(async function init() {
    try { await loadAll(); } catch (e) { alert('Could not load data: ' + e.message); }
    setView('ledger');
})();
