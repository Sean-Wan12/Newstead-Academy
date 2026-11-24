/* Daily entry types (the "daily report" items teachers record) and the fields each holds.
   Based on Lillio's entry types (docs/research/lillio-foundation.md, section C.3), with two
   deliberate improvements: medication and incidents have structured forms instead of free-text
   notes, and every entry records the staff member who made it.
   internal: true means parents will not see it when the parent app and daily reports arrive.
   onlyFor: licensed age groups whose rooms may use the type (Lillio: fluids are infant-only).
   The API validates entry.data against these, and GET /api/meta sends the labels and choices
   to the front-end so the forms are built from one definition. */
'use strict';

const opt = (values, labels, extra) => Object.assign({ type: 'enum', values, labels }, extra || {});
const many = (values, labels, extra) => Object.assign({ type: 'array', of: { type: 'enum', values }, values, labels, unique: true, max: values.length }, extra || {});

const ENTRY_TYPES = {
  meal: {
    label: 'Meal',
    fields: {
      meal:   opt(['breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner'], ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner'], { required: true, label: 'Meal' }),
      amount: opt(['all', 'most', 'some', 'none', 'na'], ['All', 'Most', 'Some', 'None', 'N/A'], { required: true, label: 'How much' }),
      items:  { type: 'string', max: 200, label: 'What was served' }
    }
  },
  fluids: {
    label: 'Fluids', onlyFor: ['Infant'],
    fields: {
      fluid:  opt(['breast_milk', 'formula', 'milk', 'water', 'juice', 'other'], ['Breast milk', 'Formula', 'Milk', 'Water', 'Juice', 'Other'], { required: true, label: 'Fluid' }),
      ounces: { type: 'number', min: 0, max: 20, label: 'Amount (fl oz)' },
      notes:  { type: 'string', max: 300, label: 'Notes' }
    }
  },
  nap: {
    label: 'Sleep',
    fields: {
      start: { type: 'time', required: true, label: 'Fell asleep' },
      end:   { type: 'time', nullable: true, label: 'Woke up' },
      notes: { type: 'string', max: 300, label: 'Notes' }
    }
  },
  toileting: {
    label: 'Diaper / toilet',
    fields: {
      kind:   opt(['diaper', 'potty', 'toilet', 'underwear_change', 'accident'], ['Diaper change', 'Potty', 'Toilet', 'Underwear change', 'Accident'], { required: true, label: 'Type' }),
      result: opt(['wet', 'bm', 'wet_bm', 'dry', 'tried'], ['Wet', 'BM', 'Wet and BM', 'Dry', 'Tried'], { required: true, label: 'Result' }),
      notes:  { type: 'string', max: 300, label: 'Notes' }
    }
  },
  activity: {
    label: 'Activity',
    fields: {
      title:       { type: 'string', max: 120, required: true, label: 'Activity' },
      description: { type: 'text', max: 2000, label: 'What they did' },
      // Ontario's How Does Learning Happen? foundations, in place of Lillio's developmental tags for now
      foundation:  opt(['belonging', 'well_being', 'engagement', 'expression'], ['Belonging', 'Well-being', 'Engagement', 'Expression'], { label: 'Learning foundation' })
    }
  },
  mood: {
    label: 'Mood',
    fields: {
      mood:  opt(['happy', 'calm', 'excited', 'tired', 'sad', 'upset', 'other'], ['Happy', 'Calm', 'Excited', 'Tired', 'Sad', 'Upset', 'Other'], { required: true, label: 'Mood' }),
      level: opt(['a_little', 'very', 'extremely'], ['A little', 'Very', 'Extremely'], { label: 'How much' }),
      notes: { type: 'string', max: 300, label: 'Notes' }
    }
  },
  note: {
    label: 'Note',
    fields: {
      kind: opt(['general', 'important'], ['General update', 'Important notice'], { required: true, label: 'Kind' }),
      text: { type: 'text', max: 2000, required: true, label: 'Note' }
    }
  },
  supplies: {
    label: 'Supplies needed',
    fields: {
      items: many(['diapers', 'wipes', 'clothes', 'cream', 'formula', 'sunscreen', 'other'], ['Diapers', 'Wipes', 'Spare clothes', 'Diaper cream', 'Formula', 'Sunscreen', 'Other'], { required: true, min: 1, label: 'Running low on' }),
      notes: { type: 'string', max: 300, label: 'Notes' }
    }
  },
  temperature: {
    label: 'Temperature',
    fields: {
      celsius: { type: 'number', min: 34, max: 43, required: true, label: 'Temperature (°C)' },
      status:  opt(['normal', 'feverish'], ['Normal', 'Feverish'], { required: true, label: 'Reading' }),
      notes:   { type: 'string', max: 300, label: 'Notes' }
    }
  },
  health_check: {
    label: 'Health', internal: true,
    fields: {
      status:       opt(['fine', 'sick', 'injured'], ['Fine', 'Sick', 'Injured'], { required: true, label: 'Status' }),
      observations: { type: 'string', max: 300, label: 'Observations' },
      notes:        { type: 'string', max: 500, label: 'Notes' }
    }
  },
  medication: {
    label: 'Medication given',
    fields: {
      medicine:         { type: 'string', max: 120, required: true, label: 'Medicine' },
      dose:             { type: 'string', max: 60, required: true, label: 'Dose' },
      reason:           { type: 'string', max: 200, label: 'Reason' },
      parentAuthorized: { type: 'bool', default: false, label: 'Written parent authorization on file' },
      notes:            { type: 'string', max: 300, label: 'Notes' }
    }
  },
  incident: {
    label: 'Incident',
    fields: {
      kind:           opt(['injury', 'illness', 'behaviour', 'other'], ['Injury', 'Illness', 'Behaviour', 'Other'], { required: true, label: 'Kind' }),
      description:    { type: 'text', max: 2000, required: true, label: 'What happened' },
      actionTaken:    { type: 'text', max: 2000, label: 'Action taken' },
      parentNotified: { type: 'bool', label: 'Parent notified', default: false },
      notifiedAt:     { type: 'time', nullable: true, label: 'Time notified' }
    }
  },
  name_to_face: {
    label: 'Name-to-face check', internal: true,
    fields: {
      area:  { type: 'string', max: 60, label: 'Where (e.g. Playground)' },
      notes: { type: 'string', max: 300, label: 'Notes' }
    }
  }
};

const TYPE_KEYS = Object.keys(ENTRY_TYPES);
const ABSENT_REASONS = ['sick', 'vacation', 'appointment', 'family', 'holiday', 'centre_closure', 'not_scheduled', 'no_reason', 'other'];
const ABSENT_LABELS = ['Sick', 'Vacation', 'Appointment', 'Family reasons', 'Holiday', 'Centre closure', 'Not scheduled', 'No reason given', 'Other'];

/* Data that is safe to send to the browser */
function entryTypesForClient() {
  const out = {};
  for (const [k, t] of Object.entries(ENTRY_TYPES)) {
    out[k] = { label: t.label, internal: !!t.internal, onlyFor: t.onlyFor || null,
      fields: Object.fromEntries(Object.entries(t.fields).map(([f, s]) => [f, { type: s.type, label: s.label, required: !!s.required, values: s.values, labels: s.labels, min: s.min, max: s.max }])) };
  }
  return out;
}

module.exports = { ENTRY_TYPES, TYPE_KEYS, ABSENT_REASONS, ABSENT_LABELS, entryTypesForClient };
