/* Sign-in page: staff email/password, classroom tablet login, and the forced password change
   after a temporary password. Sends each person to their panel when done. */
import { api, logout } from './shared/api.js';

const $ = id => document.getElementById(id);
const msg = m => { $('msg').textContent = m || ''; $('msg').hidden = !m; };

/* Only same-site paths are followed after sign-in */
function nextUrl(role) {
  const n = new URLSearchParams(location.search).get('next');
  const home = role === 'owner' || role === 'admin' ? '/admin' : '/teacher';
  if (n && /^\/(admin|teacher)(\.html)?(#[\w/-]*)?$/.test(n)) {
    if ((role === 'teacher' || role === 'device') && n.startsWith('/admin')) return home;
    return n;
  }
  return home;
}

function showTab(which) {
  const staff = which === 'staff';
  $('tab-staff').setAttribute('aria-selected', staff); $('tab-device').setAttribute('aria-selected', !staff);
  $('tab-staff').tabIndex = staff ? 0 : -1; $('tab-device').tabIndex = staff ? -1 : 0;
  $('staffForm').hidden = !staff; $('deviceForm').hidden = staff; $('changeForm').hidden = true;
  msg('');
  (staff ? $('email') : $('username')).focus();
  try { localStorage.setItem('na-login-tab', which); } catch (e) { /* private mode */ }
}
function showChange() { $('staffForm').hidden = true; $('deviceForm').hidden = true; document.querySelector('.tabs').hidden = true; $('changeForm').hidden = false; $('cur').focus(); }

async function submitWith(form, fn) {
  msg('');
  if (!form.checkValidity()) { msg('Fill in both fields.'); form.querySelector(':invalid').focus(); return; }
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  try { await fn(); } catch (e) { msg(e.message); } finally { btn.disabled = false; }
}

$('tab-staff').addEventListener('click', () => showTab('staff'));
$('tab-device').addEventListener('click', () => showTab('device'));
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const dev = $('tab-staff').getAttribute('aria-selected') === 'true'; showTab(dev ? 'device' : 'staff'); (dev ? $('tab-device') : $('tab-staff')).focus(); }
});

$('staffForm').addEventListener('submit', e => { e.preventDefault(); submitWith(e.target, async () => {
  const r = await api.post('/api/auth/login', { email: $('email').value, password: $('password').value });
  if (r.mustChangePassword) { $('cur').value = $('password').value; showChange(); $('np').focus(); return; }
  location.href = nextUrl(r.user.role);
}); });

$('deviceForm').addEventListener('submit', e => { e.preventDefault(); submitWith(e.target, async () => {
  await api.post('/api/auth/device-login', { username: $('username').value.trim(), password: $('devpass').value });
  location.href = '/teacher';
}); });

$('changeForm').addEventListener('submit', e => { e.preventDefault(); submitWith(e.target, async () => {
  if ($('np').value !== $('np2').value) throw new Error('The two new passwords do not match.');
  await api.post('/api/auth/password', { currentPassword: $('cur').value, newPassword: $('np').value });
  const me = await api.get('/api/auth/me');
  location.href = nextUrl(me.role);
}); });
$('cancelChange').addEventListener('click', () => logout());

/* Already signed in? Go straight on (unless a password change is due) */
(async () => {
  let me = null;
  try { me = await api.get('/api/auth/me'); } catch (e) { /* show the form */ }
  if (me && me.signedIn) {
    if (me.mustChangePassword) return showChange();
    if (new URLSearchParams(location.search).get('change') !== '1') { location.href = nextUrl(me.role); return; }
  }
  let tab = 'staff';
  try { tab = localStorage.getItem('na-login-tab') || 'staff'; } catch (e) { /* ignore */ }
  showTab(tab === 'device' ? 'device' : 'staff');
})();
