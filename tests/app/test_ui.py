"""The app's pages in Chrome: every admin section and the teacher panel render without console
errors; stored text with markup is shown as text everywhere; tablet, tablet-landscape and phone
widths have no sideways scroll; keyboard focus is visible; the tablet PIN pad works."""
import os, sys
from datetime import datetime
import pytest
from playwright.sync_api import sync_playwright
from conftest import Server, PW, TABLET_PW, TZ, START

ADMIN_VIEWS = ['dashboard', 'children', 'attendance', 'entries', 'rooms', 'forecast', 'staff', 'activity', 'account']
P = '<img src=x onerror="window.__xss=1" data-xss>'
P2 = '"><svg onload=window.__xss=2 data-xss>'


@pytest.fixture(scope='module')
def srv():
    s = Server()
    yield s
    s.cleanup()


@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        yield b
        b.close()


class Page:
    def __init__(self, browser, srv, width=1280, height=900):
        self.ctx = browser.new_context(viewport={'width': width, 'height': height}, timezone_id='America/Toronto', locale='en-CA')
        self.pg = self.ctx.new_page(); self.errors = []; self.base = srv.base
        self.pg.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        self.pg.on('console', lambda m: self.errors.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        self.pg.on('response', lambda r: self.errors.append('HTTP %d %s' % (r.status, r.url.split('/', 3)[-1])) if r.status >= 500 else None)
        self.pg.clock.install(time=datetime.strptime(START, '%Y-%m-%d %H:%M').replace(tzinfo=TZ))

    def staff(self, who):
        self.pg.goto(self.base + '/login')
        self.pg.fill('#email', PW[who][0]); self.pg.fill('#password', PW[who][1])
        self.pg.click('#staffForm [type=submit]')
        self.pg.wait_for_url('**/' + ('admin' if who in ('owner', 'sup_rh', 'sup_mk') else 'teacher') + '**')
        self.settle()

    def tablet(self, username):
        self.pg.goto(self.base + '/login')
        self.pg.click('#tab-device'); self.pg.fill('#username', username); self.pg.fill('#devpass', TABLET_PW)
        self.pg.click('#deviceForm [type=submit]')
        self.pg.wait_for_url('**/teacher**'); self.settle()

    def settle(self, ms=400):
        self.pg.wait_for_load_state('networkidle'); self.pg.wait_for_timeout(ms)

    def xss(self):
        return self.pg.evaluate("[window.__xss || null, document.querySelectorAll('[data-xss]').length]")

    def close(self):
        self.ctx.close()


@pytest.fixture
def page(browser, srv):
    pages = []
    def make(**kw):
        p = Page(browser, srv, **kw); pages.append(p); return p
    yield make
    for p in pages:
        p.close()


def test_every_admin_section_renders_for_owner_and_supervisor(page):
    for who in ['owner', 'sup_mk']:
        p = page(); p.staff(who)
        for v in ADMIN_VIEWS:
            p.pg.goto(p.base + '/admin#' + v); p.settle(300)
            assert p.pg.locator('#view h1').count() == 1, (who, v)
            assert 'form-error' not in p.pg.inner_html('#view'), (who, v)
        assert p.errors == [], who


def test_teacher_and_tablet_panels_render(page):
    p = page(); p.staff('teacher')
    assert p.pg.inner_text('#roomName') == 'Toddler 1'
    assert p.pg.locator('#cards .card').count() > 0 or p.pg.locator('#cards [data-open]').count() > 0
    p.pg.goto(p.base + '/admin'); p.settle()
    assert '/teacher' in p.pg.url, 'teachers are sent away from the admin panel'
    t = page(); t.tablet('rh-toddler-1')
    assert 'locked' in t.pg.inner_text('#actorLine').lower()
    assert p.errors == [] and t.errors == []


def test_tablet_pin_pad_then_check_in(page, srv):
    t = page(); t.tablet('rh-toddler-2')
    btn = t.pg.locator('#cards [data-one="check-in"]').first
    if not btn.count():
        pytest.skip('no child waiting to be checked in')
    btn.click()
    t.pg.wait_for_selector('dialog#modal[open]')
    t.pg.locator('dialog#modal [data-user="u-t-rh-t2"]').click()
    for k in '2581':
        t.pg.click('dialog#modal [data-k="%s"]' % k)
    t.settle()
    assert 'Recording as' in t.pg.inner_text('#actorLine')
    assert t.pg.locator('#cards [data-one="check-out"]').count() >= 1, 'the child was checked in after the PIN'
    assert t.errors == []


def seed_payloads(srv):
    o = srv.user('owner')
    s = srv.user('sup_rh')
    room = s.post('/api/rooms', {'locationId': 'rh', 'name': P, 'licName': P2[:60], 'ageGroup': 'Toddler', 'licensedCapacity': 5}).json
    kid = s.post('/api/children', {'locationId': 'rh', 'firstName': P, 'lastName': P2, 'preferredName': '', 'dateOfBirth': '2024-08-01', 'allergies': P, 'medicalNotes': P + P2,
                                   'dietaryNotes': P, 'notes': P, 'enrollment': {'roomId': 'rh-t1', 'startDate': '2026-11-01', 'notes': P}}).json
    s.post('/api/contacts', {'childIds': [kid['id']], 'firstName': P, 'lastName': P2, 'relationship': P[:40], 'notes': P, 'isGuardian': True, 'authorizedPickup': True})
    u = s.post('/api/users', {'name': P, 'email': 'xss.person@example.test', 'role': 'teacher', 'title': P2, 'locationIds': ['rh'], 'roomIds': ['rh-t1']}).json
    s.post('/api/devices', {'locationId': 'rh', 'username': 'rh-xss-tab', 'name': P, 'roomIds': ['rh-t1']})
    o.patch('/api/locations/rh', {'address': P, 'hours': P2, 'notes': [P]})
    t = srv.tablet('rh-toddler-1', 'u-t-rh-t1', '2580')
    t.post('/api/attendance/check-in', {'childIds': [kid['id']], 'person': P})
    for typ, data in [('note', {'kind': 'general', 'text': P}), ('activity', {'title': P, 'description': P2}), ('meal', {'meal': 'lunch', 'amount': 'all', 'items': P}),
                      ('incident', {'kind': 'injury', 'description': P, 'actionTaken': P2}), ('medication', {'medicine': P, 'dose': P2[:60], 'reason': P}),
                      ('nap', {'start': '09:30', 'notes': P}), ('mood', {'mood': 'happy', 'notes': P}), ('health_check', {'status': 'fine', 'observations': P, 'notes': P2})]:
        r = t.post('/api/entries', {'childIds': [kid['id']], 'type': typ, 'data': data})
        assert r.status == 201, (typ, r.status)
        if typ == 'nap':
            t.post('/api/entries/%s/sleep-check' % r.json[0]['id'], {'note': P})
        if typ == 'incident':
            s.post('/api/entries/%s/review' % r.json[0]['id'], {'note': P})
    t.patch('/api/attendance/2026-11-23_' + kid['id'], {'reason': P, 'droppedOffBy': P})
    return kid['id']


def test_stored_markup_is_shown_as_text_everywhere(page, srv):
    kid = seed_payloads(srv)
    p = page(); p.staff('owner')
    p.pg.evaluate("localStorage.setItem('na-admin-loc', 'rh')")
    for v in ADMIN_VIEWS + ['entries/child/' + kid]:
        p.pg.goto(p.base + '/admin#' + v); p.settle(300)
        assert p.xss() == [None, 0], v
    p.pg.goto(p.base + '/admin#children'); p.settle()
    p.pg.locator('[data-child="%s"]' % kid).click(); p.settle()
    assert p.xss() == [None, 0], 'child detail'
    assert P in p.pg.inner_text('dialog#modal'), 'markup shown as text'
    p.pg.keyboard.press('Escape')
    p.pg.goto(p.base + '/admin#forecast'); p.settle()
    cell = p.pg.locator('#view button.cell, #view [data-cell]').first
    if cell.count():
        cell.click(); p.settle(); assert p.xss() == [None, 0], 'forecast cell'
    t = page(); t.tablet('rh-toddler-1')
    assert t.xss() == [None, 0], 'teacher cards'
    t.pg.locator('[data-open="%s"]' % kid).first.click(); t.settle()
    assert t.xss() == [None, 0], 'timeline'
    assert p.errors == [] and t.errors == []


WIDTHS = [(390, 844), (768, 1024), (1024, 768)]


@pytest.mark.parametrize('w,h', WIDTHS, ids=['phone-390', 'tablet-768', 'tablet-landscape-1024'])
def test_no_sideways_scroll(page, w, h):
    t = page(width=w, height=h); t.tablet('rh-preschool-1')
    sw = lambda: t.pg.evaluate('document.documentElement.scrollWidth')
    assert sw() <= w, 'teacher panel %d' % sw()
    a = page(width=w, height=h); a.staff('sup_rh')
    for v in ADMIN_VIEWS:
        a.pg.goto(a.base + '/admin#' + v); a.settle(250)
        assert a.pg.evaluate('document.documentElement.scrollWidth') <= w, v


FOCUS = """() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el);
  return { tag: el.tagName, id: el.id, cls: String(el.className), ok: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') }; }"""


@pytest.mark.parametrize('where', ['teacher', 'admin'])
def test_keyboard_focus_is_visible(page, where):
    p = page()
    p.staff('teacher' if where == 'teacher' else 'sup_rh')
    p.pg.mouse.click(2, 300)
    missing, seen = set(), 0
    for _ in range(45):
        p.pg.keyboard.press('Tab')
        f = p.pg.evaluate(FOCUS)
        if f:
            seen += 1
            if not f['ok']:
                missing.add('%s#%s.%s' % (f['tag'], f['id'], f['cls']))
    assert seen > 10 and missing == set()


def test_REGRESSION_tablet_in_another_time_zone_records_toronto_times(browser, srv):
    """The teacher panel took sleep start times from the tablet's own clock and time zone."""
    srv.set_time('2026-11-23 20:30')
    try:
        o = srv.user('owner'); t = srv.user('teacher')
        kid = [c['id'] for c in t.get('/api/children?location=rh').json if not [a for a in t.get('/api/attendance?location=rh').json if a['childId'] == c['id']]][0]
        assert t.post('/api/attendance/check-in', {'childIds': [kid]}).json['ok']
        p = Page(browser, srv)
        p.ctx.close()
        p.ctx = browser.new_context(viewport={'width': 1024, 'height': 768}, timezone_id='UTC', locale='en-CA')
        p.pg = p.ctx.new_page(); p.errors = []
        p.pg.clock.install(time=datetime.strptime('2026-11-23 20:30', '%Y-%m-%d %H:%M').replace(tzinfo=TZ))
        p.staff('teacher')
        p.pg.check('[data-select="%s"]' % kid)
        p.pg.click('[data-bulk="nap-start"]'); p.settle()
        nap = [e for e in o.get('/api/entries?location=rh&type=nap').json if e['childId'] == kid]
        assert nap and nap[-1]['data']['start'] == '20:30'
        p.close()
    finally:
        srv.set_time('2026-11-23 10:00')
