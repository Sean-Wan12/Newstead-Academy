"""Sign-in, sessions, cookies, CSRF/origin checks, rate limits, PIN unlock and auto-lock,
temporary passwords, deactivation and tablets losing access, headers and request limits."""
import hmac, hashlib, base64, json, socket, time
import pytest
from conftest import PW, TABLET_PW


def test_cookie_is_httponly_samesite_strict_and_session_rotates_on_login(srv):
    c = srv.client()
    r = c.post('/api/auth/login', {'email': PW['teacher'][0], 'password': PW['teacher'][1]})
    sc = r.headers['set-cookie']
    assert 'HttpOnly' in sc and 'SameSite=Strict' in sc and 'Path=/' in sc
    first = dict(c.cookies)
    # session fixation: a cookie the browser already had is replaced on sign-in, and the old one stops working
    r = c.post('/api/auth/login', {'email': PW['teacher'][0], 'password': PW['teacher'][1]})
    assert c.cookies != first
    old = srv.client(); old.cookies = first
    assert old.get('/api/auth/me').json['signedIn'] is False


def test_tampered_forged_and_signed_out_cookies_are_rejected(srv):
    c = srv.user('teacher')
    name, val = next(iter(c.cookies.items()))
    token, sig = val.rsplit('.', 1)
    for bad in [token + '.' + sig[:-2] + ('AA' if not sig.endswith('AA') else 'BB'), 'x' + val[1:], token, '.' + sig, 'a' * 300, val + '%00']:
        x = srv.client(); x.cookies = {name: bad}
        assert x.get('/api/auth/me').json['signedIn'] is False
        assert x.get('/api/meta').status == 401
    # a self-made token signed with a guessed key does not work
    tok = base64.urlsafe_b64encode(b'0' * 32).decode().rstrip('=')
    forged = tok + '.' + base64.urlsafe_b64encode(hmac.new(b'secret', tok.encode(), hashlib.sha256).digest()).decode().rstrip('=')
    x = srv.client(); x.cookies = {name: forged}
    assert x.get('/api/meta').status == 401
    # signing out ends the server-side session: a copied cookie is useless afterwards
    copy = srv.client(); copy.cookies = dict(c.cookies)
    c.post('/api/auth/logout')
    assert copy.get('/api/meta').status == 401


def test_session_expires_after_idle_time(srv):
    c = srv.user('teacher')
    srv.advance(4 * 60 + 5)
    assert c.get('/api/meta').status == 401
    srv.set_time('2026-11-23 10:00')


@pytest.mark.parametrize('origin', ['http://evil.example', 'null', 'http://127.0.0.1:1'])
def test_cross_site_writes_are_refused(srv, origin):
    c = srv.user('sup_rh')
    c.origin = origin
    assert c.patch('/api/rooms/rh-t1', {'operatingCapacity': 3}).status == 403
    c.origin = None   # no Origin header and no Sec-Fetch-Site
    assert c.patch('/api/rooms/rh-t1', {'operatingCapacity': 3}).status == 403
    assert c.patch('/api/rooms/rh-t1', {'operatingCapacity': 3}, headers={'Sec-Fetch-Site': 'cross-site'}).status == 403
    assert c.patch('/api/rooms/rh-t1', {'operatingCapacity': 15}, headers={'Sec-Fetch-Site': 'same-origin'}).status == 200


def test_writes_must_be_json(srv):
    c = srv.user('sup_rh')
    for ctype in ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']:
        r = c.request('PATCH', '/api/rooms/rh-t1', raw=b'{"operatingCapacity":3}', headers={'Content-Type': ctype})
        assert r.status == 415, ctype


@pytest.mark.parametrize('raw', [b'{', b'[1,2]', b'"text"', b'null', b'\xff\xfe', b'{"operatingCapacity": 1e400}'], ids=['cut-off', 'array', 'string', 'null', 'bad-utf8', 'huge-number'])
def test_malformed_json_gives_400(srv, raw):
    c = srv.user('sup_rh')
    r = c.request('PATCH', '/api/rooms/rh-t1', raw=raw, headers={'Content-Type': 'application/json'})
    assert r.status == 400, (raw[:20], r.status)


