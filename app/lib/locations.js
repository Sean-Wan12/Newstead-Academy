/* The two Newstead locations and Richmond Hill's licensed rooms (from the licence,
   November 2026; same as admin/js/locations.js). These are public business facts, not
   children's data. seed.js writes them into storage; after that, storage is the source.
   lic is the licensed age group; runsAs is how the room is run day to day.
   Markham's room-by-room capacities are not known yet, so the seed creates placeholder
   rooms marked "placeholder: true" for the owner to correct. */
'use strict';

const LOCATIONS = [
  {
    id: 'rh', name: 'Richmond Hill', fullName: 'Newstead Academy Childcare, Richmond Hill',
    licensee: 'Newstead Education Group Corp.', address: '13085 Yonge Street, Units 12 and 22, Richmond Hill, ON L4E 3S8',
    phone: '(289) 234-8886', licensedAgeGroups: ['Toddler', 'Preschool', 'Kindergarten'],
    forecastDefaults: { moveAge: 30, leaveAge: 6 },
    notes: [
      'Total licensed capacity is 167 and must not be exceeded at any time.',
      'Mixed-age grouping is approved under subsections 8(2) and 8(3) of O. Reg. 137/15.',
      'The room called Kindergarten 2 is licensed as Preschool 4: 24 children, 1 staff per 8, children under 6.'
    ]
  },
  {
    id: 'mk', name: 'Markham', fullName: 'Newstead Academy Markham',
    licensee: 'Newstead Academy Child Care Markham Corp.', address: '120 South Town Centre Blvd, Markham, ON L6G 1C3',
    phone: '(416) 826-9772', licensedAgeGroups: ['Infant', 'Toddler', 'Preschool'],
    forecastDefaults: { moveAge: 30, leaveAge: 4 },
    notes: [
      'Room-by-room capacities are not entered yet. The demo rooms are placeholders: correct them from the licence.',
      'No kindergarten room, so the forecast assumes children leave in September of the year they turn 4.'
    ]
  }
];

const RH_ROOMS = [
  { code: 'T1', name: 'Toddler 1',      licName: 'Toddler 1',      ageGroup: 'Toddler',      runsAs: 'Toddler',      licensedCapacity: 15 },
  { code: 'T2', name: 'Toddler 2',      licName: 'Toddler 2',      ageGroup: 'Toddler',      runsAs: 'Toddler',      licensedCapacity: 15 },
  { code: 'T3', name: 'Toddler 3',      licName: 'Toddler 3',      ageGroup: 'Toddler',      runsAs: 'Toddler',      licensedCapacity: 15 },
  { code: 'P1', name: 'Preschool 1',    licName: 'Preschool 1',    ageGroup: 'Preschool',    runsAs: 'Preschool',    licensedCapacity: 24 },
  { code: 'P2', name: 'Preschool 2',    licName: 'Preschool 2',    ageGroup: 'Preschool',    runsAs: 'Preschool',    licensedCapacity: 24 },
  { code: 'P3', name: 'Preschool 3',    licName: 'Preschool 3',    ageGroup: 'Preschool',    runsAs: 'Preschool',    licensedCapacity: 24 },
  { code: 'K2', name: 'Kindergarten 2', licName: 'Preschool 4',    ageGroup: 'Preschool',    runsAs: 'Kindergarten', licensedCapacity: 24 },
  { code: 'K1', name: 'Kindergarten 1', licName: 'Kindergarten 1', ageGroup: 'Kindergarten', runsAs: 'Kindergarten', licensedCapacity: 26 }
];

/* Placeholders only: Markham's real capacities must come from its licence */
const MK_PLACEHOLDER_ROOMS = [
  { code: 'I1', name: 'Infant 1',    licName: 'Infant 1 (placeholder)',    ageGroup: 'Infant',    runsAs: 'Infant',    licensedCapacity: 10, placeholder: true },
  { code: 'T1', name: 'Toddler 1',   licName: 'Toddler 1 (placeholder)',   ageGroup: 'Toddler',   runsAs: 'Toddler',   licensedCapacity: 15, placeholder: true },
  { code: 'P1', name: 'Preschool 1', licName: 'Preschool 1 (placeholder)', ageGroup: 'Preschool', runsAs: 'Preschool', licensedCapacity: 24, placeholder: true }
];

module.exports = { LOCATIONS, RH_ROOMS, MK_PLACEHOLDER_ROOMS };
