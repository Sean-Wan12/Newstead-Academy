/* ===== Contacts ===== */
function renderContacts() {
  roomButtons('ctRooms', CT_ROOM, 'ctroom', true);
  const q = ($('ctSearch').value || '').toLowerCase();
  const ks = ENROLLED().filter(k => CT_ROOM === 'all' || k.r === CT_ROOM).filter(k => { if (!q) return true; const c = D.contacts['c' + k.id] || {}; return [k.n, c.g1name, c.g2name, c.ename].join(' ').toLowerCase().includes(q); })
    .sort((a, b) => ROOMS.findIndex(r => r.id === a.r) - ROOMS.findIndex(r => r.id === b.r) || a.n.localeCompare(b.n));
  const missing = ENROLLED().filter(k => { const c = D.contacts['c' + k.id]; return !c || !(c.g1name || c.ename); }).length;
  $('ctTable').innerHTML = '<p class="muted small" style="margin:12px">' + (missing === ENROLLED().length ? 'No contacts entered yet. Lillio\'s enrollment export doesn\'t include them: select a child to add their parents and emergency contact.' : (ENROLLED().length - missing) + ' of ' + ENROLLED().length + ' children have contacts on file. Select a child to add or change theirs.') + '</p><table class="list"><thead><tr><th>Child</th><th>Room</th><th>Parents and guardians</th><th>Emergency contact</th><th>May pick up</th></tr></thead><tbody>' +
    ks.map(k => { const c = D.contacts['c' + k.id] || {};
      const g = [[c.g1name, c.g1rel, c.g1phone], [c.g2name, c.g2rel, c.g2phone]].filter(x => x[0]).map(x => esc(x[0]) + (x[1] ? ' <span class="muted">(' + esc(x[1]) + ')</span>' : '') + (x[2] ? '<br><span class="muted small">' + esc(x[2]) + '</span>' : '')).join('<br>');
      return '<tr class="click" data-ct="' + k.id + '"><td><b>' + esc(k.n) + '</b></td><td>' + esc(roomById(k.r).name) + '</td><td>' + (g || '<span class="addlink">Add parent or guardian</span>') + '</td><td>' + (c.ename ? esc(c.ename) + (c.ephone ? '<br><span class="muted small">' + esc(c.ephone) + '</span>' : '') : '<span class="muted">—</span>') + '</td><td>' + (c.pickup ? esc(c.pickup) : '<span class="muted">Parents only</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
}
function contactForm(kid) {
  const k = kidById(kid), c = D.contacts['c' + kid];
  const g = n => [{ type: 'heading', label: n === 1 ? 'Parent or guardian 1' : 'Parent or guardian 2' }, { k: 'g' + n + 'name', label: 'Name', req: n === 1 }, { k: 'g' + n + 'rel', label: 'Relationship', ph: 'Mother, father, guardian…' }, { k: 'g' + n + 'phone', label: 'Phone', type: 'tel' }, { k: 'g' + n + 'email', label: 'Email', type: 'email' }];
  openForm({ title: 'Contacts for ' + k.n, intro: roomById(k.r).name, values: c || {},
    fields: g(1).concat(g(2), [{ type: 'heading', label: 'Emergency contact' }, { k: 'ename', label: 'Name' }, { k: 'erel', label: 'Relationship' }, { k: 'ephone', label: 'Phone', type: 'tel', wide: true },
      { type: 'heading', label: 'Pick-up' }, { k: 'pickup', label: 'Others who may pick up', hint: 'names, separated by commas', wide: true }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, wide: true }]),
    onSave: v => put('contacts/c' + kid, Object.assign(v, { kid, updated: Date.now() })),
    onDelete: c ? () => remove('contacts/c' + kid) : null, deleteLabel: 'Clear contacts' });
}
function emailsFor(to) {
  const ks = to === 'all' ? ENROLLED() : to.startsWith('room:') ? ENROLLED().filter(k => k.r === to.slice(5)) : ENROLLED().filter(k => String(k.id) === to.slice(4));
  const set = new Set(); let missing = 0;
  ks.forEach(k => { const c = D.contacts['c' + k.id] || {}; const e = [c.g1email, c.g2email].filter(Boolean); if (!e.length) missing++; e.forEach(x => set.add(x)); });
  return { emails: Array.from(set), kids: ks.length, missing };
}
