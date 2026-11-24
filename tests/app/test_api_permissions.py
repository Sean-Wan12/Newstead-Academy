"""Every API route, for every kind of person: owner, supervisors of each location, educators
(lead, assistant, floater), a classroom tablet with and without a PIN unlock, and signed out.
Reads must return only what the person may see; writes outside their reach must be refused
and change nothing."""
import pytest

ROLES = ['owner', 'sup_rh', 'sup_mk', 'teacher', 'assistant', 'floater', 'tablet', 'tablet_pin', 'anon']
RH_ALL = {'owner', 'sup_rh', 'teacher', 'assistant', 'floater', 'tablet', 'tablet_pin'}
T1 = {'owner', 'sup_rh', 'teacher', 'assistant', 'tablet', 'tablet_pin'}       # may reach Toddler 1
P1 = {'owner', 'sup_rh', 'floater'}                                             # may reach Preschool 1
RH_ADMIN = {'owner', 'sup_rh'}
MK_ADMIN = {'owner', 'sup_mk'}
TODAY, PAST = '2026-11-23', '2026-11-20'


@pytest.fixture(scope='module')
def who(srv):
    c = {r: srv.user(r) for r in ['owner', 'sup_rh', 'sup_mk', 'teacher', 'assistant', 'floater']}
    c['tablet'] = srv.tablet('rh-toddler-1')
    c['tablet_pin'] = srv.tablet('rh-toddler-1', 'u-t-rh-t1', '2580')
    c['anon'] = srv.client()
    return c


@pytest.fixture(scope='module')
def rec(srv, who, ids):
    """Records to aim at: children, contacts, placements and entries in Toddler 1, Preschool 1 and Markham,
    plus past-day attendance, entries and staff shifts that only supervisors may read"""
    o, k = who['owner'], ids['kids']
    t1, p1, mk = k['rh-t1'][0], k['rh-p1'][0], k['mk-i1'][0]
    for cid, room in ((t1, 'rh-t1'), (p1, 'rh-p1')):
        r = o.post('/api/attendance/absent', {'childIds': [cid], 'date': PAST, 'reason': 'sick'}); assert r.json['ok'], r
        r = o.post('/api/entries', {'childIds': [cid], 'type': 'note', 'date': PAST, 'time': '10:00', 'data': {'kind': 'general', 'text': 'past day note'}}); assert r.status == 201, r
    ents = o.get('/api/entries?location=rh&date=' + TODAY).json
    e = lambda room: next(x['id'] for x in ents if x['roomId'] == room)
    contact = lambda cid: o.get('/api/contacts?child=' + cid).json[0]['id']
    en = lambda cid: o.get('/api/enrollments?child=' + cid).json[-1]['id'] if cid != mk else None
    return {'t1': t1, 'p1': p1, 'mk': mk, 'e_t1': e('rh-t1'), 'e_p1': e('rh-p1'), 'c_t1': contact(t1), 'c_mk': o.get('/api/contacts?child=' + mk).json[0]['id'],
            'en_t1': o.get('/api/enrollments?child=' + t1).json[-1]['id'], 'en_mk': o.get('/api/enrollments?child=' + mk).json[-1]['id']}


