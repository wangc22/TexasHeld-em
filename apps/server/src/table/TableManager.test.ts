import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TableManager } from './TableManager.js';
import type { GameEvent } from '../game/GameEngine.js';

function noopHandler(_tableId: string, _event: GameEvent): void {}

describe('TableManager', () => {
  let manager: TableManager;

  beforeEach(() => {
    manager = new TableManager(noopHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Table creation ───────────────────────────────────────────────────────────

  it('createTable returns a UUID-formatted string', () => {
    const id = manager.createTable('Test Table');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('createTable returns a different ID on each call', () => {
    const id1 = manager.createTable('Table 1');
    const id2 = manager.createTable('Table 2');
    expect(id1).not.toBe(id2);
  });

  // ─── getEngine ────────────────────────────────────────────────────────────────

  it('getEngine returns a GameEngine for a valid tableId', () => {
    const id = manager.createTable('My Table');
    const engine = manager.getEngine(id);
    expect(engine).not.toBeNull();
    expect(typeof engine!.getState).toBe('function');
  });

  it('getEngine returns null for an unknown tableId', () => {
    expect(manager.getEngine('nonexistent-id')).toBeNull();
  });

  // ─── destroyTable ─────────────────────────────────────────────────────────────

  it('destroyTable removes the table so getEngine returns null', () => {
    const id = manager.createTable('Temporary');
    manager.destroyTable(id);
    expect(manager.getEngine(id)).toBeNull();
  });

  // ─── listTables ───────────────────────────────────────────────────────────────

  it('listTables returns an array (may be empty when no human players)', () => {
    manager.createTable('Empty Table');
    const tables = manager.listTables();
    // No players joined, so humanPlayerCount === 0 → filtered out
    expect(Array.isArray(tables)).toBe(true);
  });

  // ─── isNameTaken ─────────────────────────────────────────────────────────────

  it('isNameTaken returns true for an existing table name (case-insensitive)', () => {
    manager.createTable('My Game');
    expect(manager.isNameTaken('my game')).toBe(true);
    expect(manager.isNameTaken('MY GAME')).toBe(true);
    expect(manager.isNameTaken('My Game')).toBe(true);
  });

  it('isNameTaken returns false for an unknown name', () => {
    manager.createTable('Table One');
    expect(manager.isNameTaken('Table Two')).toBe(false);
  });

  // ─── withLock ─────────────────────────────────────────────────────────────────

  it('withLock returns null for an unknown tableId', async () => {
    const result = await manager.withLock('no-such-table', () => 42);
    expect(result).toBeNull();
  });

  it('withLock serialises concurrent operations on the same table', async () => {
    const id = manager.createTable('Lock Test');
    const results: number[] = [];

    const op1 = manager.withLock(id, async () => {
      results.push(1);
      await new Promise<void>((r) => setTimeout(r, 20));
      results.push(2);
    });

    const op2 = manager.withLock(id, () => {
      results.push(3);
    });

    await Promise.all([op1, op2]);
    expect(results).toEqual([1, 2, 3]);
  });

  // ─── Host management ──────────────────────────────────────────────────────────

  it('setHostIfUnset assigns a host and isHost returns true', () => {
    const id = manager.createTable('Host Test');
    manager.setHostIfUnset(id, 'player-alice');
    expect(manager.isHost(id, 'player-alice')).toBe(true);
  });

  it('setHostIfUnset does not change the host once set', () => {
    const id = manager.createTable('Host Test 2');
    manager.setHostIfUnset(id, 'player-alice');
    manager.setHostIfUnset(id, 'player-bob');
    expect(manager.isHost(id, 'player-alice')).toBe(true);
    expect(manager.isHost(id, 'player-bob')).toBe(false);
  });

  // ─── Socket tracking ──────────────────────────────────────────────────────────

  it('registerSocket and getPlayerIdForSocket and unregisterSocket round-trip', () => {
    const id = manager.createTable('Socket Test');
    manager.registerSocket(id, 'socket-abc', 'player-xyz');

    expect(manager.getPlayerIdForSocket(id, 'socket-abc')).toBe('player-xyz');

    manager.unregisterSocket(id, 'socket-abc');
    expect(manager.getPlayerIdForSocket(id, 'socket-abc')).toBeNull();
  });

  it('registerSocket evicts the old socket when the same player reconnects', () => {
    const id = manager.createTable('Reconnect Test');
    manager.registerSocket(id, 'socket-old', 'player-xyz');
    manager.registerSocket(id, 'socket-new', 'player-xyz');

    expect(manager.getPlayerIdForSocket(id, 'socket-old')).toBeNull();
    expect(manager.getPlayerIdForSocket(id, 'socket-new')).toBe('player-xyz');
  });
});
