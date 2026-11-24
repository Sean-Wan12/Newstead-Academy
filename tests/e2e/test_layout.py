"""Phone width (390px): no sideways page scroll and no clipped text. Keyboard focus is visible on buttons."""
import pytest
from conftest import ROUTES, MK_ROOMS, MK_ROSTER

CLIPPED = """() => {
  const out = [];
  document.querySelectorAll('.view:not([hidden]) *, .topbar *').forEach(el => {
    if (!el.offsetParent || !el.textContent.trim() || el.closest('.tablebox, .gridwrap, [class*=scroll], table, .sr')) return;
    const cs = getComputedStyle(el);
    const clipsX = ['hidden', 'clip'].includes(cs.overflowX), r = el.getBoundingClientRect();
    if (clipsX && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push(el.tagName + '.' + el.className + '#' + el.id);
    if (r.right > innerWidth + 1 && !el.closest('[style*=overflow]')) out.push('offscreen ' + el.tagName + '.' + el.className + '#' + el.id);
  });
  return [...new Set(out)].slice(0, 8);
}"""


@pytest.mark.parametrize('loc', ['rh', 'mk'])
def test_phone_width_has_no_horizontal_page_scroll_or_clipped_text(app, loc):
    app.open('dashboard', loc=loc, width=390, height=844, local={**MK_ROOMS, **MK_ROSTER})
    bad = {}
    for r in ROUTES:
        app.go(r); app.page.wait_for_timeout(100)
        sw = app.page.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)')
        clipped = app.page.evaluate(CLIPPED)
        if sw > 390 or clipped:
            bad[r] = {'scrollWidth': sw, 'clipped': clipped}
    assert bad == {}


def test_phone_menu_opens_and_closes(app):
    app.open('dashboard', width=390, height=844)
    app.page.click('#menuBtn'); app.page.wait_for_timeout(200)
    assert app.page.evaluate("document.getElementById('rail').classList.contains('on')")
    app.page.click('#menu a[href="#rosters"]'); app.page.wait_for_timeout(200)
    assert app.view() == 'rosters'
    assert not app.page.evaluate("document.getElementById('rail').classList.contains('on')")


FOCUS = """() => { const el = document.activeElement, cs = getComputedStyle(el);
  const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, shadow = cs.boxShadow && cs.boxShadow !== 'none';
  if (el.id === 'q') return { tag: el.tagName, id: el.id, cls: '', ok: getComputedStyle(el.closest('.search')).backgroundColor === 'rgb(255, 255, 255)' };   // the search box turns white
  return { tag: el.tagName, id: el.id, cls: el.className, ok: !!(ring || shadow) }; }"""


@pytest.mark.parametrize('route', ['dashboard', 'checkin', 'rosters', 'forecast', 'rooms', 'configuration', 'waitlist', 'signin'])
def test_keyboard_focus_is_visible_on_buttons(app, route):
    app.open(route)
    app.page.mouse.click(5, 300)   # start keyboard navigation from the page body
    missing, seen = [], 0
    for _ in range(60):
        app.page.keyboard.press('Tab')
        f = app.page.evaluate(FOCUS)
        if f['tag'] in ('BUTTON', 'A', 'SELECT', 'INPUT', 'SUMMARY'):
            seen += 1
            if not f['ok']:
                missing.append('%s#%s.%s' % (f['tag'], f['id'], f['cls']))
    assert seen > 3
    assert sorted(set(missing)) == []


def test_keyboard_focus_visible_in_modal(app):
    app.open('waitlist')
    app.page.click('[data-act="wl-add"] >> nth=0')
    missing = []
    for _ in range(25):
        app.page.keyboard.press('Tab')
        f = app.page.evaluate(FOCUS)
        if not f['ok']:
            missing.append('%s#%s.%s' % (f['tag'], f['id'], f['cls']))
        assert app.page.evaluate("document.getElementById('modal').contains(document.activeElement)"), 'REGRESSION: Tab left the open form'
    assert sorted(set(missing)) == []
