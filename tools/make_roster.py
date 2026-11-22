"""Turn Lillio's "Enrollment (csv)" report into the roster file the admin site loads.

Usage:  python3 tools/make_roster.py path/to/enrollment.csv [2026-11-16]

Writes admin/data/richmond-hill.js. Each child is kept as first name and last-name initial
("Emma L."), birth month, room and dates. Nothing else from the export is copied.
That file is git-ignored: publish it with the site, never commit it.
Markham doesn't need this: its roster is imported on the site (Classroom rosters page).
"""
import csv, json, sys, datetime, pathlib

ROOM_IDS = {'Toddler 1': 'T1', 'Toddler 2': 'T2', 'Toddler 3': 'T3', 'Preschool 1': 'P1', 'Preschool 2': 'P2',
            'Preschool 3': 'P3', 'Kindergarten 2': 'K2', 'Kindergarten 1': 'K1'}


def us_date(s):
    try:
        return datetime.datetime.strptime(s.strip(), '%m/%d/%Y').date()
    except ValueError:
        return None


def display_name(first, last, letters=1):
    """First name as Lillio has it, plus the last-name initial: 'Emma L.'"""
    first, last = ' '.join(first.split()), last.strip()
    initial = last[:letters].capitalize() + '.' if last else ''
    return (first + ' ' + initial).strip() or 'Unnamed child'


def make_unique(kids, last_names):
    """Two children with the same first name and initial get more letters of the last name: 'Ethan Wa.', 'Ethan We.'"""
    for _ in range(12):
        seen = {}
        for k in kids:
            seen.setdefault(k['n'], []).append(k)
        clashes = [g for g in seen.values() if len(g) > 1]
        if not clashes:
            return
        for group in clashes:
            for k in group:
                first, last = last_names[k['id']]
                letters = len(k['n'].rsplit(' ', 1)[-1].rstrip('.')) + 1 if ' ' in k['n'] else 1
                k['n'] = display_name(first, last, letters)


def build(path, today):
    kids, plans, key, names = [], [], {}, {}
    rows = [r for r in csv.DictReader(open(path, newline='', encoding='utf-8-sig'))
            if 'test' not in (r['First name'] + ' ' + r['Last name']).lower()]
    later = []
    for r in rows:
        dob, start, end = us_date(r['DOB']), us_date(r['Enroll date']), us_date(r['Grad date'])
        room = ROOM_IDS.get(r['Classroom'].strip())
        if not (dob and start and room):
            continue
        k = (r['First name'].strip().lower(), r['Last name'].strip().lower(), dob)
        if start <= today and (end is None or end >= today):
            kid = {'id': len(kids) + 1, 'n': display_name(r['First name'], r['Last name']), 'b': dob.strftime('%Y-%m'),
                   'r': room, 's': start.strftime('%Y-%m')}
            if end:
                kid['e'] = end.isoformat()
            kids.append(kid)
            key[k] = kid['id']
            names[kid['id']] = (r['First name'], r['Last name'])
        elif start > today:
            later.append((k, r, dob, start, room))
    for k, r, dob, start, room in later:
        if k not in key:
            key[k] = len(kids) + 1
            kids.append({'id': key[k], 'n': display_name(r['First name'], r['Last name']), 'b': dob.strftime('%Y-%m'),
                         'r': None, 's': start.strftime('%Y-%m')})
            names[key[k]] = (r['First name'], r['Last name'])
        plans.append({'id': key[k], 'r': room, 'd': start.isoformat()})
    make_unique(kids, names)
    return {'asOf': today.isoformat(), 'kids': kids, 'plans': plans}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    today = datetime.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else datetime.date.today()
    data = build(sys.argv[1], today)
    out = pathlib.Path(__file__).resolve().parent.parent / 'admin' / 'data' / 'richmond-hill.js'
    out.parent.mkdir(exist_ok=True)
    out.write_text('/* Richmond Hill roster from the Lillio export: first names and last-name initials. Not committed to git. */\n'
                   'window.RH_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print('Wrote', out, '-', sum(1 for k in data['kids'] if k['r']), 'children enrolled,', len(data['plans']), 'future starts')
