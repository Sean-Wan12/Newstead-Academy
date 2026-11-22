/* ===== Messaging ===== */
function renderMessages() {
  const msgs = rows(D.messages).sort((a, b) => (b.at || 0) - (a.at || 0));
  $('msgTable').innerHTML = msgs.length ? '<table class="list"><thead><tr><th>Saved</th><th>To</th><th>Subject</th><th>From</th></tr></thead><tbody>' + msgs.map(m => '<tr class="click" data-msg="' + m.id + '"><td>' + fmtWhen(m.at) + '</td><td>' + esc(m.toLabel || '') + '</td><td><b>' + esc(m.subject || '(no subject)') + '</b><br><span class="muted small">' + esc((m.body || '').slice(0, 90)) + ((m.body || '').length > 90 ? '…' : '') + '</span></td><td>' + esc(m.from || '') + '</td></tr>').join('') + '</tbody></table>'
    : '<div class="empty"><b>No messages yet</b><span>Write to all families, one room, or one child\'s family.</span><button class="btn btn-primary" type="button" data-act="msg-add">New message</button></div>';
}
function msgTargets() { return [['all', 'All families']].concat(ROOMS.map(r => ['room:' + r.id, 'Families in ' + r.name]), ENROLLED().map(k => ['kid:' + k.id, 'Family of ' + k.n + ' (' + roomById(k.r).name + ')'])); }
function msgForm() {
  openForm({ title: 'New message', values: { to: 'all', from: (D.settings.centre && D.settings.centre.name) || 'Newstead Academy' }, submit: 'Save message',
    fields: [{ k: 'to', label: 'To', type: 'select', options: msgTargets(), wide: true }, { k: 'subject', label: 'Subject', req: true, wide: true }, { k: 'body', label: 'Message', type: 'textarea', rows: 7, req: true, wide: true }, { k: 'from', label: 'From', wide: true }],
    onSave: async v => { const id = newId(), label = msgTargets().find(t => t[0] === v.to)[1]; const ok = await put('messages/' + id, Object.assign(v, { toLabel: label, at: Date.now() })); if (ok) setTimeout(() => showMsg(Object.assign({ id }, v, { toLabel: label, at: Date.now() })), 0); return ok; } });
}
function showMsg(m) {
  const r = emailsFor(m.to);
  openView(m.subject || 'Message', '<div class="stack-s"><p class="muted small">To ' + esc(m.toLabel) + ' · from ' + esc(m.from || '') + ' · saved ' + fmtWhen(m.at) + '</p><div class="panel" style="white-space:pre-wrap">' + esc(m.body || '') + '</div>' +
    '<p class="small">' + (r.emails.length ? r.emails.length + ' email ' + (r.emails.length === 1 ? 'address' : 'addresses') + ' on file for ' + r.kids + (r.kids === 1 ? ' child' : ' children') + '.' : 'No email addresses on file for these families yet.') + (r.missing ? ' ' + r.missing + (r.missing === 1 ? ' child has' : ' children have') + ' no parent email in Contacts.' : '') + '</p>' +
    '<div class="row"><button class="btn btn-primary" type="button" data-vact="copyMsg">Copy message</button>' + (r.emails.length ? '<button class="btn" type="button" data-vact="copyEmails">Copy email addresses</button>' : '') + '<span class="muted small" id="mvStatus" role="status"></span></div>' +
    '<div class="mfoot"><button class="btn danger" type="button" data-vact="del">Delete</button><button class="btn" type="button" data-close>Close</button></div></div>',
    { copyMsg: () => copyText((m.subject ? m.subject + '\n\n' : '') + (m.body || ''), 'mvStatus'), copyEmails: () => copyText(r.emails.join(', '), 'mvStatus'),
      del: b => { if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Click again to delete'; return; } remove('messages/' + m.id).then(closeModal); } });
}
