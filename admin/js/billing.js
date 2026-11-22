/* ===== Billing and subsidies ===== */
let BILL_MONTH = todayISO().slice(0, 7);
const feeGroups = () => AGE_GROUPS.filter(hasGroup);
const feeFor = k => { const f = (D.settings.billing && D.settings.billing.fees) || {}; return +f[roomById(k.r).runsAs] || 0; };
function renderBilling() {
  $('billMonth').value = BILL_MONTH;
  const doc = D.billing[BILL_MONTH], lines = doc && doc.lines ? doc.lines : null, fees = (D.settings.billing && D.settings.billing.fees) || null;
  const L = lines ? Object.keys(lines).map(id => Object.assign({ kid: +id }, lines[id])).filter(l => kidById(l.kid)) : [];
  const sum = f => L.reduce((s, l) => s + f(l), 0);
  const billed = sum(l => +l.fee || 0), sub = sum(l => +l.subsidy || 0), owe = sum(l => Math.max(0, (+l.fee || 0) - (+l.subsidy || 0))), paid = sum(l => l.paid ? Math.max(0, (+l.fee || 0) - (+l.subsidy || 0)) : 0);
  $('billTiles').innerHTML = [['', 'Total fees', money(billed)], ['', 'Subsidies', money(sub)], ['', 'Families owe', money(owe)], ['is-open', 'Collected', money(paid)], [owe - paid > 0 ? 'is-wait' : '', 'Outstanding', money(owe - paid)]]
    .map(t => '<div class="tile ' + t[0] + '"><span class="small muted">' + t[1] + '</span><b>' + t[2] + '</b></div>').join('');
  if (!lines) {
    $('billBody').innerHTML = '<div class="panel empty"><b>No invoices for ' + fmtDate(BILL_MONTH) + '</b>' + (fees ? '<span>Creates one invoice for each of the ' + ENROLLED().length + ' enrolled children, at the monthly fee for their room. You can change any amount afterwards.</span><button class="btn btn-primary" type="button" data-act="bill-create">Create invoices for ' + fmtDate(BILL_MONTH) + '</button>' : '<span>Set the monthly fee for each age group first.</span><button class="btn btn-primary" type="button" data-act="bill-fees">Set fees</button>') + '</div>';
    return;
  }
  const missing = ENROLLED().filter(k => !lines[k.id]);
  $('billBody').innerHTML = (missing.length ? '<p class="note">' + missing.length + ' enrolled ' + (missing.length === 1 ? 'child has' : 'children have') + ' no invoice this month. <a href="#billing" data-act="bill-missing">Add ' + (missing.length === 1 ? 'it' : 'them') + '</a></p>' : '') +
    '<div class="tablebox"><table class="list"><thead><tr><th>Child</th><th>Room</th><th class="num">Fee</th><th class="num">Subsidy</th><th class="num">Family owes</th><th>Status</th><th class="num">Actions</th></tr></thead><tbody>' +
    L.sort((a, b) => ROOMS.findIndex(r => r.id === kidById(a.kid).r) - ROOMS.findIndex(r => r.id === kidById(b.kid).r) || kidById(a.kid).n.localeCompare(kidById(b.kid).n)).map(l => { const k = kidById(l.kid), o = Math.max(0, (+l.fee || 0) - (+l.subsidy || 0));
      return '<tr><td><b>' + esc(k.n) + '</b>' + (l.note ? '<br><span class="muted small">' + esc(l.note) + '</span>' : '') + '</td><td>' + esc(roomById(k.r).name) + '</td><td class="num">' + money(l.fee) + '</td><td class="num">' + (+l.subsidy ? money(l.subsidy) : '—') + '</td><td class="num"><b>' + money(o) + '</b></td><td>' + (l.paid ? '<span class="pill open">Paid' + (l.paidOn ? ' ' + fmtDate(l.paidOn) : '') + '</span>' : o === 0 ? '<span class="pill">Nothing owed</span>' : '<span class="pill wait">Unpaid</span>') + '</td><td><div class="acts">' + (!l.paid && o > 0 ? '<button class="btn sm btn-primary" data-bill="pay" data-kid="' + l.kid + '">Mark paid</button>' : '') + '<button class="btn sm" data-bill="edit" data-kid="' + l.kid + '">Edit</button></div></td></tr>'; }).join('') +
    '</tbody></table></div>';
}
function feesForm() {
  const f = (D.settings.billing && D.settings.billing.fees) || {};
  openForm({ title: 'Monthly fees', intro: 'The full monthly fee for a five-day child in each age group, before any subsidy. New invoices use these amounts; existing invoices don\'t change.', values: f,
    fields: feeGroups().map(g => ({ k: g, label: g + ' rooms ($ per month)', type: 'number', min: 0, step: '0.01', req: true })),
    onSave: v => put('settings/billing', { fees: v, updated: Date.now() }) });
}
function createInvoices(kids) {
  const lines = {}; kids.forEach(k => { lines[k.id] = { fee: feeFor(k), subsidy: 0, paid: false }; });
  return merge('billing/' + BILL_MONTH, { month: BILL_MONTH, lines, created: Date.now() });
}
function billLineForm(kid) {
  const k = kidById(kid), l = D.billing[BILL_MONTH].lines[kid];
  openForm({ title: k.n + ', ' + fmtDate(BILL_MONTH), values: l,
    fields: [{ k: 'fee', label: 'Fee ($)', type: 'number', min: 0, step: '0.01', req: true }, { k: 'subsidy', label: 'Subsidy ($)', type: 'number', min: 0, step: '0.01', hint: 'fee reduction or subsidy' },
      { k: 'paid', label: 'Paid', type: 'checkbox' }, { k: 'paidOn', label: 'Paid on', type: 'date' }, { k: 'note', label: 'Note', wide: true, ph: 'Payment method, subsidy program…' }],
    onSave: v => merge('billing/' + BILL_MONTH, { lines: { [kid]: Object.assign(v, { fee: +v.fee || 0, subsidy: +v.subsidy || 0, paidOn: v.paid ? (v.paidOn || todayISO()) : '' }) } }) });
}