# (path, roles that may read it)
READS = [
    ('/api/meta', set(ROLES) - {'anon'}),
    ('/api/locations', set(ROLES) - {'anon'}),
    ('/api/locations/rh', RH_ALL),
    ('/api/locations/mk', MK_ADMIN),
    ('/api/rooms?location=rh', RH_ALL),
    ('/api/rooms?location=mk', MK_ADMIN),
    ('/api/rooms/rh-t1', T1),
    ('/api/rooms/rh-p1', P1),
    ('/api/rooms/mk-i1', MK_ADMIN),
    ('/api/rooms/rh-t1/status', T1),
    ('/api/rooms/rh-t1/status?date=' + PAST, RH_ADMIN),
    ('/api/children?location=rh', RH_ALL),
    ('/api/children?location=mk', MK_ADMIN),
    ('/api/children?location=rh&room=rh-t1', T1),
    ('/api/children?location=rh&date=' + PAST, RH_ADMIN),
    ('/api/children?location=rh&room=rh-t1&date=2026-10-01', RH_ADMIN),
    ('/api/children/{t1}', T1),
    ('/api/children/{p1}', P1),
    ('/api/children/{mk}', MK_ADMIN),
    ('/api/children/{t1}/timeline', T1),
    ('/api/children/{t1}/timeline?date=' + PAST, RH_ADMIN),
    ('/api/enrollments?location=rh', RH_ADMIN),
    ('/api/enrollments?child={t1}', RH_ADMIN),
    ('/api/enrollments?child={mk}', MK_ADMIN),
    ('/api/contacts?child={t1}', T1),
    ('/api/contacts?child={p1}', P1),
    ('/api/contacts?location=rh', RH_ADMIN),
    ('/api/contacts?location=mk', MK_ADMIN),
    ('/api/users?location=rh', RH_ADMIN),
    ('/api/users?location=mk', MK_ADMIN),
    ('/api/users', {'owner'}),
    ('/api/devices?location=rh', RH_ADMIN),
    ('/api/devices?location=mk', MK_ADMIN),
    ('/api/attendance?location=rh', RH_ALL),
    ('/api/attendance?location=rh&date=' + PAST, RH_ADMIN),
    ('/api/attendance?location=mk', MK_ADMIN),
    ('/api/staff-attendance?location=rh', RH_ALL),
    ('/api/staff-attendance?location=rh&date=' + PAST, RH_ADMIN),
    ('/api/entries?location=rh', RH_ALL),
    ('/api/entries?location=rh&date=' + PAST, RH_ADMIN),
    ('/api/entries?location=rh&from=' + PAST + '&to=' + TODAY, RH_ADMIN),
    ('/api/entries?location=mk', MK_ADMIN),
    ('/api/dashboard?location=rh', RH_ADMIN),
    ('/api/dashboard?location=mk', MK_ADMIN),
    ('/api/forecast?location=rh', RH_ADMIN),
    ('/api/forecast?location=mk', MK_ADMIN),
    ('/api/audit?location=rh', RH_ADMIN),
    ('/api/audit?location=mk', MK_ADMIN),
    ('/api/audit', {'owner'}),
    ('/api/auth/device-staff', {'tablet', 'tablet_pin'}),
]


@pytest.mark.parametrize('path,allowed', READS, ids=[r[0] for r in READS])
def test_read_access(who, rec, path, allowed):
    p = path.format(**rec)
    for role in ROLES:
        r = who[role].get(p)
        if role in allowed:
            assert r.status == 200, (role, p, r.status, (r.json or {}).get('error') if isinstance(r.json, dict) else '')
        else:
            assert r.status in (400, 401, 403), (role, p, r.status)
            assert r.status != 400 or path == '/api/users' or path.startswith('/api/audit'), (role, p, r)


def test_lists_are_filtered_to_the_persons_rooms(who, rec, ids):
    for role, rooms in [('teacher', {'rh-t1'}), ('assistant', {'rh-t1'}), ('tablet', {'rh-t1'}), ('floater', {'rh-p1', 'rh-p2'})]:
        c = who[role]
        assert {k['roomId'] for k in c.get('/api/children?location=rh').json} <= rooms, role
        assert {r['id'] for r in c.get('/api/rooms?location=rh').json} == rooms, role
        assert {a['roomId'] for a in c.get('/api/attendance?location=rh').json} <= rooms, role
        assert {e['roomId'] for e in c.get('/api/entries?location=rh').json} <= rooms, role
        assert {s['roomId'] for s in c.get('/api/staff-attendance?location=rh').json} <= rooms, role
    assert {l['id'] for l in who['sup_rh'].get('/api/locations').json} == {'rh'}
    assert {l['id'] for l in who['teacher'].get('/api/locations').json} == {'rh'}
    assert not any(u['role'] == 'owner' for u in who['sup_rh'].get('/api/users?location=rh').json)


SECRET_MARKERS = ['scrypt$', 'passwordHash', 'pinHash', 'Owner-demo', 'Super-demo', 'Teacher-demo', 'Tablet-demo']


