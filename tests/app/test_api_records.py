"""Attendance, sleep, entries, staff in rooms and ratios, the dashboard, room moves, and
Toronto dates around midnight and daylight saving time. Uses a seed with no sample day, so
every count is known."""
import pytest
from conftest import Server


@pytest.fixture(scope='module')
def srv():
    s = Server(quiet=True)
    yield s
    s.cleanup()


@pytest.fixture(scope='module')
def o(srv):
    return srv.user('owner')


def kids(o, room, loc='rh'):
    return [c['id'] for c in o.get('/api/children?location=%s&room=%s' % (loc, room)).json]


def att(o, cid, loc='rh', date=None):
    for a in o.get('/api/attendance?location=%s%s' % (loc, '&date=' + date if date else '')).json:
        if a['childId'] == cid:
            return a
    return None


def one(r):
    assert r.status == 200, r
    return r.json['results'][0]


def test_attendance_check_in_out_absent_undo(srv, o):
    t = srv.user('teacher')
    a, b = kids(o, 'rh-t1')[:2]
    assert one(t.post('/api/attendance/check-in', {'childIds': [a], 'time': '08:05', 'person': 'Parent'}))['ok']
    r = one(t.post('/api/attendance/check-in', {'childIds': [a]}))
    assert not r['ok'] and 'already checked in' in r['error']
    r = one(t.post('/api/attendance/check-out', {'childIds': [a], 'time': '07:00'}))
    assert not r['ok'] and 'before the check-in' in r['error']
    assert not one(t.post('/api/attendance/check-out', {'childIds': [b]}))['ok'], 'check-out before check-in is refused'
    assert one(t.post('/api/attendance/check-out', {'childIds': [a], 'time': '16:30', 'person': 'Grandparent'}))['ok']
    assert not one(t.post('/api/attendance/check-in', {'childIds': [a]}))['ok'], 'no second check-in after check-out'
    assert not one(t.post('/api/attendance/absent', {'childIds': [a], 'reason': 'sick'}))['ok'], 'no absent after attending'
    rec = att(o, a)
    assert rec['status'] == 'out' and rec['checkIn']['time'] == '08:05' and rec['checkOut']['person'] == 'Grandparent' and rec['checkIn']['by']['id'] == 'u-t-rh-t1'
    assert t.post('/api/attendance/undo', {'childId': a}).json['status'] == 'in'
    assert t.post('/api/attendance/undo', {'childId': a}).json['status'] is None
    assert t.post('/api/attendance/undo', {'childId': a}).status == 409
    rec = att(o, a)
    assert [h['change'] for h in rec['history']] == ['undo out', 'undo in'] and rec['history'][1]['before']['checkIn']['time'] == '08:05'
    assert one(t.post('/api/attendance/absent', {'childIds': [b], 'reason': 'sick', 'note': 'fever'}))['ok']
    assert one(t.post('/api/attendance/check-in', {'childIds': [b], 'time': '10:15'}))['ok'], 'a child marked absent who then arrives can be checked in'
    assert att(o, b)['absent'] is None


def test_attendance_correction_keeps_history_and_needs_a_reason(srv, o):
    t = srv.user('teacher')
    c = kids(o, 'rh-t1')[2]
    one(t.post('/api/attendance/check-in', {'childIds': [c], 'time': '08:30'}))
    rid = '2026-11-23_' + c
    assert t.patch('/api/attendance/' + rid, {'checkInTime': '08:00'}).status == 400
    r = t.patch('/api/attendance/' + rid, {'reason': 'Arrived earlier', 'checkInTime': '08:00', 'status': 'out', 'checkOutTime': '07:59'})
    assert r.status == 400
    r = t.patch('/api/attendance/' + rid, {'reason': 'Arrived earlier', 'checkInTime': '08:00'})
    assert r.status == 200 and r.json['checkIn']['time'] == '08:00'
    h = r.json['history'][-1]
    assert h['reason'] == 'Arrived earlier' and h['before']['checkIn']['time'] == '08:30' and h['by']['id'] == 'u-t-rh-t1'
    s = srv.user('sup_rh')
    r = s.patch('/api/attendance/' + rid, {'reason': 'Was away', 'status': 'absent', 'absentReason': 'vacation'})
    assert r.json['status'] == 'absent' and r.json['checkIn'] is None and len(r.json['history']) == 2
    assert any(x['action'] == 'correct' and x['recordId'] == rid for x in s.get('/api/audit?location=rh').json)