def test_deeply_nested_and_prototype_keys_are_ignored(srv):
    c = srv.user('sup_rh')
    r = c.request('PATCH', '/api/rooms/rh-t1', raw=b'{"x":' + b'[' * 3000 + b']' * 3000 + b', "__proto__": {"licensedCapacity": 99}, "constructor": {"prototype": {"admin": true}}}', headers={'Content-Type': 'application/json'})
    assert r.status == 200 and r.json['licensedCapacity'] == 15
    assert srv.user('teacher').get('/api/users?location=rh').status == 403


def test_REGRESSION_oversized_body_gets_413_not_a_reset_connection(srv):
    c = srv.user('sup_rh')
    r = c.request('POST', '/api/children', raw=b'{"notes":"' + b'x' * 300000 + b'"}', headers={'Content-Type': 'application/json'})
    assert r.status == 413
    assert c.get('/api/meta').status == 200, 'server still answers'


def test_security_headers_on_pages_and_api(srv):
    c = srv.client()
    for path in ['/', '/login', '/admin', '/teacher', '/js/shared/dom.js', '/api/auth/me', '/api/nope']:
        h = c.get(path).headers
        assert h.get('x-content-type-options') == 'nosniff', path
        assert h.get('x-frame-options') == 'DENY', path
        csp = h.get('content-security-policy', '')
        assert "default-src 'self'" in csp and "frame-ancestors 'none'" in csp and 'unsafe-inline' not in csp, path
    assert c.get('/api/auth/me').headers.get('cache-control') == 'no-store'


def raw_get(srv, path):
    s = socket.create_connection(('127.0.0.1', srv.port)); s.sendall(('GET %s HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n' % path).encode())
    data = b''
    while True:
        b = s.recv(65536)
        if not b:
            break
        data += b
    s.close()
    return int(data.split(b' ')[1]), data


@pytest.mark.parametrize('path', ['/../server.js', '/..%2fserver.js', '/js/..%2f..%2fserver.js', '/%2e%2e%2f.data/users.json', '/..%2f..%2f.data%2fusers.json',
                                  '/%2e%2e/lib/secret.js', '/js/%2e%2e%5c..%5cserver.js', '/%00', '/admin.html%00.js', '/.data/.dev-secret', '//etc/passwd'])
def test_static_files_cannot_escape_public(srv, path):
    status, data = raw_get(srv, path)
    assert status in (400, 403, 404), path
    assert b'scrypt$' not in data and b'require(' not in data


def test_login_rate_limit_locks_the_account(srv):
    c = srv.client()
    email = PW['floater'][0]
    for i in range(5):
        assert c.post('/api/auth/login', {'email': email, 'password': 'wrong-password-%d' % i}).status == 401
    r = c.post('/api/auth/login', {'email': email, 'password': PW['floater'][1]})
    assert r.status == 429 and r.headers.get('retry-after')
    srv.advance(16)
    assert c.post('/api/auth/login', {'email': email, 'password': PW['floater'][1]}).status == 200
    srv.set_time('2026-11-23 10:00')


def test_unknown_email_and_wrong_password_look_the_same(srv):
    c = srv.client()
    a = c.post('/api/auth/login', {'email': 'nobody@example.test', 'password': 'whatever-123'})
    b = c.post('/api/auth/login', {'email': PW['assistant'][0], 'password': 'whatever-123'})
    assert a.status == b.status == 401 and a.json['error'] == b.json['error']


def test_REGRESSION_pin_guessing_is_not_reset_by_a_correct_pin_of_another_person(srv):
    """A teacher could guess a supervisor's PIN without limit by entering their own PIN after every 4 wrong guesses."""
    t = srv.tablet('rh-toddler-2')
    locked = False
    for i in range(8):
        r = t.post('/api/auth/pin-unlock', {'userId': 'u-super-rh', 'pin': '%04d' % (5000 + i)})
        if r.status == 429:
            locked = True; break
        if i % 4 == 3:
            t.post('/api/auth/pin-unlock', {'userId': 'u-t-rh-t2', 'pin': '2581'})
    assert locked, 'PIN guessing never locked'


