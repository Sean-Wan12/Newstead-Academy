/* Menu: built sections link to a view; planned ones open the "not built yet" page */
const MENU = [
  { id: 'dashboard', label: 'Dashboard', badge: true },
  { id: 'summary', label: 'Daily summary' },
  { group: 'Manage enrollment', items: [
    { id: 'overview', label: 'Enrollment overview' },
    { id: 'forecast', label: 'Capacity forecast' },
    { id: 'children', label: 'Who moves next' },
    { id: 'rosters', label: 'Classroom rosters' },
    { id: 'waitlist', label: 'Registration and waitlist' }
  ] },
  { id: 'rooms', label: 'Classrooms' },
  { id: 'actions', label: 'Classroom actions' },
  { id: 'checkin', label: 'Classroom check-in', tag: 'New' },
  { id: 'photos', label: 'Photos and videos' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'billing', label: 'Billing and subsidies' },
  { id: 'calendars', label: 'Menus and calendars' },
  { div: true },
  { id: 'reports', label: 'Reports' },
  { id: 'signin', label: 'Parent sign-in' },
  { id: 'configuration', label: 'Logins and configuration' },
  { id: 'help', label: 'Help' }
];
const FLAT = MENU.filter(m => !m.div).flatMap(m => m.items || [m]);
const BUILT = FLAT.filter(m => !m.soon).map(m => m.id);
const ICON = {
  dashboard: ['#2A78D6', 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z'],
  summary: ['#6250D6', 'M4 5h12M4 10h12M4 15h8'],
  enroll: ['#E87BA4', 'M7 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.5 16.5c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5M13.5 5.5a2.2 2.2 0 1 1 0 4.4M14.5 12c1.8.3 3 2 3 4.5'],
  rooms: ['#C98500', 'M3 9l7-6 7 6v8H3zM8 17v-5h4v5'],
  actions: ['#1BAF7A', 'M4 4h12v12H4zM7 10l2 2 4-4'],
  checkin: ['#0E7C66', 'M7 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.5 16c0-2.5 2-4.3 4.5-4.3 1.2 0 2.3.4 3.1 1.1M12 13.5l2 2 3.5-4'],
  photos: ['#E87BA4', 'M3 7h3l2-2h4l2 2h3v9H3zM10 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'],
  messaging: ['#2A78D6', 'M3 4h14v9H8l-4 3v-3H3z'],
  contacts: ['#EB6834', 'M5 3h10v14H5zM8 7h4M8 10h4M8 13h2'],
  billing: ['#008300', 'M10 3v14M13.5 6.5c0-1.4-1.6-2-3.5-2s-3.5.8-3.5 2.3 1.7 2 3.5 2.4 3.5 1 3.5 2.5-1.6 2.3-3.5 2.3-3.5-.6-3.5-2'],
  calendars: ['#E34948', 'M3 5h14v12H3zM3 9h14M7 3v4M13 3v4'],
  reports: ['#6250D6', 'M4 16V9M10 16V4M16 16v-6M2 17h16'],
  signin: ['#1BAF7A', 'M9 4h7v12H9M3 10h9M9 7l3 3-3 3'],
  configuration: ['#616161', 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1'],
  help: ['#2A78D6', 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.6M10 14.2v.1']
};
const icon = k => ICON[k] ? '<svg class="nico" viewBox="0 0 20 20" aria-hidden="true"><path d="' + ICON[k][1] + '" fill="none" stroke="' + ICON[k][0] + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
/* Teachers see only their classroom pages; admins see everything */
const TEACHER_VIEWS = ['checkin', 'help'];
function allowedViews() { return ME.role === 'teacher' ? TEACHER_VIEWS : ME.role === 'admin' ? null : []; }
function renderMenu(cur) {
  const allowed = allowedViews(), ok = m => !allowed || allowed.includes(m.id);
  const link = m => '<li><a href="#' + m.id + '"' + (m.id === cur ? ' aria-current="page"' : '') + '><span class="nl">' + icon(m.id) + '<span>' + esc(m.label) + '</span></span>' + (m.badge ? '<span class="navbadge" id="navBadge" hidden></span>' : m.tag ? '<span class="tag new">' + esc(m.tag) + '</span>' : '') + '</a></li>';
  if (allowed) { $('menu').innerHTML = FLAT.filter(ok).map(link).join(''); return; }
  $('menu').innerHTML = MENU.map(m => m.div ? '<li class="div" role="separator"></li>' : m.items
    ? '<li><button type="button" id="grpBtn" aria-expanded="' + groupOpen + '" aria-controls="grpList"><span class="nl">' + icon('enroll') + '<span>' + esc(m.group) + '</span></span><span class="caret" aria-hidden="true">›</span></button><ul class="sub" id="grpList"' + (groupOpen ? '' : ' hidden') + '>' + m.items.map(link).join('') + '</ul></li>'
    : link(m)).join('');
}
