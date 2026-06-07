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

test('runLatexmkBuild emits granular progress from latexmk output', async () => {
  const events: string[] = [];
  const stdout = [
    "Latexmk: applying rule 'xelatex'...",
    "Run number 1 of rule 'xelatex'",
    "Running 'biber main'",
    "Running 'xdvipdfmx -o main.pdf main.xdv'"
  ].join('\n');

  await runLatexmkBuild('/tmp/marktex-build', 'latexmk', {
    spawn: fakeSpawn(0, '', stdout),
    onProgress: (event) => events.push(`${event.stage}:${event.label}`)
  });

  assert.ok(events.some((event) => event.includes('xelatex:XeLaTeX 第 1 轮')));
  assert.ok(events.some((event) => event.includes('biber:处理参考文献')));
  assert.ok(events.some((event) => event.includes('pdf:生成 PDF')));
  assert.ok(events.some((event) => event.includes('success:PDF 编译完成')));
});

test('runLatexmkBuild terminates the latexmk process group on timeout', async () => {
  const originalKill = process.kill;
  let killedPid = 0;
  (process as unknown as { kill: typeof process.kill }).kill = ((pid: number, signal?: NodeJS.Signals) => {
    killedPid = pid;
    assert.equal(signal, 'SIGTERM');
    return true;
  }) as typeof process.kill;

  try {
    const result = await runLatexmkBuild('/tmp/marktex-build', 'latexmk', {
      timeoutMs: 1,
      spawn: hangingSpawn(12345)
    });

    assert.equal(result.ok, false);
    assert.equal(result.exitCode, null);
    assert.equal(killedPid, -12345);
    assert.match(result.error ?? '', /timed out/);
  } finally {
    (process as unknown as { kill: typeof process.kill }).kill = originalKill;
  }
});

function fakeSpawn(code: number, stderr = '', stdout = '') {
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
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code);
    }, 0);
    return child;
  };
}

function hangingSpawn(pid: number) {
  return () => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    child.pid = pid;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    return child;
  };
}
