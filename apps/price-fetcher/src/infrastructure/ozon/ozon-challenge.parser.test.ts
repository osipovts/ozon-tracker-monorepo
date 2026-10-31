import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonChallengeParser } from './ozon-challenge.parser.js';

const parser = new OzonChallengeParser();

void test('recognizes the antibot check by its title or text', (): void => {
  assert.equal(parser.isChallenge('Antibot Captcha', ''), true);
  assert.equal(parser.isChallenge('Ozon', 'Подтвердите, что вы человек'), true);
  assert.equal(parser.isChallenge('Notebook', 'В корзину'), false);
});
