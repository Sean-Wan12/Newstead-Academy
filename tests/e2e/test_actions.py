"""Every button that opens a form works, including at a location with no rooms or children."""
import pytest
from conftest import ROUTES, MK_ROOMS

SAFE = ['wl-add', 'log-add', 'msg-add', 'bill-fees', 'wk-edit', 'ev-add', 'centre-edit', 'staff-add', 'room-add', 'roster-import', 'wk-prev', 'wk-next', 'wk-copy', 'backup', 'bill-create']


@pytest.mark.parametrize('loc,local', [('rh', {}), ('mk', {}), ('mk', MK_ROOMS)], ids=['richmond-hill', 'markham-empty', 'markham-rooms-no-children'])
def test_every_form_button_opens_without_errors(app, loc, local):
    app.open('dashboard', loc=loc, local=local)
    for r in ROUTES:
        app.go(r)
        acts = app.page.eval_on_selector_all('#view-%s [data-act]' % r, 'e => e.filter(b => b.offsetParent && !b.disabled).map(b => b.dataset.act)')
        for a in acts:
            if a not in SAFE:
                continue
            app.page.locator('#view-%s [data-act="%s"]' % (r, a)).first.click()
            app.page.wait_for_timeout(120)
            assert app.errors == [], '#%s %s: %s' % (r, a, app.errors)
            app.page.keyboard.press('Escape')
