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

export interface LatexmkRunnerOptions {
  timeoutMs?: number;
  spawn?: typeof defaultSpawn;
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

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(latexmkPath, args, { cwd: buildDir, env, detached: true });
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
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
      stdout += chunk.toString();
    });
    child.stderr?.on?.('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on?.('error', (error: Error) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
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