def test_pin_unlock_lasts_10_minutes_after_the_last_write(srv, ids):
    t = srv.tablet('rh-toddler-3', 'u-t-rh-t3', '2582')
    kid = ids['kids']['rh-t3'][0]
    note = {'childIds': [kid], 'type': 'note', 'data': {'kind': 'general', 'text': 'x'}}
    assert t.post('/api/entries', note).status == 201
    srv.advance(8)
    assert t.get('/api/auth/me').json['actor']['id'] == 'u-t-rh-t3'
    assert t.post('/api/entries', note).status == 201      # a write extends the unlock
    srv.advance(9)
    for _ in range(3):
        assert t.get('/api/meta').status == 200            # reads do not keep it unlocked
    srv.advance(2)
    r = t.post('/api/entries', note)
    assert r.status == 403 and r.json['details']['code'] == 'pin_required'
    assert t.get('/api/auth/me').json['actor'] is None
    assert t.post('/api/auth/pin-unlock', {'userId': 'u-t-rh-t3', 'pin': '2582'}).status == 200
    assert t.post('/api/auth/pin-lock').status == 200
    assert t.post('/api/entries', note).status == 403
    srv.set_time('2026-11-23 10:00')


def test_pin_unlock_only_for_staff_of_that_tablet(srv):
    t = srv.tablet('rh-toddler-1')
    names = {s['id'] for s in t.get('/api/auth/device-staff').json}
    assert names == {'u-t-rh-t1', 'u-t-rh-t1b', 'u-super-rh'}
    for uid, pin in [('u-t-rh-p1', '2583'), ('u-super-mk', '7392'), ('u-t-mk-i1', '2588')]:
        assert t.post('/api/auth/pin-unlock', {'userId': uid, 'pin': pin}).status == 401


def test_deactivated_user_loses_access_immediately_including_on_tablets(srv):
    s = srv.user('sup_rh')
    t = srv.user('teacher_p1')
    tab = srv.tablet('rh-preschool-1', 'u-t-rh-p1', '2583')
    assert s.patch('/api/users/u-t-rh-p1', {'active': False}).status == 200
    assert t.get('/api/meta').status == 401
    assert tab.get('/api/auth/me').json['actor'] is None
    assert srv.client().post('/api/auth/login', {'email': PW['teacher_p1'][0], 'password': PW['teacher_p1'][1]}).status == 401
    assert tab.post('/api/auth/pin-unlock', {'userId': 'u-t-rh-p1', 'pin': '2583'}).status == 401
    assert s.patch('/api/users/u-t-rh-p1', {'active': True}).status == 200


def test_REGRESSION_removing_a_teacher_from_a_room_ends_their_unlock_on_its_tablet(srv):
    s = srv.user('sup_rh')
    tab = srv.tablet('rh-preschool-2', 'u-t-rh-float', '2468')
    assert s.patch('/api/users/u-t-rh-float', {'roomIds': ['rh-p1']}).status == 200
    assert tab.get('/api/auth/me').json['actor'] is None
    assert s.patch('/api/users/u-t-rh-float', {'roomIds': ['rh-p1', 'rh-p2']}).status == 200


def test_disabled_or_removed_tablet_is_signed_out_immediately(srv):
    s = srv.user('sup_rh')
    tab = srv.tablet('rh-kindergarten-1')
    assert s.patch('/api/devices/d-rh-k1', {'active': False}).status == 200
    assert tab.get('/api/meta').status == 401
    assert srv.client().post('/api/auth/device-login', {'username': 'rh-kindergarten-1', 'password': TABLET_PW}).status == 401
    assert s.patch('/api/devices/d-rh-k1', {'active': True}).status == 200
    tab = srv.tablet('rh-kindergarten-1')
    r = s.post('/api/devices/d-rh-k1/reset-password')
    assert tab.get('/api/meta').status == 401
    assert srv.client().post('/api/auth/device-login', {'username': 'rh-kindergarten-1', 'password': r.json['password']}).status == 200


