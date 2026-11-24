"""Classroom check-in: in, out, absent, undo, mark the rest absent; attendance kept per location and per day."""
from conftest import OWNER, TEACHER, PEOPLE, staff_seed, MK_ROOMS, MK_ROSTER


def tiles(app):
    t = app.page.inner_text('#ciTiles').split('\n')
    return {t[i]: t[i + 1] for i in range(0, len(t) - 2, 3)}


def card(app, kid):
    return app.page.locator('#ciGrid .cikid', has=app.page.locator('[data-kid="%d"]' % kid))


def att(app, kid):
    return app.page.evaluate('k => attRec(k)', kid)


def test_check_in_out_absent_and_undo(app):
    app.open('checkin')
    app.page.click('[data-ciroom="T1"]'); app.page.wait_for_timeout(100)
    assert tiles(app)['Not arrived'] == '15'
    app.page.click('[data-att="in"][data-kid="1"]'); app.page.wait_for_timeout(150)
    assert att(app, 1)['in'] == '09:00'
    assert tiles(app)['Checked in'] == '1'
    assert tiles(app)['Staff needed now'] == '1'
    app.page.click('[data-att="out"][data-kid="1"]'); app.page.wait_for_timeout(150)
    assert tiles(app)['Checked out'] == '1' and tiles(app)['Checked in'] == '0'
    app.page.click('[data-att="undo-out"][data-kid="1"]'); app.page.wait_for_timeout(150)
    assert tiles(app)['Checked in'] == '1' and att(app, 1)['out'] == ''
    app.page.click('[data-att="absent"][data-kid="2"]'); app.page.wait_for_timeout(150)
    assert tiles(app)['Absent'] == '1'
    app.page.click('[data-att="undo-absent"][data-kid="2"]'); app.page.wait_for_timeout(150)
    assert tiles(app)['Absent'] == '0' and tiles(app)['Not arrived'] == '14'
    b = app.page.locator('[data-act="ci-absent-rest"]')
    b.click(); assert 'Click again' in b.inner_text()
    b.click(); app.page.wait_for_timeout(200)
    assert tiles(app)['Absent'] == '14' and tiles(app)['Checked in'] == '1'
    assert app.page.inner_text('#ciBulk').strip() == ''
    assert app.errors == []


def test_edit_attendance_form_and_clear(app):
    app.open('checkin')
    app.page.click('[data-ciroom="T1"]')
    app.page.click('[data-att="edit"][data-kid="3"]')
    app.page.fill('#f-in', '08:15'); app.page.fill('#f-byIn', 'Grandparent'); app.page.fill('#f-note', 'Brought a spare hat')
    app.submit()
    assert 'In at 08:15' in card(app, 3).inner_text()
    app.page.click('[data-att="edit"][data-kid="3"]')
    app.page.click('#mForm [data-del]'); app.page.click('#mForm [data-del]'); app.page.wait_for_timeout(200)
    assert 'Not here yet' in card(app, 3).inner_text()


def test_attendance_is_kept_per_location(app):
    app.open('checkin', local={**MK_ROOMS, **MK_ROSTER})
    app.page.click('[data-ciroom="T1"]')
    app.page.click('[data-att="in"][data-kid="1"]'); app.page.wait_for_timeout(150)
    app.page.select_option('#locSel', 'mk'); app.page.wait_for_timeout(300)
    assert app.page.evaluate('LOC.id') == 'mk'
    app.page.click('[data-ciroom="RI1"]'); app.page.wait_for_timeout(100)
    assert att(app, 1) is None, 'Markham child 1 is not checked in by the Richmond Hill check-in'
    assert tiles(app)['Checked in'] == '0'
    app.page.click('[data-att="absent"][data-kid="1"]'); app.page.wait_for_timeout(150)
    app.page.select_option('#locSel', 'rh'); app.page.wait_for_timeout(300)
    app.page.click('[data-ciroom="T1"]'); app.page.wait_for_timeout(100)
    assert att(app, 1)['in'] == '09:00' and not att(app, 1).get('absent')
    store = app.page.evaluate("JSON.parse(localStorage.getItem('na-admin-db'))")
    assert set(store['loc/rh/attendance/2026-11-23']['kids']) == {'1'}
    assert store['loc/mk/attendance/2026-11-23']['kids']['1']['absent'] is True
    assert app.errors == []


def test_attendance_is_kept_per_day(app):
    app.open('checkin')
    app.page.click('[data-ciroom="T1"]')
    app.page.click('[data-att="in"][data-kid="1"]'); app.page.wait_for_timeout(150)
    app.page.fill('#ciDate', '2026-11-20'); app.page.dispatch_event('#ciDate', 'change'); app.page.wait_for_timeout(200)
    assert att(app, 1) is None
    assert '(not today)' in app.page.inner_text('#ciLead')


