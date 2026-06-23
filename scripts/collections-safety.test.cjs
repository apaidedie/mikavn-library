const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('collection deletion confirmation explains real game files are untouched', () => {
  const source = fs.readFileSync('src/pages/Collections/CollectionsPage.tsx', 'utf8');

  assert.match(source, /removeCollection/);
  assert.match(source, /删除合集「\$\{collection\.name\}」/);
  assert.match(source, /只删除合集关系/);
  assert.match(source, /不会删除游戏记录/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /api\.deleteCollection\(collection\.id\)/);
});

test('removing a game from a collection confirms only the collection link is removed', () => {
  const source = fs.readFileSync('src/pages/Collections/CollectionsPage.tsx', 'utf8');

  assert.match(source, /const removeGame = async \(game: Game\)/);
  assert.match(source, /从合集「\$\{selected\.name\}」移除「\$\{game\.title\}」/);
  assert.match(source, /只会移除合集关系/);
  assert.match(source, /不会删除游戏记录/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /api\.removeGameFromCollection\(selected\.id, game\.id\)/);
});

test('game detail collections panel avoids per-collection membership queries', () => {
  const panel = fs.readFileSync('src/pages/Library/GameCollectionsPanel.tsx', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/collections.rs', 'utf8');
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const repository = fs.readFileSync('src-tauri/src/repositories/collections.rs', 'utf8');

  assert.match(panel, /api\.listGameCollections\(game\.id\)/);
  assert.doesNotMatch(panel, /api\.listCollectionGames/);
  assert.doesNotMatch(panel, /Promise\.all\(nextCollections\.map/);
  assert.match(api, /listGameCollections\(gameId: string\)/);
  assert.match(api, /command<GameCollection\[\]>\('list_game_collections'/);
  assert.match(commands, /pub fn list_game_collections/);
  assert.match(lib, /commands::collections::list_game_collections/);
  assert.match(repository, /pub fn list_game_collections/);
  assert.match(repository, /INNER JOIN collection_games cg ON cg\.collection_id = c\.id/);
  assert.match(repository, /WHERE cg\.game_id = \?1/);
});
