import type { en } from './en.js';

/** The shape of a dictionary: the keys of English, each a string; the other languages must have all of them. */
type StringsOfType<Shape> = {
  [Key in keyof Shape]: Shape[Key] extends string ? string : StringsOfType<Shape[Key]>;
};

export type DictionaryType = StringsOfType<typeof en>;