def test_teacher_checkin_records_who_did_it(app):
    app.open('checkin', mock={'user': TEACHER, 'db': True, 'people': PEOPLE, 'seed': staff_seed('rh', 'P2')})
    kid = app.page.eval_on_selector('#ciGrid [data-att="in"]', 'b => +b.dataset.kid')
    app.page.click('#ciGrid [data-att="in"] >> nth=0'); app.page.wait_for_timeout(300)
    doc = app.page.evaluate("__mockStore()['loc/rh/attendance/2026-11-23']")
    assert doc['kids'][str(kid)]['staffIn'] == 'u_teach'
    assert 'by Teacher Person' in card(app, kid).inner_text()


def test_REGRESSION_checkin_page_left_open_overnight_moves_to_the_new_day(app):
    """DAY was fixed when the page loaded: a tablet left open overnight recorded the next morning's check-ins on yesterday."""
    app.open('checkin', time='2026-11-23 23:58')
    app.page.clock.run_for(4 * 60 * 1000); app.page.wait_for_timeout(300)
    assert app.page.evaluate('DAY') == '2026-11-24'
    app.page.click('[data-ciroom="T1"]')
    app.page.click('[data-att="in"][data-kid="1"]'); app.page.wait_for_timeout(150)
    store = app.page.evaluate("JSON.parse(localStorage.getItem('na-admin-db'))")
    assert 'loc/rh/attendance/2026-11-24' in store and 'loc/rh/attendance/2026-11-23' not in store


def test_a_date_picked_on_purpose_stays_after_midnight(app):
    app.open('checkin', time='2026-11-23 23:58')
    app.page.fill('#ciDate', '2026-11-20'); app.page.dispatch_event('#ciDate', 'change')
    app.page.clock.run_for(4 * 60 * 1000); app.page.wait_for_timeout(200)
    assert app.page.evaluate('DAY') == '2026-11-20'


def test_REGRESSION_first_checkin_of_the_day_survives_another_device_creating_the_same_day(app):
    """merge() fell back to set() when the day's document did not exist; another room's set() a moment later replaced it."""
    other = {'date': '2026-11-23', 'kids': {'50': {'in': '08:59', 'absent': False, 'staffIn': 'u_x'}}}
    app.open('checkin', mock={'user': OWNER, 'db': True, 'people': PEOPLE, 'race': {'path': 'attendance/2026-11-23$', 'data': other}})
    app.page.evaluate('MERGE_RECHECK_MS = 50')
    app.page.click('[data-ciroom="T1"]')
    app.page.click('[data-att="in"][data-kid="1"]'); app.page.wait_for_timeout(1500)
    doc = app.page.evaluate("__mockStore()['loc/rh/attendance/2026-11-23']")
    assert set(doc['kids']) == {'1', '50'}, app.page.evaluate('__mockLog')


def test_checkin_on_weekend_and_closure_days(app):
    events = {'loc/rh/events/x1': {'title': 'PD closure', 'type': 'Closure', 'date': '2026-11-24'}}
    app.open('checkin', local=events, time='2026-11-24 08:00')
    assert 'The centre is closed: PD closure' in app.page.inner_text('#ciLead')
    assert app.page.inner_text('#ciBulk').strip() == ''
    assert app.errors == []


def test_REGRESSION_device_set_to_another_time_zone_still_uses_toronto_date_and_time(app):
    """todayISO() and nowHM() used the device's time zone: a tablet left on UTC recorded tomorrow's date after 7 pm."""
    app.open('checkin', time='2026-11-23 20:30', device_tz='UTC')
    assert app.page.evaluate('DAY') == '2026-11-23'
    app.page.click('[data-ciroom="T1"]')
    app.page.click('[data-att="in"][data-kid="1"]'); app.page.wait_for_timeout(150)
    assert app.page.evaluate('attRec(1).in') == '20:30'


def test_REGRESSION_empty_room_is_not_reported_as_attendance_not_started(app):
    """A room with no children was always listed under 'Attendance not started'."""
    rooms = {'loc/mk/setup/rooms': {'rooms': MK_ROOMS['loc/mk/setup/rooms']['rooms'] + [{'id': 'RP2', 'name': 'Preschool 2', 'licName': 'Preschool 2', 'lic': 'Preschool', 'licensed': 16}]}}
    app.open('checkin', loc='mk', local={**rooms, **MK_ROSTER})
    for room, kid in [('RI1', 1), ('RT1', 2), ('RP1', 3)]:
        app.page.click('[data-ciroom="%s"]' % room)
        app.page.click('[data-att="in"][data-kid="%d"]' % kid); app.page.wait_for_timeout(120)
    assert not any('Attendance not started' in a['t'] for a in app.page.evaluate('alertsList()'))
