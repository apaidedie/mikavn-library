async function assertImagesLoaded(locator, label, options = {}) {
  const minCount = options.minCount ?? 1;
  const count = await locator.count();
  if (count < minCount) {
    throw new Error(`${label} did not render any img nodes`);
  }

  const broken = await locator.evaluateAll((images) => images
    .map((image) => ({
      alt: image.alt || '',
      complete: Boolean(image.complete),
      height: Number(image.naturalHeight || 0),
      src: image.currentSrc || image.getAttribute('src') || image.src || '',
      width: Number(image.naturalWidth || 0),
    }))
    .filter((image) => !image.complete || image.width <= 0 || image.height <= 0));

  if (broken.length > 0) {
    const details = broken
      .slice(0, 5)
      .map((image) => `${image.alt || 'unlabelled'} <${image.src || 'missing-src'}> (complete=${image.complete}, size=${image.width}x${image.height})`)
      .join(' | ');
    throw new Error(`${label} image failed to load: ${details}`);
  }
}

module.exports = { assertImagesLoaded };
