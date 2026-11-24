"""Concurrent writes to the JSON store, crash safety, restart persistence, empty states and long text."""
import json, os, signal, threading, time, glob
import pytest
from conftest import Server, PW, TABLET_PW


@pytest.fixture(scope='module')
def srv():
    s = Server(quiet=True)
    yield s
    s.cleanup()


def race(a, b, delay=0.01):
    t = threading.Thread(target=a); t.start(); time.sleep(delay); b(); t.join()


def test_REGRESSION_signing_in_does_not_undo_a_deactivation_made_at_the_same_moment(srv):
    """Sign-in wrote back the account it read before the slow password check, re-activating an account a supervisor had just deactivated."""
    sup = srv.user('sup_rh')
    for _ in range(5):
        assert sup.patch('/api/users/u-t-rh-t2', {'active': True}).status == 200
        c = srv.client()
        race(lambda: c.post('/api/auth/login', {'email': 'teacher.rh.t2@demo.newstead.test', 'password': PW['teacher'][1]}),
             lambda: sup.patch('/api/users/u-t-rh-t2', {'active': False}))
        u = [x for x in sup.get('/api/users?location=rh').json if x['id'] == 'u-t-rh-t2'][0]
        assert u['active'] is False
        assert c.get('/api/meta').status == 401
    sup.patch('/api/users/u-t-rh-t2', {'active': True})


def test_REGRESSION_tablet_sign_in_or_password_reset_does_not_undo_turning_a_tablet_off(srv):
    sup = srv.user('sup_rh')
    for _ in range(3):
        sup.patch('/api/devices/d-rh-t2', {'active': True})
        c = srv.client()
        race(lambda: c.post('/api/auth/device-login', {'username': 'rh-toddler-2', 'password': TABLET_PW}), lambda: sup.patch('/api/devices/d-rh-t2', {'active': False}))
        assert [d for d in sup.get('/api/devices?location=rh').json if d['id'] == 'd-rh-t2'][0]['active'] is False
        sup.patch('/api/devices/d-rh-t2', {'active': True})
        sup2 = srv.user('sup_rh')
        race(lambda: sup2.post('/api/devices/d-rh-t2/reset-password'), lambda: sup.patch('/api/devices/d-rh-t2', {'active': False}), 0.005)
        assert [d for d in sup.get('/api/devices?location=rh').json if d['id'] == 'd-rh-t2'][0]['active'] is False
    sup.patch('/api/devices/d-rh-t2', {'active': True})
    sup.post('/api/devices/d-rh-t2/reset-password')   # password now unknown: give it back the demo one via a fresh server is not possible, so tablets for t2 are not used below


def test_REGRESSION_password_reset_does_not_undo_a_concurrent_deactivation(srv):
    a, b = srv.user('sup_rh'), srv.user('owner')
    for _ in range(3):
        b.patch('/api/users/u-t-rh-t3b', {'active': True})
        race(lambda: a.post('/api/users/u-t-rh-t3b/reset-password'), lambda: b.patch('/api/users/u-t-rh-t3b', {'active': False}), 0.005)
        assert [x for x in b.get('/api/users?location=rh').json if x['id'] == 'u-t-rh-t3b'][0]['active'] is False


def test_many_tablets_writing_at_once_lose_nothing(srv):
    o = srv.user('owner')
    rooms = ['rh-t1', 'rh-t3', 'rh-p1', 'rh-p2', 'rh-p3']
    tabs = {'rh-t1': ('rh-toddler-1', 'u-t-rh-t1', '2580'), 'rh-t2': ('rh-toddler-2', 'u-t-rh-t2', '2581'), 'rh-t3': ('rh-toddler-3', 'u-t-rh-t3', '2582'),
            'rh-p1': ('rh-preschool-1', 'u-t-rh-p1', '2583'), 'rh-p2': ('rh-preschool-2', 'u-t-rh-p2', '2584'), 'rh-p3': ('rh-preschool-3', 'u-t-rh-p3', '2585')}
    work = []
    for r in rooms:
        t = srv.tablet(*tabs[r])
        for cid in [c['id'] for c in o.get('/api/children?location=rh&status=active&room=' + r).json]:
            work.append((t, cid))
    errors = []
    def go(t, cid):
        r1 = t.post('/api/attendance/check-in', {'childIds': [cid]})
        r2 = t.post('/api/entries', {'childIds': [cid], 'type': 'meal', 'data': {'meal': 'am_snack', 'amount': 'all'}})
        if r1.status != 200 or not r1.json['ok'] or r2.status != 201:
            errors.append(cid)
    ths = [threading.Thread(target=go, args=w) for w in work]
    [x.start() for x in ths]; [x.join() for x in ths]
    assert errors == []
    ids = {w[1] for w in work}
    assert {a['childId'] for a in o.get('/api/attendance?location=rh').json if a['status'] == 'in'} >= ids
    assert len([e for e in o.get('/api/entries?location=rh&type=meal').json if e['childId'] in ids]) == len(ids)
    # and they are on disk: a restart keeps them
    srv.restart()
    o = srv.user('owner')
    assert {a['childId'] for a in o.get('/api/attendance?location=rh').json if a['status'] == 'in'} >= ids


