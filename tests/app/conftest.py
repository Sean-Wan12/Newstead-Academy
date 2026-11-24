"""Starts the app (app/server.js) on a free port with its own seeded data folder and a
controllable clock. Every module gets a fresh server, so rate limits and data changes do not
leak between test files. All data is the app's own fake demo seed."""
import os, pathlib, socket, subprocess, sys, tempfile, time, shutil
from datetime import datetime
from zoneinfo import ZoneInfo
import pytest

sys.path.insert(0, os.path.dirname(__file__))
from client import Client

ROOT = pathlib.Path(__file__).resolve().parents[2]
APP = pathlib.Path(os.environ.get('NA_APP', ROOT / 'app'))
CLOCK = pathlib.Path(__file__).parent / 'fake_clock.js'
TZ = ZoneInfo('America/Toronto')
START = '2026-11-23 10:00'     # a Monday

PW = {'owner': ('owner@demo.newstead.test', 'Owner-demo-2026'), 'sup_rh': ('super.rh@demo.newstead.test', 'Super-demo-2026'),
      'sup_mk': ('super.mk@demo.newstead.test', 'Super-demo-2026'), 'teacher': ('teacher.rh.t1@demo.newstead.test', 'Teacher-demo-2026'),
      'assistant': ('teacher.rh.t1b@demo.newstead.test', 'Teacher-demo-2026'), 'floater': ('teacher.rh.float@demo.newstead.test', 'Teacher-demo-2026'),
      'teacher_mk': ('teacher.mk.i1@demo.newstead.test', 'Teacher-demo-2026'), 'teacher_p1': ('teacher.rh.p1@demo.newstead.test', 'Teacher-demo-2026')}
TABLET_PW = 'Tablet-demo-2026'


def ms(s):
    return int(datetime.strptime(s, '%Y-%m-%d %H:%M').replace(tzinfo=TZ).timestamp() * 1000)


class Server:
    def __init__(self, start=START, quiet=False):
        self.dir = tempfile.mkdtemp(prefix='na-app-test-')
        self.clock = os.path.join(self.dir, 'clock')
        self.data = os.path.join(self.dir, 'data')
        self.set_time(start)
        self.env = dict(os.environ, DATA_DIR=self.data, FAKE_CLOCK_FILE=self.clock, HOST='127.0.0.1')
        self.env.pop('NODE_ENV', None)
        args = ['node', '-r', str(CLOCK), str(APP / 'seed.js'), '--reset'] + (['--quiet-day'] if quiet else [])
        subprocess.run(args, env=self.env, check=True, capture_output=True)
        self.start()

    def set_time(self, s):
        """Move the server's clock to s ('YYYY-MM-DD HH:MM', Toronto)"""
        with open(self.clock, 'w') as f:
            f.write(str(ms(s) - int(time.time() * 1000)))
        time.sleep(0.05)

    def advance(self, minutes):
        with open(self.clock) as f:
            off = int(f.read())
        with open(self.clock, 'w') as f:
            f.write(str(off + int(minutes * 60000)))
        time.sleep(0.05)

    def start(self):
        if not getattr(self, 'port', None):
            s = socket.socket(); s.bind(('127.0.0.1', 0)); self.port = s.getsockname()[1]; s.close()
        self.env['PORT'] = str(self.port)
        self.log = open(os.path.join(self.dir, 'server.log'), 'w')
        self.proc = subprocess.Popen(['node', '-r', str(CLOCK), str(APP / 'server.js')], env=self.env, stdout=self.log, stderr=subprocess.STDOUT)
        self.base = 'http://127.0.0.1:%d' % self.port
        for _ in range(100):
            try:
                socket.create_connection(('127.0.0.1', self.port), timeout=0.2).close(); return
            except OSError:
                time.sleep(0.05)
        raise RuntimeError('server did not start')

    def stop(self, sig=None):
        if self.proc and self.proc.poll() is None:
            if sig:
                self.proc.send_signal(sig)
            else:
                self.proc.terminate()
            try:
                self.proc.wait(5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.log.close()

    def restart(self):
        self.stop(); self.start()

    def server_log(self):
        with open(os.path.join(self.dir, 'server.log')) as f:
            return f.read()

    def cleanup(self):
        self.stop(); shutil.rmtree(self.dir, ignore_errors=True)

    # --- signing in ---
    def client(self, **kw):
        return Client(self.base, **kw)

    def user(self, who):
        c = self.client(); email, pw = PW[who]
        r = c.post('/api/auth/login', {'email': email, 'password': pw})
        assert r.status == 200, (who, r)
        return c

    def tablet(self, username='rh-toddler-1', pin_user=None, pin=None):
        c = self.client()
        r = c.post('/api/auth/device-login', {'username': username, 'password': TABLET_PW})
        assert r.status == 200, r
        if pin_user:
            r = c.post('/api/auth/pin-unlock', {'userId': pin_user, 'pin': pin})
            assert r.status == 200, r
        return c


@pytest.fixture(scope='module')
def srv():
    s = Server()
    yield s
    s.cleanup()


@pytest.fixture(scope='module')
def ids(srv):
    """Ids from the seed: children by room, other records"""
    o = srv.user('owner')
    kids = {}
    for loc in ('rh', 'mk'):
        for c in o.get('/api/children?location=%s&status=active' % loc).json:
            if c['roomId']:
                kids.setdefault(c['roomId'], []).append(c['id'])
    return {'kids': kids}
