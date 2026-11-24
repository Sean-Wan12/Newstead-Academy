"""Who sees what: owner, linked teacher, unlinked person (window.claude mocked with promise-returning user calls)."""
from conftest import ROUTES, OWNER, TEACHER, STRANGER, PEOPLE, staff_seed, MK_ROOMS, MK_ROSTER


def mock(user, seed=None):
    return {'user': user, 'db': True, 'people': PEOPLE, 'seed': seed or {}}


def test_owner_is_admin(app):
    app.open('dashboard', mock=mock(OWNER, staff_seed()))
    assert app.page.evaluate('ME.role') == 'admin'
    assert app.view() == 'dashboard'
    assert len(app.page.query_selector_all('#menu a')) == len(ROUTES)


def test_REGRESSION_non_editor_is_not_admin_when_isOwner_and_canEdit_return_promises(app):
    """identity.js called u.isOwner() || u.canEdit() without await: a Promise is truthy, so every viewer was an admin."""
    app.open('billing', mock=mock(STRANGER))
    assert app.page.evaluate('ME.role') == 'none'
    assert app.view() == 'welcome'


def test_teacher_lands_on_their_room_checkin_and_cannot_reach_other_routes(app):
    app.open('billing', mock=mock(TEACHER, staff_seed('rh', 'P2')))
    assert app.page.evaluate('ME.role') == 'teacher'
    assert app.view() == 'checkin'
    assert app.page.evaluate('CI_ROOM') == 'P2'
    assert app.page.inner_text('#ciTitle') == 'Preschool 2 check-in'
    assert app.page.eval_on_selector('#ciRooms', 'e => e.hidden') is True
    menu = app.page.eval_on_selector_all('#menu a', 'e => e.map(a => a.getAttribute("href"))')
    assert menu == ['#checkin', '#help']
    assert app.page.eval_on_selector('#locSel', 's => s.disabled') is True
    for r in ROUTES:
        app.go(r)
        assert app.view() == ('help' if r == 'help' else 'checkin'), 'teacher reached #' + r
    assert app.errors == []


def test_teacher_is_moved_to_their_location(app):
    seed = dict(MK_ROOMS); seed.update(MK_ROSTER); seed.update(staff_seed('mk', 'RT1'))
    app.open('dashboard', loc='rh', mock=mock(TEACHER, seed))
    assert app.page.evaluate('LOC.id') == 'mk'
    assert app.page.inner_text('#ciTitle') == 'Toddler 1 check-in'


def test_REGRESSION_teacher_cannot_use_search_to_open_contacts_staff_or_waitlist(app):
    """Search listed every child, parent phone number, staff record and waitlist family, and its results opened edit forms."""
    seed = staff_seed('rh', 'P2'); seed['loc/rh/waitlist/w1'] = {'child': 'Waiting Kid', 'status': 'Waiting', 'parent': 'Parent Name'}
    app.open('checkin', mock=mock(TEACHER, seed))
    assert not app.page.is_visible('#searchBox')
    app.page.keyboard.press('/')
    app.page.evaluate("document.getElementById('q').value = 'Teacher'; document.getElementById('q').dispatchEvent(new Event('input'))")
    app.page.wait_for_timeout(200)
    assert app.page.eval_on_selector('#qres', 'e => e.hidden') is True
    app.page.evaluate("QRES = searchItems(); pickResult(QRES.findIndex(x => x.type === 'Staff'))")
    app.page.wait_for_timeout(300)
    assert app.page.eval_on_selector('#modal', 'e => e.hidden') is True, 'no staff form opened for a teacher'


def test_unlinked_person_sees_welcome_everywhere_and_no_search(app):
    app.open('dashboard', mock=mock(STRANGER, staff_seed()))
    assert app.view() == 'welcome'
    assert 'Unlinked' in app.page.inner_text('#wName')
    for r in ROUTES:
        app.go(r)
        assert app.view() == 'welcome'
    assert app.page.eval_on_selector_all('#menu a', 'e => e.length') == 0
    assert not app.page.is_visible('#searchBox')
    assert app.page.eval_on_selector('#locSel', 's => s.disabled') is True


def test_inactive_staff_record_does_not_grant_teacher_access(app):
    seed = staff_seed(); seed['loc/rh/staff/s1']['active'] = False
    app.open('checkin', mock=mock(TEACHER, seed))
    assert app.view() == 'welcome'


def test_admin_search_finds_pages_and_children(app):
    app.open('dashboard')
    app.page.click('#q'); app.page.keyboard.type('billing'); app.page.wait_for_timeout(150)
    assert app.page.is_visible('#qres')
    app.page.keyboard.press('Enter'); app.page.wait_for_timeout(200)
    assert app.view() == 'billing'


def test_REGRESSION_staff_linking_finds_an_account_by_name(app):
    """search('') only returns people the page has already seen; the teacher's account must still be findable."""
    seed = {'loc/rh/staff/s1': {'name': 'Teacher Person', 'role': 'RECE', 'room': 'P2', 'active': True}}
    app.open('configuration', mock=mock(OWNER, seed))
    app.page.click('[data-staff="s1"]'); app.page.wait_for_timeout(300)
    opts = app.page.eval_on_selector_all('#f-userId option', 'e => e.map(o => o.value)')
    assert 'u_teach' in opts
    app.page.select_option('#f-userId', 'u_teach'); app.submit()
    assert app.page.evaluate("__mockStore()['loc/rh/staff/s1'].userId") == 'u_teach'
