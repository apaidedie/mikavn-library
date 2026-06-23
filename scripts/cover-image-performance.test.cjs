const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('CoverImage defaults to native lazy loading and async decoding', () => {
  const source = fs.readFileSync('src/components/ui/cover.tsx', 'utf8');

  assert.match(source, /loading = 'lazy'/);
  assert.match(source, /decoding = 'async'/);
  assert.match(source, /fetchPriority = 'auto'/);
  assert.match(source, /loading=\{loading\}/);
  assert.match(source, /decoding=\{decoding\}/);
  assert.match(source, /fetchPriority=\{fetchPriority\}/);
});

test('CoverImage falls back to the placeholder after image load failures', () => {
  const source = fs.readFileSync('src/components/ui/cover.tsx', 'utf8');

  assert.match(source, /useEffect/);
  assert.match(source, /useState/);
  assert.match(source, /failedSrc/);
  assert.match(source, /setFailedSrc\(null\)/);
  assert.match(source, /onError=\{\(\) => setFailedSrc\(resolved\)\}/);
  assert.match(source, /resolved && failedSrc !== resolved/);
});

test('library detail hero decodes images asynchronously', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailHero.tsx', 'utf8');

  assert.match(source, /decoding="async"/);
  assert.match(source, /loading="eager"/);
  assert.match(source, /fetchPriority="high"/);
});

test('library detail hero hides failed background images and retries when the image changes', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailHero.tsx', 'utf8');

  assert.match(source, /failedHeroImage/);
  assert.match(source, /setFailedHeroImage\(null\)/);
  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /\}, \[heroImage\]\)/);
  assert.match(source, /heroImage && failedHeroImage !== heroImage/);
  assert.match(source, /onError=\{\(\) => setFailedHeroImage\(heroImage\)\}/);
});

test('library navigation thumbnails use low fetch priority', () => {
  const source = fs.readFileSync('src/pages/Library/LibraryGameNav.tsx', 'utf8');

  assert.match(source, /fetchPriority="low"/);
  assert.match(source, /<CoverImage[^>]+className="h-\[18px\]/);
  assert.match(source, /<CoverImage[^>]+className="aspect-\[2\/3\]"/);
});

test('library description images lazy load and decode asynchronously', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailMedia.tsx', 'utf8');

  assert.match(source, /loading="lazy"/);
  assert.match(source, /decoding="async"/);
});

test('library description images render in an initial batch with opt-in expansion', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailMedia.tsx', 'utf8');
  const model = fs.readFileSync('src/pages/Library/gameDetailMediaModel.ts', 'utf8');

  assert.match(model, /descriptionImageInitialRenderLimit = 12/);
  assert.match(model, /getVisibleDescriptionParts/);
  assert.match(source, /expandedDescriptionImages/);
  assert.match(source, /setExpandedDescriptionImages/);
  assert.match(source, /getVisibleDescriptionParts\(parts, expandedDescriptionImages \? Number\.POSITIVE_INFINITY : descriptionImageInitialRenderLimit\)/);
  assert.match(source, /hiddenImageCount/);
  assert.match(source, /显示全部简介图片/);
  assert.match(source, /收起简介图片/);
});

test('asset gallery limits per-type render count while keeping primary assets visible', () => {
  const source = fs.readFileSync('src/pages/Library/AssetGallery.tsx', 'utf8');

  assert.match(source, /const assetGalleryTypeRenderLimit = 12/);
  assert.match(source, /visibleAssetGroup\(grouped\[type\], assetGalleryTypeRenderLimit\)/);
  assert.match(source, /asset\.isPrimary/);
  assert.match(source, /grouped\[type\]\.length - visibleAssets\.length/);
  assert.match(source, /还有 \$\{formatAssetCount\(hiddenCount\)\} 张未渲染/);
});

test('asset gallery lets users opt in to rendering all assets for a type', () => {
  const source = fs.readFileSync('src/pages/Library/AssetGallery.tsx', 'utf8');

  assert.match(source, /expandedAssetTypes/);
  assert.match(source, /setExpandedAssetTypes/);
  assert.match(source, /expandedAssetTypes\.has\(type\)/);
  assert.match(source, /visibleAssets = expanded \? grouped\[type\] : visibleAssetGroup\(grouped\[type\], assetGalleryTypeRenderLimit\)/);
  assert.match(source, /显示全部/);
  assert.match(source, /收起/);
});