def test_no_endpoint_returns_a_password_hash_or_secret(who, rec):
    paths = [p.format(**rec) for p, _ in READS] + ['/api/auth/me']
    for role in ROLES:
        for p in paths:
            r = who[role].get(p)
            assert not any(m in r.text for m in SECRET_MARKERS), (role, p)


# Writes that must be refused: (method, path, body, roles refused)
def denied_writes(rec):
    kid = {'firstName': 'New', 'lastName': 'Kid', 'dateOfBirth': '2024-05-01'}
    room = {'name': 'Extra', 'ageGroup': 'Toddler', 'licensedCapacity': 10}
    staff = lambda role, loc: {'name': 'New Person', 'email': 'new.%s.%s@example.test' % (role, loc), 'role': role, 'locationIds': [loc] if loc else []}
    NOT_RH_ADMIN = set(ROLES) - RH_ADMIN
    NOT_T1 = set(ROLES) - T1
    return [
        ('PATCH', '/api/locations/rh', {'name': 'X'}, set(ROLES) - {'owner'}),
        ('POST', '/api/rooms', dict(room, locationId='rh'), NOT_RH_ADMIN),
        ('PATCH', '/api/rooms/rh-t1', {'operatingCapacity': 3}, NOT_RH_ADMIN),
        ('DELETE', '/api/rooms/rh-t1', None, NOT_RH_ADMIN),
        ('PATCH', '/api/rooms/mk-i1', {'operatingCapacity': 3}, set(ROLES) - MK_ADMIN),
        ('POST', '/api/children', dict(kid, locationId='rh'), NOT_RH_ADMIN),
        ('POST', '/api/children', dict(kid, locationId='mk'), set(ROLES) - MK_ADMIN),
        ('PATCH', '/api/children/{t1}', {'notes': 'changed'}, NOT_RH_ADMIN),
        ('DELETE', '/api/children/{t1}', None, NOT_RH_ADMIN),
        ('DELETE', '/api/children/{mk}', None, set(ROLES) - MK_ADMIN),
        ('POST', '/api/enrollments', {'childId': '{t1}', 'roomId': 'rh-t2', 'startDate': '2027-01-04'}, NOT_RH_ADMIN),
        ('PATCH', '/api/enrollments/{en_t1}', {'notes': 'x'}, NOT_RH_ADMIN),
        ('DELETE', '/api/enrollments/{en_t1}', None, NOT_RH_ADMIN),
        ('DELETE', '/api/enrollments/{en_mk}', None, set(ROLES) - MK_ADMIN),
        ('POST', '/api/contacts', {'childIds': ['{t1}'], 'firstName': 'A', 'lastName': 'B'}, NOT_RH_ADMIN),
        ('PATCH', '/api/contacts/{c_t1}', {'notes': 'x'}, NOT_RH_ADMIN),
        ('DELETE', '/api/contacts/{c_mk}', None, set(ROLES) - MK_ADMIN),
        ('POST', '/api/users', staff('teacher', 'rh'), NOT_RH_ADMIN),
        ('POST', '/api/users', staff('admin', 'rh'), set(ROLES) - {'owner'}),
        ('POST', '/api/users', staff('owner', None), set(ROLES) - {'owner'}),
        ('PATCH', '/api/users/u-t-rh-t1', {'title': 'x'}, NOT_RH_ADMIN),
        ('PATCH', '/api/users/u-t-rh-t1', {'role': 'admin'}, set(ROLES) - {'owner'}),
        ('PATCH', '/api/users/u-t-rh-t1', {'locationIds': ['rh', 'mk']}, set(ROLES) - {'owner'}),
        ('PATCH', '/api/users/u-super-mk', {'title': 'x'}, set(ROLES) - {'owner'}),
        ('PATCH', '/api/users/u-owner', {'title': 'x'}, set(ROLES) - {'owner'}),
        ('POST', '/api/users/u-owner/reset-password', None, set(ROLES)),
        ('POST', '/api/users/u-super-rh/reset-password', None, set(ROLES) - {'owner'}),
        ('POST', '/api/users/u-t-mk-i1/reset-password', None, set(ROLES) - MK_ADMIN),
        ('PUT', '/api/users/u-t-mk-i1/pin', {'pin': '5831'}, set(ROLES) - MK_ADMIN),
        ('DELETE', '/api/users/u-super-rh/pin', None, set(ROLES) - {'owner', 'sup_rh'}),
        ('POST', '/api/devices', {'locationId': 'mk', 'username': 'mk-new-tab', 'name': 'X', 'roomIds': ['mk-i1']}, set(ROLES) - MK_ADMIN),
        ('PATCH', '/api/devices/d-mk-i1', {'name': 'X'}, set(ROLES) - MK_ADMIN),
        ('POST', '/api/devices/d-mk-i1/reset-password', None, set(ROLES) - MK_ADMIN),
        ('DELETE', '/api/devices/d-rh-t1', None, NOT_RH_ADMIN),
        ('POST', '/api/entries/{e_t1}/review', {}, NOT_RH_ADMIN),
        ('PATCH', '/api/entries/{e_p1}', {'time': '09:00'}, set(ROLES) - P1),
        ('DELETE', '/api/entries/{e_p1}', None, set(ROLES) - P1),
        ('POST', '/api/entries/{e_p1}/sleep-check', {}, set(ROLES) - P1),
        ('PATCH', '/api/entries/{e_t1}', {'time': '09:00'}, NOT_T1 | {'tablet'}),
        ('PATCH', '/api/attendance/' + PAST + '_{t1}', {'reason': 'x', 'status': 'none'}, NOT_RH_ADMIN),
        ('POST', '/api/staff-attendance/clock-in', {'roomId': 'rh-p1'}, NOT_T1 - {'floater', 'sup_mk', 'owner', 'sup_rh'} | {'sup_mk', 'tablet', 'tablet_pin', 'teacher', 'assistant', 'anon'}),
        ('POST', '/api/staff-attendance/clock-in', {'roomId': 'rh-t1', 'userId': 'u-t-rh-t1b'}, {'teacher', 'floater', 'tablet', 'tablet_pin', 'sup_mk', 'anon'}),
        ('POST', '/api/staff-attendance/clock-out', {'userId': 'u-t-rh-t1b'}, {'teacher', 'floater', 'tablet', 'tablet_pin', 'sup_mk', 'anon'}),
        ('PUT', '/api/auth/pin', {'currentPassword': 'x', 'pin': '5831'}, {'tablet', 'tablet_pin', 'anon'}),
        ('POST', '/api/auth/pin-unlock', {'userId': 'u-t-rh-t1', 'pin': '2580'}, set(ROLES) - {'tablet', 'tablet_pin'}),
        ('POST', '/api/auth/password', {'currentPassword': 'x', 'newPassword': 'y' * 12}, {'tablet', 'tablet_pin', 'anon'}),
        ('POST', '/api/auth/pin-lock', {}, set(ROLES) - {'tablet', 'tablet_pin'}),
        ('POST', '/api/entries/nap-end', {'childIds': ['{p1}']}, {'tablet', 'anon'}),   # others get a per-child "no sleep in progress"; a sleeping child of another room is refused (test_sleep_*)
        ('POST', '/api/attendance/undo', {'childId': '{p1}'}, {'teacher', 'assistant', 'tablet', 'tablet_pin', 'sup_mk', 'anon'}),
        ('PATCH', '/api/attendance/2026-11-23_{mk}', {'reason': 'x', 'status': 'none'}, set(ROLES) - MK_ADMIN),
    ]


