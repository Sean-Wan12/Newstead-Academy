/* ===== Dashboard (home): two charts and a short to-do list ===== */
const ATT_COLORS = { in: '#2A78D6', out: '#1BAF7A', absent: '#EB6834', expected: '#D4D4D4' };
function donutSvg(parts, total, big, small) {
  const r = 70, C = 2 * Math.PI * r, live = parts.filter(p => p.v > 0), gap = live.length > 1 ? 2 : 0;
  let off = 0, segs = '';
  live.forEach(p => { const len = Math.max(0, p.v / total * C - gap);
    segs += '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + p.color + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" data-tip="' + esc(p.label + ': ' + p.v) + '" style="cursor:default"></circle>'; off += p.v / total * C; });
  if (!live.length) segs = '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#EBEBEB" stroke-width="22"></circle>';
  return '<svg viewBox="0 0 180 180" role="img" aria-label="' + esc(big + ' ' + small) + '"><g transform="rotate(-90 90 90)">' + segs + '</g><text x="90" y="88" text-anchor="middle" class="c1">' + esc(big) + '</text><text x="90" y="108" text-anchor="middle" class="c2">' + esc(small) + '</text></svg>';
}
function renderDash() {
  const kids = ENROLLED(), c = dayCounts(kids), closed = closureOn(DAY), open = isOpenDay(DAY);
  $('dLead').textContent = fmtDate(DAY, true) + (DAY === todayISO() ? ' (today)' : '') + (closed ? '. Closed: ' + closed.title + '.' : isWeekend(DAY) ? '. Closed on weekends.' : '');
  const parts = [{ k: 'in', label: 'Signed in', v: c.in }, { k: 'out', label: 'Signed out', v: c.out }, { k: 'absent', label: 'Absent', v: c.absent }, { k: 'expected', label: open ? 'Not arrived' : 'No sign-in (closed)', v: c.expected }].map(p => Object.assign(p, { color: ATT_COLORS[p.k] }));
  $('dAtt').innerHTML = '<div class="donut">' + donutSvg(parts, kids.length, String(c.in), 'of ' + kids.length + ' signed in') +
    '<ul class="legend">' + parts.map(p => '<li><i style="background:' + p.color + '"></i><span>' + p.label + '</span><b>' + p.v + '</b></li>').join('') + '</ul></div>';
  const m0 = F.months[0], rooms = F.rooms.map(r => ({ r, n: m0.rooms[r.id].n }));
  const filled = rooms.reduce((s, x) => s + x.n, 0), cap = F.rooms.reduce((s, r) => s + r.licensed, 0);
  $('dEnr').innerHTML = '<p class="muted small" style="margin-bottom:4px">' + filled + ' of ' + cap + ' licensed spaces filled at the end of ' + m0.label + '</p><div class="bars">' + rooms.map(x => { const over = x.n > x.r.cap;
    return '<div class="bar-row' + (over ? ' over' : '') + '" style="--bc:' + (over ? '#C70A24' : GROUP_COLOR[x.r.runsAs]) + '" data-tip="' + esc(x.r.name + ': ' + x.n + ' children, ' + x.r.cap + ' spaces' + (over ? ' (over by ' + (x.n - x.r.cap) + ')' : x.n < x.r.cap ? ' (' + (x.r.cap - x.n) + ' open)' : ' (full)')) + '"><span>' + esc(x.r.name) + '</span><div class="trk"><div class="fil" style="width:' + Math.min(100, x.n / x.r.cap * 100) + '%"></div></div><span class="v">' + x.n + ' / ' + x.r.cap + '</span></div>'; }).join('') + '</div>' + groupKey();
  const al = alertsList(), rank = { over: 0, wait: 1, info: 2 }, top = al.slice().sort((a, b) => rank[a.lv] - rank[b.lv]).slice(0, 4);
  $('dTodo').innerHTML = top.length ? top.map(a => '<li><span class="dot ' + a.lv + '"></span><span>' + esc(a.t) + '</span><a href="' + a.href + '">View</a></li>').join('') : '<li class="muted">Nothing needs attention.</li>';
  $('dAll').textContent = al.length > top.length ? 'See all ' + al.length + ' in Daily summary' : 'Daily summary';
}
document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('[data-tip]'), tip = $('tip'); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; });
