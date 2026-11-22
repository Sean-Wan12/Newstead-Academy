/* ===== Photos and videos ===== */
function mediaTag(p, thumb) {
  const src = p.url || (p.assetId ? '/_blob/' + p.assetId : '');
  return (p.kind || '').startsWith('video') ? '<video src="' + esc(src) + '"' + (thumb ? ' muted preload="metadata"' : ' controls class="bigmedia"') + '></video>' : '<img src="' + esc(src) + '" alt="' + esc(p.caption || 'Photo') + '"' + (thumb ? ' loading="lazy"' : ' class="bigmedia"') + '>';
}
function renderPhotos() {
  roomButtons('phRooms', PH_ROOM, 'phroom', true);
  const can = !!STORE.assets;
  $('phAddBtn').disabled = !can;
  $('phNote').hidden = can;
  $('phNote').textContent = 'Photo and video uploads are not switched on for this admin yet. The page is ready for them: once uploads are turned on, the Upload button works and pictures appear here by room.';
  const ph = rows(D.photos).filter(p => PH_ROOM === 'all' || p.room === PH_ROOM || p.room === 'all').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0));
  $('phGrid').innerHTML = ph.length ? '<div class="pgrid">' + ph.map(p => '<button type="button" class="pcard" data-ph="' + p.id + '"><div class="pimg">' + mediaTag(p, true) + '</div><div class="pcap"><b>' + esc(p.caption || 'Untitled') + '</b><span class="muted small">' + esc(p.room === 'all' ? 'All rooms' : (roomById(p.room) || {}).name || '') + ' · ' + fmtDate(p.date) + '</span></div></button>').join('') + '</div>'
    : '<div class="panel empty"><b>No photos or videos yet</b><span>' + (can ? 'Upload pictures from the day to share with families.' : 'Once uploading is available, pictures appear here by room.') + '</span></div>';
}
function photoForm() {
  if (!STORE.assets) return;
  openForm({ title: 'Upload a photo or video', values: { room: PH_ROOM === 'all' ? 'all' : PH_ROOM, date: DAY }, submit: 'Upload',
    fields: [{ k: 'file', label: 'Photo or video', type: 'file', accept: 'image/*,video/*', req: true, wide: true }, { k: 'room', label: 'Room', type: 'select', options: [['all', 'All rooms']].concat(ROOM_OPTS()) }, { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'caption', label: 'Caption', wide: true }],
    onSave: async v => {
      if (!v.file) { toast('Choose a file first.', true); return false; }
      if (v.file.size > 20 * 1024 * 1024) { toast('That file is over 20 MB. Choose a smaller one.', true); return false; }
      toast('Uploading…');
      let a; try { a = await STORE.assets.upload(v.file); } catch (e) { toast('The upload did not work' + (e && e.message ? ': ' + e.message : '.'), true); return false; }
      return put('photos/' + newId(), { assetId: a.id, url: a.url, kind: a.contentType || v.file.type, room: v.room, date: v.date, caption: v.caption, at: Date.now() });
    } });
}
function showPhoto(p) {
  openView(p.caption || 'Photo', '<div class="stack-s">' + mediaTag(p, false) + '<p class="muted small">' + esc(p.room === 'all' ? 'All rooms' : (roomById(p.room) || {}).name || '') + ' · ' + fmtDate(p.date) + '</p><div class="mfoot">' + (STORE.assets ? '<button class="btn danger" type="button" data-vact="del">Delete</button>' : '<span></span>') + '<button class="btn" type="button" data-close>Close</button></div></div>',
    { del: async b => { if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Click again to delete'; return; } try { if (STORE.assets && p.assetId) await STORE.assets.delete(p.assetId); } catch (e) {} await remove('photos/' + p.id); closeModal(); } });
}