def test_sessions_and_data_survive_a_restart(srv):
    t = srv.user('teacher')
    kid = [c['id'] for c in t.get('/api/children?location=rh').json][0]
    t.post('/api/entries', {'childIds': [kid], 'type': 'note', 'data': {'kind': 'general', 'text': 'before restart'}})
    srv.restart()
    assert t.get('/api/auth/me').json['signedIn'] is True
    assert any(e['data'].get('text') == 'before restart' for e in t.get('/api/entries?location=rh').json)


def test_killed_mid_write_leaves_valid_files(srv):
    o = srv.user('owner')
    kids = [c['id'] for c in o.get('/api/children?location=rh&status=active').json]
    stop = threading.Event()
    def spam():
        c = srv.user('sup_rh'); i = 0
        while not stop.is_set():
            try:
                c.post('/api/entries', {'childIds': kids[:20], 'type': 'note', 'data': {'kind': 'general', 'text': 'n%d' % i}}); i += 1
            except Exception:
                return
    th = [threading.Thread(target=spam) for _ in range(4)]
    [x.start() for x in th]
    time.sleep(1.0)
    srv.stop(signal.SIGKILL)
    stop.set(); [x.join() for x in th]
    for f in glob.glob(os.path.join(srv.data, '*.json')):
        with open(f) as fh:
            json.load(fh)    # every collection file is complete JSON
    leftovers = glob.glob(os.path.join(srv.data, '*.tmp'))
    srv.start()
    o = srv.user('owner')
    assert o.get('/api/entries?location=rh').status == 200
    assert len(leftovers) <= 1


def test_empty_states(srv):
    o = srv.user('owner')
    r = o.post('/api/rooms', {'locationId': 'mk', 'name': 'Empty Room', 'ageGroup': 'Preschool', 'licensedCapacity': 8})
    assert r.status == 201
    rid = r.json['id']
    st = o.get('/api/rooms/%s/status' % rid).json
    assert st['counts']['placed'] == 0 and st['ratio']['level'] == 'empty' and st['ratio']['needed'] == 0
    d = o.get('/api/dashboard?location=mk&date=2026-11-28').json     # a Saturday
    assert d['totals']['scheduled'] == 0 and d['totals']['notArrived'] == 0
    assert o.get('/api/children?location=mk&room=' + rid).json == []
    assert o.get('/api/entries?location=mk&date=2026-11-28').json == []
    assert o.get('/api/forecast?location=mk').status == 200
    assert o.delete('/api/rooms/' + rid).status == 200


def test_long_text_is_limited_not_crashing(srv):
    s = srv.user('sup_rh')
    long = 'W' * 61
    assert s.post('/api/children', {'locationId': 'rh', 'firstName': long, 'lastName': 'X', 'dateOfBirth': '2024-01-01'}).status == 400
    r = s.post('/api/children', {'locationId': 'rh', 'firstName': 'W' * 60, 'lastName': 'Wolfeschlegelsteinhausenbergerdorff-Wolfeschlegelsteinhause', 'dateOfBirth': '2024-01-01',
                                 'enrollment': {'roomId': 'rh-t1', 'startDate': '2026-11-01'}})
    assert r.status == 201
    assert s.post('/api/children', {'locationId': 'rh', 'firstName': 'A', 'lastName': 'B', 'dateOfBirth': '2030-01-01'}).status == 400
    assert s.post('/api/children', {'locationId': 'rh', 'firstName': 'A', 'lastName': 'B', 'dateOfBirth': '2026-02-30'}).status == 400


def test_REGRESSION_child_is_not_saved_when_its_first_placement_is_refused(srv):
    """POST /api/children saved the child, then failed on a placement in another location's room, leaving a child with no room."""
    s = srv.user('sup_rh')
    count = lambda: len(s.get('/api/children?location=rh').json)
    before = count()
    r = s.post('/api/children', {'locationId': 'rh', 'firstName': 'Half', 'lastName': 'Saved', 'dateOfBirth': '2024-01-01', 'enrollment': {'roomId': 'mk-i1', 'startDate': '2026-11-01'}})
    assert r.status in (400, 403)
    assert count() == before
