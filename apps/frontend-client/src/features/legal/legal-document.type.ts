export interface LegalSectionInterface {
  heading: string;
  paragraphs: string[];
}

/** A legal text in one language: a title, the day it was last changed, and its sections in order. */
export interface LegalDocumentInterface {
  title: string;
  updated: string;
  sections: LegalSectionInterface[];
}

export type LegalDocumentsType = Record<'en' | 'ru', LegalDocumentInterface>;

/** The day the texts below were last changed. */
export const legalUpdatedOn = '2026-10-31';
