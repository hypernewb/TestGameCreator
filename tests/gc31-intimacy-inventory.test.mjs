import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as intimacy from '../packages/modules/intimacy.mjs';
import * as firsts from '../packages/modules/firsts.mjs';
import * as touch from '../packages/modules/touch-ladder.mjs';
import * as sobriety from '../packages/modules/sobriety.mjs';
import * as skeleton from '../packages/cards/intimacy-skeleton.mjs';
import * as beats from '../packages/cards/beat-library.mjs';
import * as firstsUi from '../public/firsts-ui.mjs';
import * as wardrobe from '../public/wardrobe.mjs';

// GC3.1 drift guard: every export and identifier named in docs/research/gc31-intimacy-trace-2026-10-08.md must still exist.
const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fns = (mod, names) => names.forEach(n => assert.equal(typeof mod[n], 'function', `${n} is not an exported function`));

test('GC3.1 inventory: intimacy module exports the named functions and objects', () => {
  fns(intimacy, ['intimateSceneOf', 'sensitivityScaleOf', 'regionLimitReason', 'setRegionAgreement', 'clearRegionAgreements', 'hardLimitOf', 'validateSensitivityScale', 'settingsOf', 'categoriesOf', 'sobrietyLevel', 'intimacyEligibility', 'setIntimacyConsent', 'discoverIntimacyInterest', 'completeIntimacy', 'intimacyContext']);
  assert.equal(intimacy.intimacy.id, 'social.intimacy');
});

test('GC3.1 inventory: intimacy command names exist in source', () => {
  const s = src('packages/modules/intimacy.mjs');
  for (const c of ['social.requestIntimacy', 'social.beginIntimacy', 'social.withdrawConsent', 'social.offerAftercare', 'social.discloseEncounter']) assert.ok(s.includes(`'${c}'`), c);
});

test('GC3.1 inventory: category identifiers are first-night and fling', () => {
  assert.deepEqual(beats.INTIMACY_CATEGORIES.map(c => c.id), ['first-night', 'fling']);
  assert.equal(intimacy.categoriesOf({}).length, 2);
});

test('GC3.1 inventory: firsts module, rung and checkpoint identifiers', () => {
  fns(firsts, ['typedStop', 'typedYes', 'firstBrief']);
  assert.equal(firsts.firsts.id, 'social.firsts');
  assert.deepEqual(Object.keys(beats.RUNGS), ['talk', 'date', 'kiss', 'night']);
  assert.deepEqual(Object.keys(beats.FIRST_CHECKPOINTS), ['talk', 'date', 'kiss', 'night']);
  assert.deepEqual(beats.FIRST_CHECKPOINTS.night.map(c => c.id), ['lead', 'check-in', 'peak']);
  assert.deepEqual(beats.FIRST_CHECKPOINTS.kiss.map(c => c.id), ['reading', 'leaning-in', 'after']);
  assert.equal(beats.FIRST_INPUTS, 2);
  assert.deepEqual(Object.keys(beats.NIGHT), ['lead', 'rush', 'honest', 'yes', 'close', 'more']);
  assert.deepEqual(Object.keys(beats.TONES), ['best', 'good', 'fond', 'careful', 'light', 'spark', 'flat', 'miss']);
  assert.equal(typeof beats.firstTone, 'function');
  for (const c of ['social.startFirst', 'social.scoreFirst', 'social.stopFirst']) assert.ok(src('packages/modules/firsts.mjs').includes(`'${c}'`), c);
});

test('GC3.1 inventory: touch ladder steps, regions and commands', () => {
  fns(touch, ['touchRegion', 'touchTextRegion', 'mapTouchText', 'touchEligibility', 'refuseRegionTouch', 'applyRegionAct', 'attemptTouch', 'touchLadderContext']);
  assert.deepEqual(Object.keys(touch.TOUCH_REGIONS), ['handhold', 'cheekkiss', 'kiss', 'makeout', 'oral', 'sex']);
  for (const id of ['handhold', 'armaround', 'hug', 'cheekkiss', 'kiss', 'makeout', 'oral', 'sex']) assert.ok(touch.LADDER.some(s => s.id === id), id);
  assert.ok(src('packages/modules/touch-ladder.mjs').includes("'social.attemptTouch'"));
});

test('GC3.1 inventory: sobriety, skeleton, UI and wardrobe exports', () => {
  fns(sobriety, ['sobrietyOf']);
  assert.equal(sobriety.sobriety.id, 'character.sobriety');
  fns(skeleton, ['adultEntry', 'stopChoice', 'missingStops', 'placeholderIntimacy', 'fillIntimacy', 'missingIntimacy', 'intimacyIds', 'boundaries', 'intimacyFrame', 'intimacyScenes', 'intimacyCandidate', 'intimacyFor', 'intimacyMessages', 'intimacySchema', 'draftIntimacyProse']);
  assert.deepEqual(skeleton.BEATS, ['start', 'closer', 'check-in', 'deeper', 'last']);
  assert.deepEqual(skeleton.SLOTS, ['opening', 'says', 'go', 'goResult', 'slow', 'slowResult']);
  assert.equal(skeleton.CATEGORY, 'together');
  fns(firstsUi, ['firstProgress', 'firstOffers', 'firstTurn', 'firstEndCard']);
  fns(wardrobe, ['wornSetOf', 'wornImageOf', 'undressedOf']);
});
