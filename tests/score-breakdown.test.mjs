import test from 'node:test';
import assert from 'node:assert/strict';
import { combineFinalScore } from '../src/services/score.js';

test('final equals clamp(baseline + delta)', () => {
  const baseline = {
    subscription: 62,
    commission: 59,
    payment: 75,
    ecosystem: 69,
    overall: 63
  };
  const delta = {
    subscription: -4,
    commission: 13,
    payment: -9,
    ecosystem: 0,
    overall: 0
  };

  const final = combineFinalScore(baseline, delta);

  assert.equal(final.subscription, 58);
  assert.equal(final.commission, 72);
  assert.equal(final.payment, 66);
  assert.equal(final.ecosystem, 69);
  assert.equal(final.overall, 63);
});

test('clamp upper and lower bounds', () => {
  const baseline = {
    subscription: 95,
    commission: 5,
    payment: 60,
    ecosystem: 40,
    overall: 50
  };
  const delta = {
    subscription: 20,
    commission: -30,
    payment: 50,
    ecosystem: -100,
    overall: -70
  };

  const final = combineFinalScore(baseline, delta);

  assert.equal(final.subscription, 100);
  assert.equal(final.commission, 0);
  assert.equal(final.payment, 100);
  assert.equal(final.ecosystem, 0);
  assert.equal(final.overall, 0);
});
