/** Browsers in the order they are told apart: the user agent of one names the engines it is built on. */
const browsers: ReadonlyArray<[RegExp, string]> = [
  [/Edg(?:A|iOS)?\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/** Systems in the same way: an iPhone and an Android phone say they are a Mac and a Linux too. */
const systems: ReadonlyArray<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

function nameIn(userAgent: string, known: ReadonlyArray<[RegExp, string]>): string | null {
  return known.find(([pattern]): boolean => pattern.test(userAgent))?.[1] ?? null;
}

/** The browser and the system out of a user agent, short: the whole string is a line of versions. */
export function describeDevice(userAgent: string | null): string | null {
  if (userAgent === null) return null;

  const parts = [nameIn(userAgent, browsers), nameIn(userAgent, systems)].filter(
    (part): part is string => part !== null,
  );

  return parts.length === 0 ? null : parts.join(', ');
}
