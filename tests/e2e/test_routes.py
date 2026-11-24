"""Every page renders for an admin without console errors, at both locations, including empty and closed days."""
import pytest
from conftest import ROUTES, OWNER, PEOPLE, MK_ROOMS, MK_ROSTER


def visit_all(app):
    for r in ROUTES:
        app.go(r)
        assert app.view() == r, 'route #%s showed %s' % (r, app.view())
    assert app.errors == []


def test_every_route_renders_richmond_hill_local(app):
    app.open('dashboard')
    visit_all(app)


def test_every_route_renders_with_claude_ai_owner(app):
    app.open('dashboard', mock={'user': OWNER, 'db': True, 'people': PEOPLE})
    assert app.page.eval_on_selector('#locSel', 's => s.disabled') is False
    visit_all(app)


def test_every_route_renders_markham_with_no_rooms_or_children(app):
    app.open('dashboard', loc='mk')
    assert app.page.is_visible('#setupNote')
    visit_all(app)
    app.go('checkin')
    assert 'No rooms set up' in app.page.inner_text('#ciGrid')


def test_every_route_renders_markham_with_rooms_and_no_roster(app):
    app.open('dashboard', loc='mk', local=MK_ROOMS)
    visit_all(app)
    app.go('rosters')
    assert 'No Lillio roster imported yet' in app.page.inner_text('#rosterLead')


@pytest.mark.parametrize('when', ['2026-11-28 10:00', '2026-12-25 10:00', '2026-11-30 23:30', '2027-03-14 03:30'])
def test_every_route_renders_on_weekends_holidays_month_end_and_dst(app, when):
    events = {'loc/rh/events/x1': {'title': 'Winter break', 'type': 'Closure', 'date': '2026-12-24', 'end': '2027-01-01'}}
    app.open('dashboard', local=events, time=when)
    visit_all(app)
    day = app.page.evaluate('DAY')
    assert day == when[:10], 'the page uses the Toronto date'
    if when.startswith('2026-12-25'):
        assert 'Closed' in app.page.inner_text('#dLead')
    if when.startswith('2026-11-28'):
        app.go('checkin')
        assert 'weekend' in app.page.inner_text('#ciLead')
        assert app.page.inner_text('#ciBulk').strip() == '', 'no "mark absent" on a weekend'


def test_every_route_renders_markham_with_roster_db(app):
    seed = dict(MK_ROOMS); seed.update(MK_ROSTER)
    app.open('dashboard', loc='mk', mock={'user': OWNER, 'db': True, 'people': PEOPLE, 'seed': seed})
    visit_all(app)


def test_richmond_hill_without_the_built_in_roster_file(app):
    """The roster file is git-ignored; without it the site must still work and offer the import."""
    app.open('dashboard', no_rh_file=True)
    visit_all(app)
    app.go('rosters')
    assert 'No Lillio roster imported yet' in app.page.inner_text('#rosterLead')
    assert app.page.is_visible('#rosterActs [data-act="roster-import"]')
