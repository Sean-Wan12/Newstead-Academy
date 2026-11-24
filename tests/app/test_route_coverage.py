"""Every API route is exercised by a test. A new route fails this test until it is added here."""
import json, os, subprocess
from conftest import APP

COVERED = {
    'POST /api/auth/login': 'test_api_auth (sign-in, rate limit, rotation)', 'POST /api/auth/device-login': 'test_api_auth (tablets)',
    'POST /api/auth/logout': 'test_api_auth (signed-out cookie)', 'GET /api/auth/me': 'test_api_permissions',
    'POST /api/auth/password': 'test_api_auth (temporary password)', 'PUT /api/auth/pin': 'test_api_auth (current password limit)',
    'GET /api/auth/device-staff': 'test_api_permissions', 'POST /api/auth/pin-unlock': 'test_api_auth (PIN)', 'POST /api/auth/pin-lock': 'test_api_auth (auto-lock)',
    'GET /api/meta': 'test_api_permissions', 'GET /api/locations': 'test_api_permissions', 'GET /api/locations/:id': 'test_api_permissions',
    'PATCH /api/locations/:id': 'test_api_permissions (denied), test_ui (owner)', 'GET /api/rooms': 'test_api_permissions', 'GET /api/rooms/:id': 'test_api_permissions',
    'POST /api/rooms': 'test_api_permissions, test_robustness', 'PATCH /api/rooms/:id': 'test_api_permissions, test_api_auth', 'DELETE /api/rooms/:id': 'test_api_permissions, test_robustness',
    'GET /api/children': 'test_api_permissions', 'GET /api/children/:id': 'test_api_permissions', 'POST /api/children': 'test_api_permissions, test_robustness',
    'PATCH /api/children/:id': 'test_api_permissions, test_api_records', 'DELETE /api/children/:id': 'test_api_permissions',
    'GET /api/enrollments': 'test_api_permissions', 'POST /api/enrollments': 'test_api_records (moves)', 'PATCH /api/enrollments/:id': 'test_api_permissions',
    'DELETE /api/enrollments/:id': 'test_api_permissions', 'GET /api/contacts': 'test_api_permissions', 'POST /api/contacts': 'test_api_permissions, test_ui',
    'PATCH /api/contacts/:id': 'test_api_permissions', 'DELETE /api/contacts/:id': 'test_api_permissions', 'GET /api/users': 'test_api_permissions',
    'POST /api/users': 'test_api_permissions, test_api_auth', 'PATCH /api/users/:id': 'test_api_permissions, test_api_auth', 'POST /api/users/:id/reset-password': 'test_api_auth',
    'PUT /api/users/:id/pin': 'test_api_permissions', 'DELETE /api/users/:id/pin': 'test_api_permissions', 'GET /api/devices': 'test_api_permissions',
    'POST /api/devices': 'test_api_auth', 'PATCH /api/devices/:id': 'test_api_auth', 'POST /api/devices/:id/reset-password': 'test_api_auth', 'DELETE /api/devices/:id': 'test_api_auth',
    'GET /api/attendance': 'test_api_permissions', 'POST /api/attendance/check-in': 'test_api_records', 'POST /api/attendance/check-out': 'test_api_records',
    'POST /api/attendance/absent': 'test_api_records', 'POST /api/attendance/undo': 'test_api_records', 'PATCH /api/attendance/:id': 'test_api_records',
    'GET /api/staff-attendance': 'test_api_permissions', 'POST /api/staff-attendance/clock-in': 'test_api_records (ratio)', 'POST /api/staff-attendance/clock-out': 'test_api_records (ratio)',
    'GET /api/entries': 'test_api_permissions', 'POST /api/entries': 'test_api_records', 'POST /api/entries/nap-end': 'test_api_records (sleep)',
    'PATCH /api/entries/:id': 'test_api_records (edit history)', 'DELETE /api/entries/:id': 'test_api_records', 'POST /api/entries/:id/sleep-check': 'test_api_records (sleep)',
    'POST /api/entries/:id/review': 'test_api_records', 'GET /api/children/:id/timeline': 'test_api_records', 'GET /api/dashboard': 'test_api_records',
    'GET /api/rooms/:id/status': 'test_api_records (ratio)', 'GET /api/forecast': 'test_api_records', 'GET /api/audit': 'test_api_permissions',
}


def test_every_route_has_tests(tmp_path):
    out = subprocess.run(['node', '-e', "console.log(JSON.stringify(require(process.argv[1]).routeTable()))", str(APP / 'api' / '_router.js')],
                         capture_output=True, text=True, check=True, env=dict(os.environ, DATA_DIR=str(tmp_path)))
    routes = {r['method'] + ' ' + r['path'] for r in json.loads(out.stdout)}
    assert len(routes) == 63
    assert routes - set(COVERED) == set(), 'routes without tests'
    assert set(COVERED) - routes == set(), 'tests for routes that no longer exist'
