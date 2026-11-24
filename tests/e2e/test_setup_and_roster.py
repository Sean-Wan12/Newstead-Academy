"""Markham rooms; roster import for Markham and Richmond Hill; 'Roster as of'; over-capacity flags."""
from conftest import FIX, OWNER, PEOPLE, MK_ROOMS, MK_ROSTER


def add_room(app, name, group, cap):
    app.page.click('#roomActs [data-act="room-add"]')
    app.page.fill('#f-name', name); app.page.select_option('#f-lic', group); app.page.fill('#f-licensed', str(cap))
    app.submit()


def import_csv(app, path):
    app.go('rosters')
    app.page.click('#rosterActs [data-act="roster-import"]')
    app.page.set_input_files('#f-file', str(path))
    app.submit(); app.page.wait_for_timeout(300)


def room_names(app):
    return app.page.eval_on_selector_all('#roomCards h3', 'e => e.map(x => x.textContent)')


def test_markham_room_add_edit_delete(app):
    app.open('rooms', loc='mk')
    add_room(app, 'Infant 1', 'Infant', 10)
    add_room(app, 'Toddler 1', 'Toddler', 15)
    add_room(app, 'Preschool 1', 'Preschool', 24)
    assert room_names(app) == ['Infant 1', 'Toddler 1', 'Preschool 1']
    add_room(app, 'toddler 1', 'Toddler', 10)
    assert 'already a room called' in app.toast()
    app.page.click('#mForm [data-close] >> nth=0')
    rid = app.page.eval_on_selector_all('[data-roomedit]', 'e => e.map(b => b.dataset.roomedit)')[1]
    app.page.click('[data-roomedit="%s"]' % rid)
    app.page.fill('#f-name', 'Toddler A'); app.page.fill('#f-licensed', '12'); app.submit()
    assert 'Toddler A' in room_names(app)
    assert app.page.evaluate("ROOMS.find(r => r.name === 'Toddler A').licensed") == 12
    app.page.click('[data-roomedit="%s"]' % rid)
    app.page.click('#mForm [data-del]'); app.page.click('#mForm [data-del]'); app.page.wait_for_timeout(200)
    assert room_names(app) == ['Infant 1', 'Preschool 1']
    add_room(app, 'Bad', 'Toddler', 0)
    assert 'above 0' in app.toast()
    assert app.errors == []


def test_markham_roster_import(app):
    app.open('rosters', loc='mk', local=MK_ROOMS)
    import_csv(app, FIX / 'mk-lillio.csv')
    t = app.toast()
    assert 'Imported 5 children' in t and 'School Age' in t
    assert app.page.eval_on_selector_all('#rosterTable tbody tr', 'e => e.length') == 5
    lead = app.page.inner_text('#rosterLead')
    assert lead.startswith('Roster as of 23 Nov 2026') and 'School Age (1)' in lead
    names = app.page.eval_on_selector_all('#rosterTable tbody td:first-child b', 'e => e.map(x => x.textContent)')
    assert 'Ari Ma.' in names and 'Ari Mu.' in names, 'same first name and initial get more letters'
    assert 'Dex "DJ" P.' in names
    stored = app.page.evaluate("JSON.parse(localStorage.getItem('na-admin-db'))['loc/mk/setup/roster']")
    assert 'Maple' not in str(stored) and 'Mulberry' not in str(stored), 'no full last names stored'
    assert stored['plans'] and stored['plans'][0]['d'] == '2027-02-01'
    assert app.errors == []


def test_richmond_hill_shows_roster_date_and_over_capacity_flag(app):
    app.open('rosters')
    assert app.page.inner_text('#rosterLead').startswith('Roster as of 16 Nov 2026')
    flags = app.page.inner_text('#rosterFlags')
    assert 'Kindergarten 1 has 27 children on the roster for 26 licensed spaces' in flags and 'check the roster in Lillio' in flags
    app.go('dashboard')
    assert app.page.inner_text('#dRosterAsOf') == 'Roster as of 16 Nov 2026'
    assert 'check the roster in Lillio' in app.page.inner_text('#dEnr')
    assert 'check the roster in Lillio' in app.page.inner_text('#dTodo')


def test_TASK1_richmond_hill_import_replaces_the_built_in_roster(app):
    app.open('contacts')
    # contacts entered for a child before the import must stay with that child afterwards
    kid = app.page.evaluate("DATA.kids.filter(k => k.r === 'K1')[1].id")
    name = app.page.evaluate('k => kidById(k).n', kid)
    app.page.click('[data-ct="%d"]' % kid); app.page.fill('#f-g1name', 'Parent One'); app.submit()
    import_csv(app, FIX / 'rh-lillio.csv')
    assert 'Imported 163 children' in app.toast()
    assert app.page.inner_text('#rosterLead').startswith('Roster as of 23 Nov 2026')
    assert app.page.inner_text('#rosterFlags').strip() == ''
    assert app.page.evaluate("ENROLLED().filter(k => k.r === 'K1').length") == 26
    assert app.page.evaluate("ENROLLED().filter(k => k.r === 'K2').length") == 22, 'Lillio Kindergarten 2 matches the room licensed as Preschool 4'
    assert app.page.evaluate('k => kidById(k).n', kid) == name, 'same child keeps the same id'
    assert app.page.evaluate("D.contacts['c%d'].g1name" % kid) == 'Parent One'
    assert app.page.evaluate('DATA.plans.length') == 1
    app.go('dashboard')
    assert app.page.inner_text('#dRosterAsOf') == 'Roster as of 23 Nov 2026'
    assert 'check the roster in Lillio' not in app.page.inner_text('#dEnr')
    # it is saved for the location, so a reload keeps it
    app.page.reload(); app.ready()
    assert app.page.evaluate("ENROLLED().filter(k => k.r === 'K1').length") == 26
    assert app.errors == []


def test_richmond_hill_import_saved_in_shared_database(app):
    app.open('rosters', mock={'user': OWNER, 'db': True, 'people': PEOPLE})
    import_csv(app, FIX / 'rh-lillio.csv')
    doc = app.page.evaluate("__mockStore()['loc/rh/setup/roster']")
    assert doc['asOf'] == '2026-11-23' and len([k for k in doc['kids'] if k['r'] == 'K1']) == 26


def test_old_roster_is_marked_stale(app):
    app.open('rosters', time='2026-12-10 09:00')
    assert 'days old: import a fresh Enrollment (csv) from Lillio' in app.page.inner_text('#rosterLead')


def test_REGRESSION_switching_location_does_not_show_the_old_locations_records(app):
    """D.contacts and the other collections kept the previous location's records until the new ones arrived; child ids overlap between locations."""
    seed = {**MK_ROOMS, **MK_ROSTER, 'loc/rh/contacts/c1': {'g1name': 'RH Parent', 'kid': 1}}
    app.open('contacts', mock={'user': OWNER, 'db': True, 'people': PEOPLE, 'seed': seed})
    assert 'RH Parent' in app.page.inner_text('#ctTable')
    app.page.evaluate("__MOCK.snapshotDelay = 1500")
    app.page.select_option('#locSel', 'mk'); app.page.wait_for_timeout(200)
    assert app.page.evaluate('LOC.id') == 'mk'
    assert 'RH Parent' not in app.page.inner_text('#ctTable')
