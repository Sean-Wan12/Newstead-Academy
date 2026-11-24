/* Input validation. Every API handler passes request bodies and query values through
   check(input, schema) and uses only what comes back: unknown fields are dropped,
   strings are trimmed and length-limited, and any problem becomes a 400 with a
   message per field.
   A schema maps field -> spec: { type, required, max, min, values, of, nullable }
   types: string, text (long string), int, number, bool, date, time, enum, id, email, array, object */
'use strict';
const { HttpError } = require('./http');
const { isValidDate, isValidTime } = require('./dates');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,24}$/;

function checkValue(v, spec, label) {
  const t = spec.type;
  if (t === 'string' || t === 'text') {
    if (typeof v !== 'string') return [null, 'must be text'];
    const s = v.trim().replace(/\u0000/g, '');
    const max = spec.max || (t === 'text' ? 4000 : 200);
    if (s.length > max) return [null, 'must be at most ' + max + ' characters'];
    if (spec.min && s.length < spec.min) return [null, 'must be at least ' + spec.min + ' characters'];
    if (spec.pattern && s && !spec.pattern.test(s)) return [null, spec.patternText || 'is not in the right format'];
    return [s];
  }
  if (t === 'int' || t === 'number') {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n) || (t === 'int' && !Number.isInteger(n))) return [null, 'must be a ' + (t === 'int' ? 'whole ' : '') + 'number'];
    if (spec.min != null && n < spec.min) return [null, 'must be at least ' + spec.min];
    if (spec.max != null && n > spec.max) return [null, 'must be at most ' + spec.max];
    return [n];
  }
  if (t === 'bool') {
    if (v === true || v === 'true') return [true];
    if (v === false || v === 'false') return [false];
    return [null, 'must be true or false'];
  }
  if (t === 'date') return isValidDate(v) ? [v] : [null, 'must be a date like 2026-11-23'];
  if (t === 'time') return isValidTime(v) ? [v] : [null, 'must be a time like 08:30'];
  if (t === 'enum') return spec.values.includes(v) ? [v] : [null, 'must be one of: ' + spec.values.join(', ')];
  if (t === 'id') return typeof v === 'string' && ID_RE.test(v) ? [v] : [null, 'is not a valid id'];
  if (t === 'email') {
    if (typeof v !== 'string') return [null, 'must be an email address'];
    const s = v.trim().toLowerCase();
    return EMAIL_RE.test(s) ? [s] : [null, 'must be an email address'];
  }
  if (t === 'array') {
    if (!Array.isArray(v)) return [null, 'must be a list'];
    if (spec.max != null && v.length > spec.max) return [null, 'can have at most ' + spec.max + ' items'];
    if (spec.min != null && v.length < spec.min) return [null, 'needs at least ' + spec.min + ' item' + (spec.min === 1 ? '' : 's')];
    const out = [];
    for (let i = 0; i < v.length; i++) {
      const [x, err] = checkValue(v[i], spec.of, label);
      if (err) return [null, 'item ' + (i + 1) + ' ' + err];
      out.push(x);
    }
    return [spec.unique ? Array.from(new Set(out)) : out];
  }
  if (t === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return [null, 'must be an object'];
    try { return [check(v, spec.schema, { partial: spec.partial })]; }
    catch (e) { return [null, e.details ? Object.entries(e.details).map(([k, m]) => k + ' ' + m).join('; ') : e.message]; }
  }
  throw new Error('Unknown validation type ' + t);
}

/* partial: true for PATCH bodies, where required fields may be left out */
function check(input, schema, opts) {
  const partial = opts && opts.partial, out = {}, errors = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const [k, spec] of Object.entries(schema)) {
    const v = src[k];
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '' && spec.type !== 'string' && spec.type !== 'text');
    if (empty) {
      // nullable fields can be cleared by sending null or an empty string
      if (spec.nullable && (v === null || typeof v === 'string')) { out[k] = null; continue; }
      if (spec.required && !partial) errors[k] = 'is required';
      else if (!partial && spec.default !== undefined) out[k] = typeof spec.default === 'function' ? spec.default() : spec.default;
      continue;
    }
    const [val, err] = checkValue(v, spec, k);
    if (err) errors[k] = err;
    else if (spec.required && (val === '' || (Array.isArray(val) && !val.length && spec.min))) errors[k] = 'is required';
    else out[k] = val;
  }
  if (Object.keys(errors).length) {
    const msg = Object.entries(errors).map(([k, m]) => (schema[k].label || k) + ' ' + m).join('. ');
    throw new HttpError(400, msg, errors);
  }
  return out;
}

module.exports = { check, ID_RE };
