const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_CHUNK_BYTES = 500 * 1024;

function listJavaScriptChunks(dir) {
  const chunks = [];
  if (!fs.existsSync(dir)) return chunks;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chunks.push(...listJavaScriptChunks(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      chunks.push({
        fileName: path.relative(dir, entryPath),
        fullPath: entryPath,
        sizeBytes: fs.statSync(entryPath).size,
      });
    }
  }

  return chunks;
}

function checkBuildChunks(options = {}) {
  const distDir = options.distDir || path.resolve(__dirname, '..', '..', 'dist');
  const maxChunkBytes = options.maxChunkBytes || Number(process.env.MIKAVN_MAX_JS_CHUNK_BYTES) || DEFAULT_MAX_CHUNK_BYTES;
  const checkedChunks = listJavaScriptChunks(distDir).sort((a, b) => b.sizeBytes - a.sizeBytes);
  if (checkedChunks.length === 0) {
    throw new Error(`no JavaScript chunks found under ${distDir}`);
  }

  const oversizedChunks = checkedChunks.filter((chunk) => chunk.sizeBytes > maxChunkBytes);
  if (oversizedChunks.length > 0) {
    const summary = oversizedChunks
      .map((chunk) => `${chunk.fileName} ${chunk.sizeBytes} bytes > ${maxChunkBytes} bytes`)
      .join(', ');
    throw new Error(`oversized JavaScript chunks: ${summary}`);
  }

  return { checkedChunks, maxChunkBytes, oversizedChunks };
}

if (require.main === module) {
  try {
    const result = checkBuildChunks();
    const largest = result.checkedChunks[0];
    console.log(JSON.stringify({
      checkedChunks: result.checkedChunks.length,
      maxChunkBytes: result.maxChunkBytes,
      largestChunk: largest ? { fileName: largest.fileName, sizeBytes: largest.sizeBytes } : null,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { checkBuildChunks };