def test_writes_outside_reach_are_refused_and_change_nothing(srv, who, rec):
    o = who['owner']
    before = {p: o.get(p).text for p in ['/api/rooms/rh-t1', '/api/rooms/mk-i1', '/api/children/' + rec['t1'], '/api/children/' + rec['mk'], '/api/users?location=rh',
                                         '/api/users?location=mk', '/api/devices?location=rh', '/api/devices?location=mk', '/api/locations/rh', '/api/enrollments?location=rh', '/api/contacts?location=rh', '/api/contacts?location=mk']}
    bad = []
    for method, path, body, refused in denied_writes(rec):
        p = path.format(**rec)
        b = None if body is None else {k: ([x.format(**rec) for x in v] if isinstance(v, list) else v.format(**rec) if isinstance(v, str) else v) for k, v in body.items()}
        for role in refused:
            r = who[role].request(method, p, b if b is not None else ({} if method != 'DELETE' else None))
            if r.status not in (401, 403):
                bad.append((role, method, p, r.status))
    assert bad == []
    for p, t in before.items():
        now = o.get(p).text
        if p.startswith('/api/users'):   # sign-in times change; compare without them
            import json, re
            strip = lambda s: re.sub(r'"lastLoginAt":"[^"]*",?', '', s)
            now, t = strip(now), strip(t)
        assert now == t, 'changed: ' + p


