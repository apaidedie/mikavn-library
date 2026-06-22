const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('archive import and restore confirmations repeat the real-install safety boundary', () => {
  const source = fs.readFileSync('src/pages/Settings/useSettingsLocalDataActions.ts', 'utf8');

  assert.match(source, /importArchive/);
  assert.match(source, /安全导入会先备份当前数据库/);
  assert.match(source, /只合并不冲突的新记录/);
  assert.match(source, /不会覆盖或删除现有游戏记录/);
  assert.match(source, /不会触碰真实游戏安装目录/);
  assert.match(source, /api\.importLibraryArchive/);

  assert.match(source, /restoreArchive/);
  assert.match(source, /完整恢复会在下次启动前用归档数据库替换当前数据库/);
  assert.match(source, /图片\/存档缓存会按当前勾选项镜像恢复/);
  assert.match(source, /应用会先创建保护备份/);
  assert.match(source, /不会触碰真实游戏安装目录/);
  assert.match(source, /api\.restoreLibraryArchive/);
});

test('archive import uses lightweight conflict rows instead of loading full games', () => {
  const source = fs.readFileSync('src-tauri/src/services/archives.rs', 'utf8');
  const gamesDb = fs.readFileSync('src-tauri/src/db/games_ext.rs', 'utf8');

  assert.doesNotMatch(source, /db\.list_games\(GameFilter::default\(\)\)/);
  assert.match(source, /ArchiveImportConflictRow/);
  assert.match(source, /list_archive_import_conflict_rows/);
  assert.match(gamesDb, /pub fn list_archive_import_conflict_rows/);
  assert.match(gamesDb, /SELECT id, title, install_path FROM games/);
});