def test_supervisor_records_other_days(srv, o):
    s = srv.user('sup_rh')
    c = kids(o, 'rh-t2')[0]
    assert one(s.post('/api/attendance/check-in', {'childIds': [c], 'date': '2026-11-20', 'time': '08:00'}))['ok']
    assert att(o, c, date='2026-11-20')['status'] == 'in'
    assert att(o, c) is None


def test_group_entries_are_all_or_nothing(srv, o):
    t = srv.user('teacher')
    mine, other = kids(o, 'rh-t1')[:3], kids(o, 'rh-p1')[0]
    before = len(o.get('/api/entries?location=rh').json)
    r = t.post('/api/entries', {'childIds': mine + [other], 'type': 'meal', 'data': {'meal': 'lunch', 'amount': 'most'}})
    assert r.status == 403 and len(o.get('/api/entries?location=rh').json) == before
    r = t.post('/api/entries', {'childIds': mine, 'type': 'meal', 'data': {'meal': 'lunch', 'amount': 'most', 'items': 'Soup'}})
    assert r.status == 201 and len(r.json) == 3 and len({e['groupId'] for e in r.json}) == 1 and r.json[0]['groupId']
    assert t.post('/api/entries', {'childIds': mine, 'type': 'meal', 'data': {'meal': 'tea', 'amount': 'most'}}).status == 400
    assert t.post('/api/entries', {'childIds': mine[:1], 'type': 'fluids', 'data': {'fluid': 'milk'}}).status == 400, 'fluids are for infant rooms'
    mk = srv.user('teacher_mk')
    assert mk.post('/api/entries', {'childIds': kids(o, 'mk-i1', 'mk')[:1], 'type': 'fluids', 'data': {'fluid': 'formula', 'ounces': 4}}).status == 201


def test_sleep_start_checks_and_end(srv, o):
    t = srv.user('teacher')
    a, b = kids(o, 'rh-t1')[3:5]
    r = t.post('/api/entries', {'childIds': [a, b], 'type': 'nap', 'data': {'start': '12:30'}})
    assert r.status == 201 and all(e['time'] == '12:30' for e in r.json)
    assert t.post('/api/entries', {'childIds': [a], 'type': 'nap', 'data': {'start': '12:40'}}).status == 409
    nap = r.json[0]['id']
    assert t.post('/api/entries/%s/sleep-check' % nap, {'time': '12:45', 'note': 'breathing normally'}).status == 200
    assert t.post('/api/entries/%s/sleep-check' % nap, {'time': '13:00'}).status == 200
    res = t.post('/api/entries/nap-end', {'childIds': [a, b, kids(o, 'rh-t1')[5]], 'time': '12:00'}).json['results']
    assert [x['ok'] for x in res] == [False, False, False]
    res = t.post('/api/entries/nap-end', {'childIds': [a, b], 'time': '14:10'}).json['results']
    assert all(x['ok'] for x in res)
    tl = t.get('/api/children/%s/timeline' % a).json
    kinds = [e['kind'] for e in tl['events']]
    assert kinds == ['entry', 'sleep_check', 'sleep_check', 'nap_end']
    assert t.post('/api/entries', {'childIds': [a], 'type': 'nap', 'data': {'start': '15:00', 'end': '14:00'}}).status == 400


def test_REGRESSION_editing_an_entry_keeps_what_it_said_before(srv, o):
    """Edits recorded only who and when; the earlier text of an incident report was lost."""
    t = srv.user('teacher')
    c = kids(o, 'rh-t1')[6]
    e = t.post('/api/entries', {'childIds': [c], 'type': 'incident', 'time': '10:40', 'data': {'kind': 'injury', 'description': 'Bumped knee on slide', 'actionTaken': 'Ice pack'}}).json[0]
    s = srv.user('sup_rh')
    assert s.post('/api/entries/%s/review' % e['id'], {'note': 'ok'}).status == 200
    r = t.patch('/api/entries/' + e['id'], {'time': '10:45', 'data': {'description': 'Fell from slide'}})
    assert r.status == 200 and r.json['data']['description'] == 'Fell from slide'
    last = r.json['edits'][-1]
    assert last['before']['data']['description'] == 'Bumped knee on slide' and last['before']['time'] == '10:40'
    assert t.delete('/api/entries/' + e['id']).status == 200
    assert all(x['id'] != e['id'] for x in o.get('/api/entries?location=rh').json)
    assert any(x['action'] == 'delete' and x['recordId'] == e['id'] for x in s.get('/api/audit?location=rh').json)


