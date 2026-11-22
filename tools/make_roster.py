"""Turn Lillio's "Enrollment (csv)" report into the roster file the admin site loads.

Usage:  python3 tools/make_roster.py path/to/enrollment.csv [2026-11-16]

Writes admin/data/richmond-hill.js. Only initials, birth month, room and dates are kept.
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


def initials(first, last):
    first, last = first.strip(), last.strip()
    return (first[:1] + '.' + (last[:1] + '.' if last else '')).upper()


def build(path, today):
    kids, plans, key = [], [], {}
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
            kid = {'id': len(kids) + 1, 'n': initials(r['First name'], r['Last name']), 'b': dob.strftime('%Y-%m'),
                   'r': room, 's': start.strftime('%Y-%m')}
            if end:
                kid['e'] = end.isoformat()
            kids.append(kid)
            key[k] = kid['id']
        elif start > today:
            later.append((k, r, dob, start, room))
    for k, r, dob, start, room in later:
        if k not in key:
            key[k] = len(kids) + 1
            kids.append({'id': key[k], 'n': initials(r['First name'], r['Last name']), 'b': dob.strftime('%Y-%m'),
                         'r': None, 's': start.strftime('%Y-%m')})
        plans.append({'id': key[k], 'r': room, 'd': start.isoformat()})
    return {'asOf': today.isoformat(), 'kids': kids, 'plans': plans}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    today = datetime.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else datetime.date.today()
    data = build(sys.argv[1], today)
    out = pathlib.Path(__file__).resolve().parent.parent / 'admin' / 'data' / 'richmond-hill.js'
    out.parent.mkdir(exist_ok=True)
    out.write_text('/* Richmond Hill roster from the Lillio export, initials only. Not committed to git. */\n'
                   'window.RH_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print('Wrote', out, '-', sum(1 for k in data['kids'] if k['r']), 'children enrolled,', len(data['plans']), 'future starts')
