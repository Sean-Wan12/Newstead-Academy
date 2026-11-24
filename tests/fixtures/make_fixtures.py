"""Builds the synthetic rosters the end-to-end tests use. Every name here is made up:
the tests never load real children's records. Run: python3 tests/fixtures/make_fixtures.py"""
import json, pathlib, itertools
HERE = pathlib.Path(__file__).resolve().parent
FIRST = ['Ari', 'Bo', 'Cai', 'Dex', 'Eno', 'Fen', 'Gil', 'Hal', 'Ide', 'Jax', 'Kit', 'Lux', 'Moe', 'Nim', 'Oki', 'Pax', 'Quin', 'Rio', 'Sol', 'Tav', 'Uli', 'Vee', 'Wyn', 'Xan', 'Yul', 'Zed']
LAST = ['Alder', 'Birch', 'Cedar', 'Dogwood', 'Elm', 'Fir', 'Gum', 'Hazel', 'Ivy', 'Juniper']
# Richmond Hill rooms and how many children each has in the built-in roster (Nov 16): Kindergarten 1 is one over
ROOMS = [('T1', 'Toddler 1', 15, '2024-09'), ('T2', 'Toddler 2', 15, '2024-11'), ('T3', 'Toddler 3', 14, '2025-01'),
         ('P1', 'Preschool 1', 24, '2023-03'), ('P2', 'Preschool 2', 23, '2023-06'), ('P3', 'Preschool 3', 24, '2023-09'),
         ('K2', 'Kindergarten 2', 22, '2022-05'), ('K1', 'Kindergarten 1', 27, '2021-08')]
names = (f + '|' + l for l, f in itertools.product(LAST, FIRST))
kids, rows = [], []
for rid, cls, n, born in ROOMS:
    for i in range(n):
        f, l = next(names).split('|')
        kid = {'id': len(kids) + 1, 'n': f + ' ' + l[0] + '.', 'b': born, 'r': rid, 's': '2026-09'}
        kids.append(kid)
        y, m = born.split('-')
        grad = '11/13/2026' if (rid == 'K1' and i == 0) else ''   # the child who has left (end date missing from the old roster)
        rows.append([f, l, m + '/15/' + y, '', cls, 'Active', '09/01/2026', grad, '', 'MTWRF'])
rh = {'asOf': '2026-11-16', 'kids': kids, 'plans': []}
# The built-in file does not know that the first Kindergarten 1 child left on Nov 13
(HERE / 'richmond-hill.js').write_text('/* Synthetic Richmond Hill roster for tests. Made-up names. */\nwindow.RH_DATA = ' + json.dumps(rh) + ';\n')
head = 'First name,Last name,DOB,Age,Classroom,Status,Enroll date,Grad date,Rotation,Schedule'
rows.append(['Test', 'Child', '01/01/2024', '', 'Toddler 1', 'Active', '09/01/2026', '', '', 'MTWRF'])
rows.append(['Quin', 'Oak', '06/15/2025', '', 'Toddler 3', 'Upcoming', '01/04/2027', '', '', 'MTWRF'])
(HERE / 'rh-lillio.csv').write_text('\r\n'.join([head] + [','.join(r) for r in rows]) + '\r\n')
# Markham: an infant room, a toddler room and a preschool room, plus a classroom with no matching room
mk = [['Ari', 'Maple', '03/15/2026', '', 'Infant 1', 'Active', '09/01/2026', '', '', 'MTWRF'],
      ['Bo', 'Maple', '01/15/2026', '', 'Infant 1', 'Active', '09/01/2026', '', '', 'MTWRF'],
      ['Ari', 'Mulberry', '05/15/2025', '', 'Toddler 1', 'Active', '09/01/2026', '', '', 'MTWRF'],
      ['Cai', 'Pine', '02/15/2024', '', 'Preschool 1', 'Active', '09/01/2026', '', '', 'MTWRF'],
      ['"Dex ""DJ"""', 'Poplar', '02/15/2024', '', 'Preschool 1', 'Active', '09/01/2026', '', '', 'MTWRF'],
      ['Eno', 'Spruce', '02/15/2020', '', 'School Age', 'Active', '09/01/2026', '', '', 'MTWRF'],
      ['Fen', 'Teak', '02/15/2024', '', 'Preschool 1', 'Upcoming', '02/01/2027', '', '', 'MTWRF']]
(HERE / 'mk-lillio.csv').write_text('\n'.join([head] + [','.join(r) for r in mk]) + '\n')
# Markham export whose names try to inject markup
xss = [['<img src=x onerror="window.__xss=1" data-xss>', 'Pine', '02/15/2024', '', 'Preschool 1', 'Active', '09/01/2026', '', '', 'MTWRF'],
       ['"\'><svg onload=window.__xss=1 data-xss>', 'Oak', '05/15/2025', '', 'Toddler 1', 'Active', '09/01/2026', '', '', 'MTWRF']]
def q(v): return '"' + v.replace('"', '""') + '"'
(HERE / 'mk-xss.csv').write_text('\n'.join([head] + [','.join(q(v) for v in r) for r in xss]) + '\n')
print('fixtures written')
