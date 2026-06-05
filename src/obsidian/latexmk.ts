import { spawn as nodeSpawn } from 'node:child_process';
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
    const child = spawn(latexmkPath, args, { cwd: buildDir, env });
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill?.('SIGTERM');
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
