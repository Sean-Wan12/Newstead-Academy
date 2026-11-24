/* Teacher panel state: who is signed in, the room shown, its children, today's attendance
   and entries, the room's ratio status, which children are selected, and the card filter. */
export const S = {
  me: null, meta: null,
  rooms: [], room: null,
  children: [], att: {}, entries: [], status: null, shifts: [],
  selected: new Set(), filter: 'all'
};

/* 'expected' (not arrived), 'in', 'out' or 'absent' */
export const statusOf = childId => (S.att[childId] && S.att[childId].status) || 'expected';
export const openNap = childId => S.entries.find(e => e.childId === childId && e.type === 'nap' && !e.data.end);
export const isDevice = () => S.me && S.me.kind === 'device';
/* The person recorded on writes: the signed-in user, or the PIN-verified staff on a tablet */
export const actor = () => (isDevice() ? S.me.actor : S.me && { id: S.me.id, name: S.me.name }) || null;