def test_teacher_and_tablet_cannot_record_for_other_rooms_or_past_days(srv, who, rec):
    for role in ['teacher', 'tablet_pin', 'assistant']:
        c = who[role]
        for route, extra in [('check-in', {}), ('check-out', {}), ('absent', {'reason': 'sick'})]:
            r = c.post('/api/attendance/' + route, dict({'childIds': [rec['p1'], rec['mk']]}, **extra))
            assert r.status == 200 and not any(x['ok'] for x in r.json['results']), (role, route, r)
            r = c.post('/api/attendance/' + route, dict({'childIds': [rec['t1']], 'date': PAST}, **extra))
            assert r.status == 200 and not r.json['results'][0]['ok'], (role, route, 'past', r)
        assert c.post('/api/attendance/undo', {'childId': rec['p1']}).status == 403
        assert c.post('/api/attendance/undo', {'childId': rec['t1'], 'date': PAST}).status == 403
        assert c.post('/api/entries', {'childIds': [rec['p1']], 'type': 'note', 'data': {'kind': 'general', 'text': 'x'}}).status == 403
        assert c.post('/api/entries', {'childIds': [rec['t1']], 'type': 'note', 'date': PAST, 'data': {'kind': 'general', 'text': 'x'}}).status == 403
    # a tablet without a PIN unlock cannot write at all
    r = who['tablet'].post('/api/attendance/check-in', {'childIds': [rec['t1']]})
    assert r.status == 403 and r.json['details']['code'] == 'pin_required'
    r = who['tablet'].post('/api/entries', {'childIds': [rec['t1']], 'type': 'note', 'data': {'kind': 'general', 'text': 'x'}})
    assert r.status == 403 and r.json['details']['code'] == 'pin_required'
    assert who['tablet'].post('/api/staff-attendance/clock-in', {'roomId': 'rh-t1'}).status == 403
    # nothing was written for Preschool 1, Markham or the past day by those requests
    o = who['owner']
    att = {a['childId']: a for a in o.get('/api/attendance?location=rh').json}
    assert rec['p1'] not in att or not (att[rec['p1']].get('checkIn') or {}).get('by', {}).get('id', '').startswith('u-t-rh-t1')
    assert not o.get('/api/attendance?location=mk').json or all(a['childId'] != rec['mk'] for a in o.get('/api/attendance?location=mk').json if (a.get('checkIn') or {}).get('by', {}).get('id', '').startswith('u-t-rh'))