def test_staff_join_leave_and_infant_ratio_3_to_10(srv, o):
    s = srv.user('sup_mk')
    infants = kids(o, 'mk-i1', 'mk')
    assert len(infants) >= 4
    lead = srv.tablet('mk-infant-1', 'u-t-mk-i1', '2588')
    status = lambda: lead.get('/api/rooms/mk-i1/status').json
    assert status()['ratio']['level'] == 'empty'
    assert all(x['ok'] for x in lead.post('/api/attendance/check-in', {'childIds': infants[:3]}).json['results'])
    st = status()
    assert st['ratio']['needed'] == 1 and st['ratio']['level'] == 'short' and st['ratio']['staff'] == 0
    assert lead.post('/api/staff-attendance/clock-in', {'roomId': 'mk-i1'}).status == 200
    assert lead.post('/api/staff-attendance/clock-in', {'roomId': 'mk-i1'}).status == 409
    assert status()['ratio']['level'] == 'ok'
    lead.post('/api/attendance/check-in', {'childIds': infants[3:4]})
    st = status()
    assert st['counts']['in'] == 4 and st['ratio']['needed'] == 2 and st['ratio']['level'] == 'short'
    lead.post('/api/auth/pin-unlock', {'userId': 'u-t-mk-i1b', 'pin': '2688'})
    assert lead.post('/api/staff-attendance/clock-in', {'roomId': 'mk-i1'}).status == 200
    assert status()['ratio']['level'] == 'ok' and len(status()['staff']) == 2
    assert lead.post('/api/staff-attendance/clock-out', {}).status == 200
    assert status()['ratio']['level'] == 'short'
    assert lead.post('/api/staff-attendance/clock-out', {}).status == 409
    # a supervisor moving someone to another room closes the first shift
    assert s.post('/api/staff-attendance/clock-in', {'roomId': 'mk-t1', 'userId': 'u-t-mk-i1'}).status == 200
    shifts = [x for x in s.get('/api/staff-attendance?location=mk').json if x['userId'] == 'u-t-mk-i1']
    assert len(shifts) == 2 and shifts[0]['out'] and not [x for x in shifts if x['roomId'] == 'mk-t1'][0]['out']


def test_dashboard_numbers_match_the_records(srv, o):
    s = srv.user('sup_rh')
    d = s.get('/api/dashboard?location=rh').json
    records = {a['childId']: a for a in o.get('/api/attendance?location=rh').json}
    shifts = [x for x in o.get('/api/staff-attendance?location=rh').json if not x['out']]
    for room in d['rooms']:
        rid = room['room']['id']
        placed = kids(o, rid)
        st = [records.get(c, {}).get('status') for c in placed]
        assert room['counts']['placed'] == len(placed), rid
        assert room['counts']['in'] == st.count('in') and room['counts']['out'] == st.count('out') and room['counts']['absent'] == st.count('absent'), rid
        assert len(room['staff']) == len([x for x in shifts if x['roomId'] == rid]), rid
        assert room['capacity']['overLicensed'] == (len(placed) > room['room']['licensedCapacity'])
    t = d['totals']
    assert t['in'] == sum(r['counts']['in'] for r in d['rooms']) and t['licensed'] == 167


def test_REGRESSION_child_moved_today_is_counted_in_the_new_room(srv, o):
    """A child checked in, then moved to another room from today, dropped out of both rooms' 'here' count and ratio."""
    s = srv.user('sup_rh')
    c = kids(o, 'rh-t3')[0]
    assert one(s.post('/api/attendance/check-in', {'childIds': [c], 'time': '08:00'}))['ok']
    before = {r['room']['id']: r['counts']['in'] for r in s.get('/api/dashboard?location=rh').json['rooms']}
    r = s.post('/api/enrollments', {'childId': c, 'roomId': 'rh-p3', 'startDate': '2026-11-23'})
    assert r.status == 201
    ens = s.get('/api/enrollments?child=' + c).json
    assert ens[-2]['endDate'] == '2026-11-22' and ens[-1]['roomId'] == 'rh-p3', 'the old placement ends the day before'
    after = {r['room']['id']: r['counts']['in'] for r in s.get('/api/dashboard?location=rh').json['rooms']}
    assert sum(after.values()) == sum(before.values())
    assert after['rh-p3'] == before['rh-p3'] + 1 and after['rh-t3'] == before['rh-t3'] - 1
    p3 = srv.tablet('rh-preschool-3', 'u-t-rh-p3', '2585')
    assert c in [a['childId'] for a in p3.get('/api/attendance?location=rh&room=rh-p3').json], 'the new room sees the check-in'
    assert one(p3.post('/api/attendance/check-out', {'childIds': [c], 'time': '15:00'}))['ok']


