import { createHttpError } from './http.js';

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeNullableText(value) {
  const normalizedValue = normalizeText(value);
  return normalizedValue || null;
}

export function normalizeEmail(email) {
  return normalizeText(email).toLowerCase();
}

export function normalizeMatricNumber(matricNumber) {
  return normalizeText(matricNumber).toUpperCase();
}

export function normalizePhoneNumber(phoneNumber) {
  return normalizeText(phoneNumber);
}

export function ensureNonEmptyString(value, fieldName) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    throw createHttpError(400, `${fieldName} is required.`);
  }

  return normalizedValue;
}

export function ensureValidEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createHttpError(400, 'email is required.');
  }

  if (!SIMPLE_EMAIL_REGEX.test(normalizedEmail)) {
    throw createHttpError(400, 'email must be a valid email address.');
  }

  return normalizedEmail;
}

export function parseIntegerInRange(
  value,
  {
    fieldName,
    defaultValue,
    min,
    max,
  },
) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    throw createHttpError(400, `${fieldName} must be an integer.`);
  }

  if (parsedValue < min || parsedValue > max) {
    throw createHttpError(400, `${fieldName} must be between ${min} and ${max}.`);
  }

  return parsedValue;
}

export function buildFullName(firstName, lastName) {
  return [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(' ');
}

export function splitFullName(fullName) {
  const normalizedFullName = normalizeText(fullName);

  if (!normalizedFullName) {
    return {
      firstName: '',
      lastName: '',
    };
  }

  const [firstName, ...remainingParts] = normalizedFullName.split(/\s+/);

  return {
    firstName,
    lastName: remainingParts.join(' '),
  };
}
