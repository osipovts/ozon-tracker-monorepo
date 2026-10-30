export type ApplicationErrorKindType = 'notFound' | 'conflict' | 'invalidInput' | 'unauthorized';

export abstract class ApplicationError extends Error {
  abstract readonly kind: ApplicationErrorKindType;
}
