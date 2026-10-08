import type { TFunction } from 'i18next';
import { type ProgramSectionField } from '../config-schema';

/**
 * Program sections are configured in English (section titles, field labels, choice labels and
 * option strings), and that English text doubles as the translation key -- see
 * translation-keys.ts for the list of default strings kept in the translation files. Only the
 * displayed text is translated: the English values remain what is saved, compared against
 * (visibleWhenValue, autofill rules) and matched (programName).
 *
 * Separators are disabled for this lookup so keys such as "G:" or "Foetus:1" (or any configured
 * text containing "." or ":") are looked up as-is rather than split into a namespace/key path.
 * Configured text without a translation falls back to itself.
 */
export function translateProgramSectionText(t: TFunction, text: string): string {
  if (!text) {
    return text;
  }
  return t(text, text, { nsSeparator: false, keySeparator: false });
}

/**
 * Translates a recorded value of a select field for display, if it is one of that field's
 * configured choices (an option string, or a coded answer's label). Anything else -- free text,
 * numbers, dates, or a coded answer whose server display isn't one of the configured labels --
 * is shown unchanged.
 */
export function translateProgramSectionValue(t: TFunction, field: ProgramSectionField, value: string): string {
  if (field.controlType !== 'select' || !value) {
    return value;
  }
  const isConfiguredChoice =
    (field.options ?? []).includes(value) || (field.answers ?? []).some((answer) => answer.label === value);
  return isConfiguredChoice ? translateProgramSectionText(t, value) : value;
}
