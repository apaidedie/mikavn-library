const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assertImagesLoaded } = require('./image-render-assertions.cjs');

function fakeImage({ alt = '', src = 'mock://image.png', complete = true, naturalWidth = 80, naturalHeight = 120 } = {}) {
  return {
    alt,
    complete,
    currentSrc: src,
    naturalHeight,
    naturalWidth,
    src,
    getAttribute(name) {
      return name === 'src' ? src : null;
    },
  };
}

function fakeLocator(images) {
  return {
    async count() {
      return images.length;
    },
    async evaluateAll(callback) {
      return callback(images);
    },
  };
}

test('assertImagesLoaded reports img nodes that did not decode', async () => {
  const locator = fakeLocator([
    fakeImage({ alt: '正常封面', src: '/ok.png' }),
    fakeImage({ alt: '坏封面', src: '/broken.png', complete: true, naturalWidth: 0, naturalHeight: 0 }),
  ]);

  await assert.rejects(
    () => assertImagesLoaded(locator, 'library artwork'),
    /library artwork image failed to load: 坏封面 <\/broken\.png> \(complete=true, size=0x0\)/,
  );
});

test('assertImagesLoaded requires at least one image by default', async () => {
  await assert.rejects(
    () => assertImagesLoaded(fakeLocator([]), 'library artwork'),
    /library artwork did not render any img nodes/,
  );
});

test('assertImagesLoaded accepts decoded images', async () => {
  await assert.doesNotReject(() => assertImagesLoaded(fakeLocator([fakeImage({ alt: '封面' })]), 'library artwork'));
});

test('page QA runner verifies decoded description artwork instead of only counting img nodes', () => {
  const source = fs.readFileSync(path.join(__dirname, 'page-qa-runner.cjs'), 'utf8');
  const librarySource = fs.readFileSync(path.join(__dirname, 'page-qa-library-cases.cjs'), 'utf8');

  assert.match(source, /assertImagesLoaded/);
  assert.match(librarySource, /assertImagesLoaded/);
  assert.match(librarySource, /library detail description image/);
  assert.match(source, /description repair result detail image/);
});
