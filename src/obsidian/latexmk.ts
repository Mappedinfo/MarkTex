import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface LatexmkBuildResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  pdfFile: string;
  logFile: string;
  error?: string;
}

export type LatexmkProgressStage =
  | 'preparing'
  | 'xelatex'
  | 'biber'
  | 'pdf'
  | 'finalizing'
  | 'success'
  | 'error'
  | 'timeout';

export interface LatexmkProgressEvent {
  stage: LatexmkProgressStage;
  percent: number;
  label: string;
  detail: string;
  logLine?: string;
  run?: number;
}

export interface LatexmkRunnerOptions {
  timeoutMs?: number;
  spawn?: typeof defaultSpawn;
  onProgress?: (event: LatexmkProgressEvent) => void;
}

export function detectLatexmkPath(configuredPath?: string): string {
  if (configuredPath && existsSync(configuredPath)) return configuredPath;
  if (existsSync('/Library/TeX/texbin/latexmk')) return '/Library/TeX/texbin/latexmk';
  return 'latexmk';
}

export function detectFandolFontPath(configuredLatexmkPath?: string): string | null {
  const latexmkPath = detectLatexmkPath(configuredLatexmkPath);
  const candidates = uniqueStrings([
    path.isAbsolute(latexmkPath) ? path.join(path.dirname(latexmkPath), 'kpsewhich') : '',
    '/Library/TeX/texbin/kpsewhich',
    'kpsewhich'
  ]);

  for (const candidate of candidates) {
    try {
      if (path.isAbsolute(candidate) && !existsSync(candidate)) continue;
      const output = execFileSync(candidate, ['FandolSong-Regular.otf'], {
        encoding: 'utf8',
        env: { ...process.env, PATH: addTexPath(process.env.PATH || '') },
        timeout: 5000
      }).trim();
      if (output && existsSync(output)) return path.dirname(output);
    } catch {
      continue;
    }
  }
  return null;
}

export async function runLatexmkBuild(
  buildDir: string,
  latexmkPath: string,
  options: LatexmkRunnerOptions = {}
): Promise<LatexmkBuildResult> {
  const spawn = options.spawn ?? defaultSpawn;
  const args = ['-xelatex', '-interaction=nonstopmode', '-file-line-error', '-synctex=1', 'main.tex'];
  const env = {
    ...process.env,
    PATH: addTexPath(process.env.PATH || '')
  };
  const emitProgress = createLatexmkProgressEmitter(options.onProgress);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    emitProgress({
      stage: 'preparing',
      percent: 5,
      label: '准备编译',
      detail: '正在启动 latexmk。'
    });
    const child = spawn(latexmkPath, args, { cwd: buildDir, env, detached: true });
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      emitProgress({
        stage: 'timeout',
        percent: 100,
        label: '编译超时',
        detail: `latexmk 超过 ${options.timeoutMs ?? 60000}ms 未结束，已停止。`
      });
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        pdfFile: path.join(buildDir, 'main.pdf'),
        logFile: path.join(buildDir, 'main.log'),
        error: `latexmk timed out after ${options.timeoutMs ?? 60000}ms`
      });
    }, options.timeoutMs ?? 60000);

    child.stdout?.on?.('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      emitProgress.fromChunk(text);
    });
    child.stderr?.on?.('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      emitProgress.fromChunk(text);
    });
    child.on?.('error', (error: Error) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      emitProgress({
        stage: 'error',
        percent: 100,
        label: '编译启动失败',
        detail: error.message
      });
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        pdfFile: path.join(buildDir, 'main.pdf'),
        logFile: path.join(buildDir, 'main.log'),
        error: error.message
      });
    });
    child.on?.('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      emitProgress.flush();
      emitProgress(
        code === 0
          ? {
              stage: 'success',
              percent: 100,
              label: 'PDF 编译完成',
              detail: 'latexmk 已完成所有编译步骤。'
            }
          : {
              stage: 'error',
              percent: 100,
              label: 'PDF 编译失败',
              detail: `latexmk exited with code ${code}`
            }
      );
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
        pdfFile: path.join(buildDir, 'main.pdf'),
        logFile: path.join(buildDir, 'main.log'),
        error: code === 0 ? undefined : `latexmk exited with code ${code}`
      });
    });
  });
}

