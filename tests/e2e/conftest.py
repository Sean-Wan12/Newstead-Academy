"""Shared set-up for the end-to-end tests: a local web server for admin/, Chrome, and a page
helper that mocks claude.ai (window.claude), fixes the clock and time zone (America/Toronto)
and collects console errors. The Richmond Hill roster is replaced by a synthetic one with
made-up names, so no real child's record is loaded, printed or screenshotted."""
import functools, http.server, json, os, pathlib, socketserver, subprocess, sys, threading
from datetime import datetime
from zoneinfo import ZoneInfo
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
ADMIN = pathlib.Path(os.environ.get('NA_ADMIN', ROOT / 'admin'))   # NA_ADMIN=<copy> runs the tests against another copy of the site
FIX = ROOT / 'tests' / 'fixtures'
MOCK_JS = (pathlib.Path(__file__).parent / 'mock_claude.js').read_text()
TZ = ZoneInfo('America/Toronto')
CHROME = '/usr/bin/google-chrome'

# Every page in the menu (menu.js FLAT)
ROUTES = ['dashboard', 'summary', 'overview', 'forecast', 'children', 'rosters', 'waitlist', 'rooms', 'actions', 'checkin',
          'photos', 'messaging', 'contacts', 'billing', 'calendars', 'reports', 'signin', 'configuration', 'help']


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.split('?')[0] == '/data/richmond-hill.js':
            return str(FIX / 'richmond-hill.js')
        return super().translate_path(path)

    def log_message(self, *a):
        pass


@pytest.fixture(scope='session')
def base_url():
    subprocess.run([sys.executable, '-I', str(FIX / 'make_fixtures.py')], check=True, capture_output=True)
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ADMIN)))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield 'http://127.0.0.1:%d/index.html' % srv.server_address[1]
    srv.shutdown()


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        yield b
        b.close()


def toronto(s):
    """'2026-11-23 09:00' in Toronto time"""
    return datetime.strptime(s, '%Y-%m-%d %H:%M').replace(tzinfo=TZ)


class App:
    def __init__(self, browser, base_url):
        self.browser, self.base_url, self.ctx, self.page, self.errors = browser, base_url, None, None, []

    def open(self, hash='dashboard', mock=None, local=None, loc=None, width=1280, height=900, time='2026-11-23 09:00', wait=True, device_tz='America/Toronto', no_rh_file=False):
        """mock: window.__MOCK config (user, db, seed, people, ...). local: records saved in this browser (no claude.ai)."""
        self.ctx = self.browser.new_context(viewport={'width': width, 'height': height}, timezone_id=device_tz, locale='en-CA')
        pg = self.page = self.ctx.new_page()
        pg.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: self.errors.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.on('response', lambda r: self.errors.append('HTTP %d %s' % (r.status, r.url.split('/')[-1])) if r.status >= 400 and not r.url.endswith('favicon.ico') else None)
        pg.clock.install(time=toronto(time))
        if no_rh_file:   # the site published without data/richmond-hill.js
            pg.route('**/data/richmond-hill.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body='/* not published */'))
        seed = {'na-admin-db': json.dumps(local or {})}
        if loc:
            seed['na-loc'] = loc
        pg.add_init_script("if (!sessionStorage.getItem('__seeded')) { const s = %s; Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); sessionStorage.setItem('__seeded', '1'); }" % json.dumps(seed))
        if mock is not None:
            pg.add_init_script('window.__MOCK = %s;' % json.dumps(mock))
            pg.add_init_script(MOCK_JS)
        pg.goto(self.base_url + '#' + hash)
        if wait:
            self.ready()
        return pg

    def ready(self):
        self.page.wait_for_function("typeof APP_READY !== 'undefined' && APP_READY && ME.decided && !document.getElementById('view-loading').offsetParent", timeout=15000)
        self.page.wait_for_timeout(150)

    def go(self, hash):
        self.page.evaluate('h => { location.hash = h; }', hash)
        self.page.wait_for_timeout(120)

    def view(self):
        return self.page.evaluate("[...document.querySelectorAll('.view')].filter(v => !v.hidden).map(v => v.id.slice(5)).join(',')")

    def toast(self):
        return self.page.inner_text('#toast')

    def submit(self):
        self.page.click('#mForm [type=submit]')
        self.page.wait_for_timeout(250)

    def close(self):
        if self.ctx:
            self.ctx.close()


@pytest.fixture
def app(browser, base_url):
    a = App(browser, base_url)
    yield a
    a.close()


# claude.ai accounts used by the tests
OWNER = {'id': 'u_owner', 'name': 'Owner Person', 'owner': True, 'edit': True}
TEACHER = {'id': 'u_teach', 'name': 'Teacher Person', 'owner': False, 'edit': False}
STRANGER = {'id': 'u_other', 'name': 'Unlinked Person', 'owner': False, 'edit': False}
PEOPLE = [{'id': 'u_owner', 'name': 'Owner Person', 'seen': True}, {'id': 'u_teach', 'name': 'Teacher Person'}, {'id': 'u_other', 'name': 'Unlinked Person'}]


def staff_seed(loc='rh', room='P2', user='u_teach'):
    return {'loc/%s/staff/s1' % loc: {'name': 'Teacher Person', 'role': 'RECE', 'room': room, 'userId': user, 'active': True}}


MK_ROOMS = {'loc/mk/setup/rooms': {'rooms': [
    {'id': 'RI1', 'name': 'Infant 1', 'licName': 'Infant 1', 'lic': 'Infant', 'licensed': 10},
    {'id': 'RT1', 'name': 'Toddler 1', 'licName': 'Toddler 1', 'lic': 'Toddler', 'licensed': 15},
    {'id': 'RP1', 'name': 'Preschool 1', 'licName': 'Preschool 1', 'lic': 'Preschool', 'licensed': 24}], 'updated': 1}}
MK_ROSTER = {'loc/mk/setup/roster': {'asOf': '2026-11-20', 'importedAt': 1763650000000, 'skipped': [], 'plans': [], 'kids': [
    {'id': 1, 'n': 'Ari M.', 'b': '2026-03', 'r': 'RI1', 's': '2026-09'},
    {'id': 2, 'n': 'Bo M.', 'b': '2025-05', 'r': 'RT1', 's': '2026-09'},
    {'id': 3, 'n': 'Cai P.', 'b': '2024-02', 'r': 'RP1', 's': '2026-09'}]}}
