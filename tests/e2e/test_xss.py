"""Names, notes and other saved text containing markup or quotes are shown as text everywhere."""
from conftest import ROUTES, FIX, MK_ROOMS

P1 = '<img src=x onerror="window.__xss=1" data-xss>'
P2 = '"\'><svg onload="window.__xss=2" data-xss><script>window.__xss=3</script>'
P = P1 + P2


def seed(loc):
    s = lambda p: 'loc/%s/%s' % (loc, p)
    return {
        s('waitlist/w1'): {'child': P, 'parent': P, 'phone': P, 'email': P, 'notes': P, 'status': 'Waiting', 'priority': P, 'dob': '2025-01-01', 'start': '2027-01'},
        s('waitlist/w2'): {'child': P, 'parent': P, 'status': 'Offered', 'priority': 'None', 'dob': P, 'start': P},
        s('staff/s1'): {'name': P, 'role': P, 'room': P, 'phone': P, 'email': P, 'active': True},
        s('events/e1'): {'title': P, 'type': 'Closure', 'date': '2026-11-23', 'notes': P},
        s('events/e2'): {'title': P, 'type': P, 'date': '2026-12-01', 'end': '2026-12-02', 'notes': P},
        s('messages/m1'): {'subject': P, 'body': P, 'from': P, 'toLabel': P, 'to': 'all', 'at': 1763900000000},
        s('contacts/c1'): {'g1name': P, 'g1rel': P, 'g1phone': P, 'g1email': P, 'ename': P, 'ephone': P, 'pickup': P, 'kid': 1},
        s('attendance/2026-11-23'): {'date': '2026-11-23', 'kids': {'1': {'in': P, 'out': '', 'byIn': P, 'note': P, 'staffIn': P}, '2': {'in': '08:00', 'out': P, 'byOut': P}}},
        s('logs/2026-11-23'): {'date': '2026-11-23', 'entries': {'l1': {'time': P, 'type': P, 'text': P, 'by': P, 'kid': 1, 'room': None, 'at': 1}}},
        s('settings/centre'): {'name': P, 'address': P, 'phone': P, 'email': P, 'licence': P, 'hours': P, 'supervisor': P},
        s('settings/billing'): {'fees': {'Toddler': 1000, 'Preschool': 900, 'Kindergarten': 800, 'Infant': 1200}},
        s('billing/2026-11'): {'month': '2026-11', 'lines': {'1': {'fee': 1000, 'subsidy': 0, 'paid': False, 'note': P}}},
        s('menus/2026-11-23'): {'week': '2026-11-23', 'days': {'mon': {'am': P, 'lunch': P, 'pm': P}}},
        s('photos/p1'): {'url': 'javascript:window.__xss=4', 'caption': P, 'room': 'all', 'date': '2026-11-23', 'kind': 'image/png', 'at': 1},
    }


def check_clean(app, where):
    hit = app.page.evaluate("[window.__xss, document.querySelectorAll('[data-xss], script:not([src])').length]")
    assert hit == [None, 0], 'markup ran or was inserted on ' + where


def sweep(app):
    for r in ROUTES:
        app.go(r); check_clean(app, '#' + r)
    opens = [('waitlist', '[data-wl="w1"]'), ('configuration', '[data-staff="s1"]'), ('calendars', '[data-ev="e1"]'), ('messaging', '[data-msg="m1"]'),
             ('contacts', '[data-ct="1"]'), ('actions', '[data-att="edit"][data-kid="1"]'), ('actions', '[data-log="l1"]'), ('billing', '[data-bill="edit"][data-kid="1"]'),
             ('photos', '[data-ph="p1"]'), ('signin', '[data-si="2"]'), ('calendars', '[data-act="wk-edit"]'), ('configuration', '[data-act="centre-edit"]')]
    for route, sel in opens:
        app.go(route)
        if route == 'actions':
            app.page.evaluate('ACT_ROOM = kidById(1).r; refresh()'); app.page.wait_for_timeout(100)
        loc = app.page.locator('#view-%s %s' % (route, sel))
        assert loc.count(), 'nothing to open at %s %s' % (route, sel)
        loc.first.click(timeout=3000); app.page.wait_for_timeout(150)
        check_clean(app, route + ' ' + sel)
        app.page.keyboard.press('Escape')
    app.go('forecast'); app.page.click('.cell >> nth=0'); app.page.wait_for_timeout(100); check_clean(app, 'forecast drawer')
    app.page.click('#q'); app.page.keyboard.type('img'); app.page.wait_for_timeout(150); check_clean(app, 'search results')
    app.page.keyboard.press('Enter'); app.page.wait_for_timeout(150); check_clean(app, 'search pick')
    assert app.errors == []


def test_saved_text_is_escaped_everywhere_richmond_hill(app):
    app.open('dashboard', local=seed('rh'))
    sweep(app)
    app.go('waitlist')
    assert P1 in app.page.inner_text('#wlTable'), 'payload shown as text'


def test_imported_child_names_and_room_names_are_escaped_markham(app):
    rooms = {'loc/mk/setup/rooms': {'rooms': [dict(r, name=('Toddler 1' if r['lic'] == 'Toddler' else r['name'])) for r in MK_ROOMS['loc/mk/setup/rooms']['rooms']] + [{'id': 'RX', 'name': P, 'licName': P, 'lic': 'Preschool', 'licensed': 8}]}}
    app.open('rosters', loc='mk', local={**seed('mk'), **rooms})
    app.page.click('#rosterActs [data-act="roster-import"]')
    app.page.set_input_files('#f-file', str(FIX / 'mk-xss.csv')); app.submit(); app.page.wait_for_timeout(300)
    assert app.page.eval_on_selector_all('#rosterTable tbody tr', 'e => e.length') == 2
    check_clean(app, 'roster import')
    sweep(app)
