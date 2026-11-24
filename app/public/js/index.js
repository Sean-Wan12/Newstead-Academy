/* Home: send each person to the right place (sign-in, admin panel or teacher panel) */
import { api } from './shared/api.js';

(async () => {
  try {
    const me = await api.get('/api/auth/me');
    if (!me.signedIn || me.mustChangePassword) location.replace('/login');
    else location.replace(me.role === 'owner' || me.role === 'admin' ? '/admin' : '/teacher');
  } catch (e) { location.replace('/login'); }
})();