def test_REGRESSION_a_removed_tablet_login_name_can_be_reused(srv):
    s = srv.user('sup_rh')
    r = s.post('/api/devices', {'locationId': 'rh', 'username': 'rh-spare-tab', 'name': 'Spare', 'roomIds': ['rh-t1']})
    assert s.delete('/api/devices/' + r.json['device']['id']).status == 200
    r = s.post('/api/devices', {'locationId': 'rh', 'username': 'rh-spare-tab', 'name': 'Spare 2', 'roomIds': ['rh-t1']})
    assert r.status == 201
    assert srv.client().post('/api/auth/device-login', {'username': 'rh-spare-tab', 'password': r.json['password']}).status == 200


def test_temporary_password_must_be_changed_first(srv):
    s = srv.user('sup_rh')
    r = s.post('/api/users', {'name': 'Temp Person', 'email': 'temp.person@example.test', 'role': 'teacher', 'locationIds': ['rh'], 'roomIds': ['rh-t2']})
    temp = r.json['temporaryPassword']
    c = srv.client()
    r = c.post('/api/auth/login', {'email': 'temp.person@example.test', 'password': temp})
    assert r.status == 200 and r.json['mustChangePassword'] is True
    for path in ['/api/meta', '/api/rooms?location=rh', '/api/children?location=rh']:
        r = c.get(path)
        assert r.status == 403 and r.json['details']['code'] == 'password_change_required', path
    assert c.put('/api/auth/pin', {'currentPassword': temp, 'pin': '5831'}).status == 403
    assert c.post('/api/auth/password', {'currentPassword': temp, 'newPassword': 'short'}).status == 400
    assert c.post('/api/auth/password', {'currentPassword': 'wrong', 'newPassword': 'A-much-longer-one-1'}).status == 400
    assert c.post('/api/auth/password', {'currentPassword': temp, 'newPassword': 'A-much-longer-one-1'}).status == 200
    assert c.get('/api/meta').status == 200
    assert srv.client().post('/api/auth/login', {'email': 'temp.person@example.test', 'password': temp}).status == 401


def test_password_reset_signs_the_person_out_everywhere(srv):
    s = srv.user('sup_rh')
    t = srv.user('assistant')
    r = s.post('/api/users/u-t-rh-t1b/reset-password')
    assert t.get('/api/meta').status == 401
    c = srv.client()
    assert c.post('/api/auth/login', {'email': PW['assistant'][0], 'password': r.json['temporaryPassword']}).json['mustChangePassword'] is True
    assert c.post('/api/auth/password', {'currentPassword': r.json['temporaryPassword'], 'newPassword': PW['assistant'][1]}).status == 200


def test_supervisor_cannot_reach_the_other_location_or_raise_roles(srv):
    s = srv.user('sup_rh')
    assert s.post('/api/users', {'name': 'X', 'email': 'x.sup@example.test', 'role': 'admin', 'locationIds': ['rh']}).status == 403
    assert s.post('/api/users', {'name': 'X', 'email': 'x.own@example.test', 'role': 'owner'}).status == 403
    assert s.post('/api/users', {'name': 'X', 'email': 'x.mk@example.test', 'role': 'teacher', 'locationIds': ['mk']}).status == 403
    assert s.post('/api/users', {'name': 'X', 'email': 'x.mix@example.test', 'role': 'teacher', 'locationIds': ['rh'], 'roomIds': ['mk-i1']}).status == 400
    assert s.patch('/api/users/u-super-rh', {'role': 'owner'}).status == 403
    assert s.put('/api/users/u-super-mk/pin', {'pin': '5831'}).status == 403


def test_REGRESSION_current_password_cannot_be_guessed_through_a_signed_in_session(srv):
    """Change password and set PIN checked the current password with no attempt limit."""
    c = srv.user('teacher_mk')
    codes = [c.put('/api/auth/pin', {'currentPassword': 'guess-%d' % i, 'pin': '5831'}).status for i in range(6)]
    assert codes[:5] == [400] * 5 and codes[5] == 429
    assert c.post('/api/auth/password', {'currentPassword': PW['teacher_mk'][1], 'newPassword': 'Another-password-1'}).status == 429
    srv.advance(16)
    c = srv.user('teacher_mk')
    assert c.put('/api/auth/pin', {'currentPassword': PW['teacher_mk'][1], 'pin': '5831'}).status == 200
    srv.set_time('2026-11-23 10:00')
