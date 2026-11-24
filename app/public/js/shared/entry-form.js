/* Builds the form for a daily entry from /api/meta's entry type definitions, so the fields
   and choices always match what the server validates. Used by the teacher and admin panels. */
import { openForm } from './ui.js';

/* Form field list for an entry type. withTime adds a "Time" field. */
export function entryFields(metaTypes, type, withTime) {
  const def = metaTypes[type], fields = [];
  if (withTime && type !== 'nap') fields.push({ k: '__time', label: 'Time', type: 'time', required: true });
  for (const [k, f] of Object.entries(def.fields)) {
    const base = { k, label: f.label, required: f.required };
    if (f.type === 'array') fields.push(Object.assign(base, { type: 'checkboxes', wide: true, options: f.values.map((v, i) => [v, f.labels[i]]) }));
    else if (f.type === 'enum') fields.push(Object.assign(base, { type: 'select', options: (f.required ? [] : [['', 'Not set']]).concat(f.values.map((v, i) => [v, f.labels[i]])) }));
    else if (f.type === 'bool') fields.push(Object.assign(base, { type: 'checkbox' }));
    else if (f.type === 'time') fields.push(Object.assign(base, { type: 'time' }));
    else if (f.type === 'number') fields.push(Object.assign(base, { type: 'number', min: f.min, max: f.max, step: 'any' }));
    else if (f.type === 'text') fields.push(Object.assign(base, { type: 'textarea', max: f.max, wide: true, rows: 3 }));
    else fields.push(Object.assign(base, { type: 'text', max: f.max, wide: (f.max || 0) > 150 }));
  }
  return fields;
}

/* Splits form values into { time, data } for the API, dropping empty optional values */
export function entryPayload(values) {
  const data = {}; let time = null;
  for (const [k, v] of Object.entries(values)) {
    if (k === '__time') { time = v; continue; }
    if (v === '' || v === null || (Array.isArray(v) && !v.length)) continue;
    data[k] = v;
  }
  return { time, data };
}

/* Opens a form for a new entry or an edit. save({ time, data }) does the API call. */
export function openEntryForm({ metaTypes, type, title, intro, values, now, save, actions }) {
  const fields = entryFields(metaTypes, type, true);
  const v = Object.assign({ __time: now }, values || {});
  if (type === 'nap' && !v.start) v.start = now;
  if (type === 'meal' && !v.amount) v.amount = 'all';
  return openForm({ title, intro, fields, values: v, submit: 'Save', actions, onSubmit: vals => save(entryPayload(vals)) });
}