function createLatexmkProgressEmitter(onProgress?: (event: LatexmkProgressEvent) => void) {
  let buffer = '';
  let lastSignature = '';
  let current: LatexmkProgressEvent = {
    stage: 'preparing',
    percent: 5,
    label: '准备编译',
    detail: '正在启动 latexmk。'
  };

  const emit = (event: LatexmkProgressEvent): void => {
    const next = event.percent < current.percent && event.stage !== 'error' && event.stage !== 'timeout'
      ? { ...current, logLine: event.logLine }
      : event;
    current = next.logLine ? { ...next, logLine: undefined } : next;
    const normalized = {
      ...next,
      percent: Math.max(0, Math.min(100, Math.round(next.percent)))
    };
    const signature = `${normalized.stage}:${normalized.percent}:${normalized.label}:${normalized.detail}:${normalized.logLine || ''}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    onProgress?.(normalized);
  };

  const fromChunk = (chunk: string): void => {
    buffer += chunk.replace(/\r/g, '\n');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      emit(progressFromLatexmkLine(trimmed));
    }
  };

  const flush = (): void => {
    const trimmed = buffer.trim();
    if (trimmed) emit(progressFromLatexmkLine(trimmed));
    buffer = '';
  };

  return Object.assign(emit, { fromChunk, flush });
}

function progressFromLatexmkLine(line: string): LatexmkProgressEvent {
  const xelatexRun = line.match(/Run number (\d+) of rule 'xelatex'/i);
  if (xelatexRun) {
    const run = Number(xelatexRun[1]);
    return {
      stage: 'xelatex',
      percent: Math.min(68, 22 + (run - 1) * 18),
      label: `XeLaTeX 第 ${run} 轮`,
      detail: '正在把 LaTeX 源码排版为中间文件。',
      logLine: line,
      run
    };
  }

  const biberRun = line.match(/Run number (\d+) of rule 'biber'/i);
  if (biberRun) {
    const run = Number(biberRun[1]);
    return {
      stage: 'biber',
      percent: Math.min(78, 64 + (run - 1) * 6),
      label: `Biber 第 ${run} 轮`,
      detail: '正在处理 BibLaTeX/APA 参考文献。',
      logLine: line,
      run
    };
  }

  if (/Latexmk: This is Latexmk|No existing \.aux file|applying rule 'xelatex'/i.test(line)) {
    return {
      stage: 'preparing',
      percent: 12,
      label: '准备编译',
      detail: 'latexmk 正在分析需要运行的编译步骤。',
      logLine: line
    };
  }

  if (/Running 'xelatex|This is XeTeX|entering extended mode/i.test(line)) {
    return {
      stage: 'xelatex',
      percent: 28,
      label: '运行 XeLaTeX',
      detail: '正在排版正文、表格、数学公式和中文字体。',
      logLine: line
    };
  }

  if (/applying rule 'biber'|Running 'biber|INFO - This is Biber/i.test(line)) {
    return {
      stage: 'biber',
      percent: 66,
      label: '处理参考文献',
      detail: '正在生成 APA/BibLaTeX bibliography 数据。',
      logLine: line
    };
  }

  if (/xdvipdfmx|Rule 'xdvipdfmx'|Dvi conversion/i.test(line)) {
    return {
      stage: 'pdf',
      percent: 86,
      label: '生成 PDF',
      detail: '正在把 XeLaTeX 中间文件转换为 PDF。',
      logLine: line
    };
  }

  if (/Rerun to get|References changed|Log file says output to/i.test(line)) {
    return {
      stage: 'finalizing',
      percent: 92,
      label: '整理输出',
      detail: '正在检查交叉引用、目录和输出文件。',
      logLine: line
    };
  }

  if (/All targets .* are up-to-date|Latexmk: All targets/i.test(line)) {
    return {
      stage: 'success',
      percent: 98,
      label: '即将完成',
      detail: 'latexmk 已确认输出文件是最新的。',
      logLine: line
    };
  }

  if (/(^! | Error:|Package .* Error|LaTeX Error|Fatal error|Emergency stop)/i.test(line)) {
    return {
      stage: 'error',
      percent: 100,
      label: '发现 LaTeX 错误',
      detail: line,
      logLine: line
    };
  }

  return {
    stage: 'preparing',
    percent: 10,
    label: '读取编译日志',
    detail: line,
    logLine: line
  };
}

function addTexPath(pathValue: string): string {
  const texPath = '/Library/TeX/texbin';
  return pathValue.split(':').includes(texPath) ? pathValue : `${texPath}:${pathValue}`;
}

function defaultSpawn(command: string, args: string[], options: Record<string, unknown>) {
  return nodeSpawn(command, args, options);
}

function terminateProcessTree(child: { pid?: number; kill?: (signal?: NodeJS.Signals) => boolean }): void {
  if (typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, 'SIGTERM');
      return;
    } catch {
      // Fall through to killing the direct process when process-group signaling is unavailable.
    }
  }
  child.kill?.('SIGTERM');
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
