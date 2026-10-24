export type ApplicationErrorKindType = 'notFound' | 'conflict' | 'invalidInput';

export abstract class ApplicationError extends Error {
  abstract readonly kind: ApplicationErrorKindType;
}
