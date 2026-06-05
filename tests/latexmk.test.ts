import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { runLatexmkBuild } from '../src/obsidian/latexmk.ts';

test('runLatexmkBuild returns PDF and log paths on success', async () => {
  const result = await runLatexmkBuild('/tmp/marktex-build', 'latexmk', {
    spawn: fakeSpawn(0)
  });

  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.pdfFile, /main\.pdf$/);
  assert.match(result.logFile, /main\.log$/);
});

test('runLatexmkBuild reports latexmk failures', async () => {
  const result = await runLatexmkBuild('/tmp/marktex-build', 'latexmk', {
    spawn: fakeSpawn(12, 'badness')
  });

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 12);
  assert.match(result.stderr, /badness/);
});

function fakeSpawn(code: number, stderr = '') {
  return () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setTimeout(() => {
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code);
    }, 0);
    return child;
  };
}