def test_mass_assignment_is_ignored(srv, who, rec):
    s = who['sup_rh']
    r = s.post('/api/children', {'locationId': 'rh', 'firstName': 'Mass', 'lastName': 'Assign', 'dateOfBirth': '2024-01-01', 'id': 'chosen-id', 'deleted': True, 'createdBy': {'id': 'u-owner'}, 'locationIdX': 'mk'})
    assert r.status == 201 and r.json['id'] != 'chosen-id' and not r.json.get('deleted') and r.json['createdBy']['id'] == 'u-super-rh'
    r = s.patch('/api/children/' + r.json['id'], {'locationId': 'mk', 'id': 'other', 'createdBy': {'id': 'x'}})
    assert r.json['locationId'] == 'rh' and r.json['createdBy']['id'] == 'u-super-rh'
    r = s.post('/api/users', {'name': 'Mass Teacher', 'email': 'mass.t@example.test', 'role': 'teacher', 'locationIds': ['rh'], 'roomIds': ['rh-t1'], 'passwordHash': 'scrypt$1$1$1$x$y', 'mustChangePassword': False, 'pinHash': 'x', 'active': True})
    assert r.status == 201 and r.json['user']['mustChangePassword'] is True and r.json['user']['hasPin'] is False
    uid = r.json['user']['id']
    r = s.patch('/api/users/' + uid, {'mustChangePassword': False, 'passwordHash': 'x', 'deleted': True, 'role': 'teacher', 'createdBy': {'id': 'x'}})
    assert r.status == 200 and r.json['mustChangePassword'] is True
    t = who['tablet_pin']
    r = t.post('/api/entries', {'childIds': [rec['t1']], 'type': 'note', 'data': {'kind': 'general', 'text': 'hi', 'extra': 'x'}, 'roomId': 'rh-p1', 'locationId': 'mk', 'createdBy': {'id': 'u-owner'}})
    assert r.status == 201 and r.json[0]['roomId'] == 'rh-t1' and r.json[0]['locationId'] == 'rh' and r.json[0]['createdBy']['id'] == 'u-t-rh-t1' and 'extra' not in r.json[0]['data']
    r = t.patch('/api/entries/' + r.json[0]['id'], {'roomId': 'rh-p1', 'date': PAST, 'deleted': True, 'time': '10:30'})
    assert r.json['roomId'] == 'rh-t1' and r.json['date'] == TODAY and not r.json.get('deleted')
    r = s.post('/api/devices', {'locationId': 'rh', 'username': 'rh-mass-tab', 'name': 'Mass', 'roomIds': ['rh-t1'], 'passwordHash': 'x', 'locationIdX': 'mk'})
    assert r.status == 201
    r = s.patch('/api/devices/' + r.json['device']['id'], {'locationId': 'mk', 'username': 'stolen'})
    assert r.json['locationId'] == 'rh' and r.json['username'] == 'rh-mass-tab'


def test_write_responses_never_include_hashes(who):
    s, o = who['sup_rh'], who['owner']
    texts = [s.post('/api/users', {'name': 'Hash Check', 'email': 'hash.check@example.test', 'role': 'teacher', 'locationIds': ['rh']}).text]
    uid = [u['id'] for u in s.get('/api/users?location=rh').json if u['email'] == 'hash.check@example.test'][0]
    texts += [s.patch('/api/users/' + uid, {'title': 'x'}).text, s.put('/api/users/%s/pin' % uid, {'pin': '5831'}).text, s.post('/api/users/%s/reset-password' % uid).text]
    r = s.post('/api/devices', {'locationId': 'rh', 'username': 'rh-hash-tab', 'name': 'Hash', 'roomIds': ['rh-t1']})
    texts += [r.text, s.patch('/api/devices/' + r.json['device']['id'], {'name': 'Hash 2'}).text, o.get('/api/auth/me').text]
    for t in texts:
        assert 'scrypt$' not in t and 'passwordHash' not in t and 'pinHash' not in t


def test_sleeping_child_of_another_room_cannot_be_woken_by_another_room(srv, who, ids):
    kid = ids['kids']['rh-p2'][0]
    fl = who['floater']
    fl.post('/api/attendance/check-in', {'childIds': [kid]})
    r = fl.post('/api/entries', {'childIds': [kid], 'type': 'nap', 'data': {'start': '09:30'}})
    assert r.status == 201
    for role in ['teacher', 'tablet_pin', 'sup_mk']:
        assert who[role].post('/api/entries/nap-end', {'childIds': [kid]}).status == 403, role
        assert who[role].post('/api/entries/%s/sleep-check' % r.json[0]['id'], {}).status == 403, role
    assert not [e for e in who['owner'].get('/api/entries?location=rh&type=nap').json if e['childId'] == kid][0]['data'].get('end')
