export type ApplicationErrorKindType =
  'notFound' | 'conflict' | 'invalidInput' | 'unauthorized' | 'forbidden' | 'tooManyRequests';

export abstract class ApplicationError extends Error {
  abstract readonly kind: ApplicationErrorKindType;
}