def test_future_room_move_ends_old_placement_and_switches_on_the_day(srv, o):
    s = srv.user('sup_rh')
    c = kids(o, 'rh-t2')[1]
    assert s.post('/api/enrollments', {'childId': c, 'roomId': 'rh-p1', 'startDate': '2026-12-01'}).status == 201
    assert s.post('/api/enrollments', {'childId': c, 'roomId': 'rh-p2', 'startDate': '2026-11-30'}).status == 409
    ids = lambda date, room: [x['id'] for x in s.get('/api/children?location=rh&room=%s&date=%s' % (room, date)).json]
    assert c in ids('2026-11-30', 'rh-t2') and c not in ids('2026-11-30', 'rh-p1')
    assert c in ids('2026-12-01', 'rh-p1') and c not in ids('2026-12-01', 'rh-t2')


def test_midnight_starts_a_new_day_in_toronto(srv, o):
    t = srv.user('teacher')
    c = kids(o, 'rh-t1')[7]
    srv.set_time('2026-11-23 23:58')
    t, o = srv.user('teacher'), srv.user('owner')
    assert t.get('/api/meta').json['today'] == '2026-11-23'
    one(t.post('/api/attendance/check-in', {'childIds': [c]}))
    assert att(o, c)['checkIn']['time'] == '23:58'
    srv.set_time('2026-11-24 00:01')
    m = t.get('/api/meta').json
    assert m['today'] == '2026-11-24' and m['now'] == '00:01'
    assert att(o, c) is None and att(o, c, date='2026-11-23')['status'] == 'in'
    r = t.patch('/api/attendance/2026-11-23_' + c, {'reason': 'forgot', 'status': 'out', 'checkOutTime': '23:59'})
    assert r.status == 403, 'teachers cannot change yesterday'
    assert t.get('/api/attendance?location=rh&date=2026-11-23').status == 403
    srv.set_time('2026-11-23 10:00')


@pytest.mark.parametrize('when,today,now', [('2027-03-14 01:59', '2027-03-14', '01:59'), ('2027-03-14 03:01', '2027-03-14', '03:01'),
                                            ('2027-11-07 01:30', '2027-11-07', '01:30'), ('2026-12-31 23:59', '2026-12-31', '23:59'), ('2027-01-01 00:00', '2027-01-01', '00:00')])
def test_dst_and_year_end_use_toronto_wall_clock(srv, when, today, now):
    srv.set_time(when)
    m = srv.user('teacher').get('/api/meta').json   # signed in after the clock moved
    assert (m['today'], m['now']) == (today, now)
    srv.set_time('2026-11-23 10:00')


def test_withdrawn_children_leave_room_lists(srv, o):
    s = srv.user('sup_rh')
    c = kids(o, 'rh-k1')[0]
    assert s.patch('/api/children/' + c, {'status': 'withdrawn'}).status == 200
    assert c not in [x['id'] for x in o.get('/api/children?location=rh&room=rh-k1&status=active').json]
    assert c not in [x['id'] for x in srv.user('teacher').get('/api/children?location=rh').json]
    st = s.get('/api/rooms/rh-k1/status').json
    assert st['counts']['placed'] == len(o.get('/api/children?location=rh&room=rh-k1&status=active').json)


def test_forecast_first_month_matches_placements_and_booked_changes(srv):
    s = Server(quiet=True)
    try:
        own = s.user('owner')
        f = own.get('/api/forecast?location=rh').json
        m0 = f['months'][0]
        for room in f['rooms']:
            placed = len(own.get('/api/children?location=rh&status=active&room=' + room['id']).json)
            assert m0['rooms'][room['id']]['n'] == placed, room['id']
        assert m0['label'] == 'Nov 2026' and len(f['months']) == 25
        events = [(m['label'], e['why']) for m in f['months'] for r in m['rooms'].values() for e in r['events']]
        assert ('Jan 2027', 'end date recorded in enrollment') in events
        assert sum(1 for l, w in events if w == 'start date recorded in enrollment') == 4
        assert own.get('/api/forecast?location=rh&horizon=40').status == 400
    finally:
        s.cleanup()
