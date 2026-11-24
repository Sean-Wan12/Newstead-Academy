"""A tiny HTTP client for the app's JSON API, with its own cookie jar. Standard library only."""
import http.client, json
from urllib.parse import urlsplit


class Client:
    def __init__(self, base, origin=True):
        u = urlsplit(base)
        self.base, self.host, self.port = base, u.hostname, u.port
        self.cookies, self.origin = {}, (base if origin is True else origin)

    def request(self, method, path, body=None, headers=None, raw=None):
        c = http.client.HTTPConnection(self.host, self.port, timeout=30)
        h = {}
        if self.origin and method not in ('GET', 'HEAD'):
            h['Origin'] = self.origin
        if self.cookies:
            h['Cookie'] = '; '.join('%s=%s' % kv for kv in self.cookies.items())
        data = raw
        if body is not None:
            data = json.dumps(body).encode()
            h['Content-Type'] = 'application/json'
        h.update(headers or {})
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        text = r.read().decode('utf-8', 'replace')
        for k, v in r.getheaders():
            if k.lower() == 'set-cookie':
                name, val = v.split(';', 1)[0].split('=', 1)
                if 'Max-Age=0' in v or not val:
                    self.cookies.pop(name, None)
                else:
                    self.cookies[name] = val
        try:
            js = json.loads(text) if text else None
        except ValueError:
            js = None
        c.close()
        return Resp(r.status, js, dict((k.lower(), v) for k, v in r.getheaders()), text)

    def get(self, path, **kw): return self.request('GET', path, **kw)
    def post(self, path, body=None, **kw): return self.request('POST', path, {} if body is None else body, **kw)
    def patch(self, path, body=None, **kw): return self.request('PATCH', path, {} if body is None else body, **kw)
    def put(self, path, body=None, **kw): return self.request('PUT', path, {} if body is None else body, **kw)
    def delete(self, path, body=None, **kw): return self.request('DELETE', path, body, **kw)


class Resp:
    def __init__(self, status, json, headers, text):
        self.status, self.json, self.headers, self.text = status, json, headers, text

    def __repr__(self):
        return '<%d %s>' % (self.status, self.text[:200])
