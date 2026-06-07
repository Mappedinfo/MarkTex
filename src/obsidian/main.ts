import {
  App,
  ItemView,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  normalizePath
} from 'obsidian';
import { generateLatexDocument, type MarkTexDiagnostic } from '../headless/marktexDocument';
import type { AppConfig } from '../types';
import {
  detectFandolFontPath,
  detectLatexmkPath,
  runLatexmkBuild,
  type LatexmkBuildResult,
  type LatexmkProgressEvent
} from './latexmk';

declare const require: (id: string) => any;

const MARKTEX_VIEW_TYPE = 'marktex-workbench';

interface MarkTexPluginSettings {
  latexmkPath: string;
  compileOnSave: boolean;
  buildRoot: string;
  bibStrategy: 'same-note-bib-first';
  documentClass: AppConfig['document']['documentClass'];
  fontSize: AppConfig['document']['fontSize'];
  pageSize: AppConfig['document']['pageSize'];
  enableChinese: boolean;
  enableTOC: boolean;
  tableStyle: AppConfig['table']['tableStyle'];
  autoWrapThreshold: number;
}

interface WorkbenchState {
  file: TFile | null;
  tex: string;
  diagnostics: MarkTexDiagnostic[];
  buildVaultDir: string;
  pdfVaultPath: string | null;
  logVaultPath: string | null;
  logExcerpt: string;
  status: string;
  compiling: boolean;
  compileProgress: LatexmkProgressEvent | null;
  recentLogLines: string[];
  lastBuild?: LatexmkBuildResult;
}

const DEFAULT_SETTINGS: MarkTexPluginSettings = {
  latexmkPath: '',
  compileOnSave: true,
  buildRoot: '.obsidian/marktex-cache',
  bibStrategy: 'same-note-bib-first',
  documentClass: 'article',
  fontSize: '11pt',
  pageSize: 'a4paper',
  enableChinese: true,
  enableTOC: false,
  tableStyle: 'booktabs',
  autoWrapThreshold: 20
};

export default class MarkTexObsidianPlugin extends Plugin {
  settings: MarkTexPluginSettings = DEFAULT_SETTINGS;
  private compileTimers = new Map<string, number>();
  private previewTimer: number | null = null;
  private state: WorkbenchState = emptyState();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new MarkTexSettingTab(this.app, this));
    this.registerView(MARKTEX_VIEW_TYPE, (leaf) => new MarkTexWorkbenchView(leaf, this));

    this.addCommand({
      id: 'open-marktex-workbench',
      name: 'Open MarkTex Workbench',
      callback: () => this.openWorkbench()
    });
    this.addCommand({
      id: 'compile-current-note-with-marktex',
      name: 'Compile Current Note with MarkTex',
      callback: () => this.compileCurrentNote()
    });
    this.addCommand({
      id: 'copy-generated-latex',
      name: 'Copy Generated LaTeX',
      callback: () => this.copyGeneratedLatex()
    });
    this.addCommand({
      id: 'reveal-marktex-build-folder',
      name: 'Reveal MarkTex Build Folder',
      callback: () => this.revealBuildFolder()
    });
    this.addCommand({
      id: 'open-current-marktex-pdf',
      name: 'Open Current MarkTex PDF',
      callback: () => this.openGeneratedPdf()
    });

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.schedulePreviewRefresh()));
    this.registerEvent(
      this.app.workspace.on('editor-change', (_editor, info) => {
        if (info.file instanceof TFile && info.file.path === this.app.workspace.getActiveFile()?.path) {
          this.schedulePreviewRefresh();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        if (file.path !== this.app.workspace.getActiveFile()?.path) return;
        this.schedulePreviewRefresh();
        if (this.settings.compileOnSave) this.scheduleCompile(file);
      })
    );
  }

  onunload(): void {
    for (const timer of this.compileTimers.values()) window.clearTimeout(timer);
    this.compileTimers.clear();
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openWorkbench(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(MARKTEX_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: MARKTEX_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    this.schedulePreviewRefresh();
  }

  async compileCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      new Notice('当前没有打开 Markdown 文件。');
      return;
    }
    await this.compileFile(file, true);
  }

  async copyGeneratedLatex(): Promise<void> {
    await this.refreshPreviewState();
    if (!this.state.tex) {
      new Notice('当前没有可复制的 LaTeX。');
      return;
    }
    await writeClipboardText(this.state.tex);
    new Notice('已复制生成的 LaTeX。');
  }

  async revealBuildFolder(): Promise<void> {
    if (!this.state.buildVaultDir) await this.refreshPreviewState();
    const absolute = vaultPathToAbsolute(this.app, this.state.buildVaultDir);
    const shell = getElectronShell();
    if (shell && absolute) {
      await shell.openPath(absolute);
      return;
    }
    new Notice(this.state.buildVaultDir || '还没有 MarkTex build folder。');
  }

  async openGeneratedPdf(): Promise<void> {
    if (!this.state.pdfVaultPath) {
      new Notice('还没有可打开的 MarkTex PDF。');
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(this.state.pdfVaultPath);
    if (!(file instanceof TFile)) {
      new Notice(`找不到 MarkTex PDF：${this.state.pdfVaultPath}`);
      return;
    }
    await this.app.workspace.getLeaf('tab').openFile(file);
  }

  getState(): WorkbenchState {
    return this.state;
  }

  async refreshPreviewState(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      this.state = emptyState();
      this.state.status = '当前没有打开 Markdown 文件。';
      await this.refreshViews();
      return;
    }

    const markdown = getActiveMarkdownText(this.app, file) ?? (await this.app.vault.cachedRead(file));
    const buildVaultDir = this.buildVaultDirForFile(file);
    const bibliography = await resolveMarkTexBibliography(file.path, this.app);
    const prepared = await prepareMarkdownAssets(markdown, file, this.app, buildVaultDir);
    const result = generateLatexDocument(prepared.markdown, {
      config: this.markTexConfig(),
      bibliographyFiles: bibliography ? ['references.bib'] : [],
      enableBiblatexApa: true,
      cjkFontPath: this.settings.enableChinese ? detectFandolFontPath(this.settings.latexmkPath) : null
    });

    this.state = {
      ...this.state,
      file,
      tex: result.tex,
      diagnostics: [
        ...result.diagnostics,
        ...prepared.diagnostics,
        ...(bibliography ? [] : bibliographyMissingDiagnostics(result.citekeys))
      ],
      buildVaultDir,
      pdfVaultPath: this.state.file?.path === file.path ? this.state.pdfVaultPath : null,
      logVaultPath: this.state.file?.path === file.path ? this.state.logVaultPath : null,
      logExcerpt: this.state.file?.path === file.path ? this.state.logExcerpt : '',
      compileProgress: this.state.file?.path === file.path ? this.state.compileProgress : null,
      recentLogLines: this.state.file?.path === file.path ? this.state.recentLogLines : [],
      status: `LaTeX 已更新：${file.path}`,
      compiling: this.state.file?.path === file.path ? this.state.compiling : false
    };
    await this.refreshViews();
  }

  private schedulePreviewRefresh(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      void this.refreshPreviewState();
    }, 250);
  }

  private scheduleCompile(file: TFile): void {
    const previous = this.compileTimers.get(file.path);
    if (previous !== undefined) window.clearTimeout(previous);
    const timer = window.setTimeout(() => {
      this.compileTimers.delete(file.path);
      void this.compileFile(file, false);
    }, 800);
    this.compileTimers.set(file.path, timer);
  }

  private async compileFile(file: TFile, notify: boolean): Promise<void> {
    this.state = {
      ...this.state,
      file,
      compiling: true,
      status: '正在准备 PDF 编译...',
      compileProgress: {
        stage: 'preparing',
        percent: 3,
        label: '准备编译',
        detail: '正在生成 main.tex 和复制依赖文件。'
      },
      recentLogLines: [],
      logExcerpt: ''
    };
    await this.refreshViews();

    try {
      const build = await this.prepareBuild(file);
      const latexmkPath = detectLatexmkPath(this.settings.latexmkPath);
      const result = await runLatexmkBuild(build.absoluteDir, latexmkPath, {
        onProgress: (event) => this.updateCompileProgress(file, event)
      });
      const logVaultPath = normalizePath(`${build.vaultDir}/main.log`);
      const logExcerpt = result.ok ? '' : await readLogExcerpt(this.app, logVaultPath);
      const finalProgress: LatexmkProgressEvent = result.ok
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
            detail: result.error || 'latexmk failed'
          };
      this.state = {
        ...this.state,
        file,
        compiling: false,
        buildVaultDir: build.vaultDir,
        pdfVaultPath: result.ok ? normalizePath(`${build.vaultDir}/main.pdf`) : null,
        logVaultPath,
        logExcerpt,
        status: finalProgress.label,
        compileProgress: finalProgress,
        lastBuild: result
      };
      if (notify) new Notice(this.state.status);
    } catch (error) {
      const logExcerpt = this.state.logVaultPath ? await readLogExcerpt(this.app, this.state.logVaultPath) : '';
      const finalProgress: LatexmkProgressEvent = {
        stage: 'error',
        percent: 100,
        label: 'PDF 编译失败',
        detail: error instanceof Error ? error.message : String(error)
      };
      this.state = {
        ...this.state,
        file,
        compiling: false,
        logExcerpt,
        status: finalProgress.label,
        compileProgress: finalProgress
      };
      if (notify) new Notice(this.state.status);
    }
    await this.refreshViews();
  }

  private updateCompileProgress(file: TFile, progress: LatexmkProgressEvent): void {
    const recentLogLines = progress.logLine
      ? [...this.state.recentLogLines, progress.logLine].slice(-12)
      : this.state.recentLogLines;
    this.state = {
      ...this.state,
      file,
      compiling: true,
      status: `${progress.label}：${progress.detail}`,
      compileProgress: progress,
      recentLogLines
    };
    void this.refreshViews();
  }

  private async prepareBuild(file: TFile): Promise<{ vaultDir: string; absoluteDir: string }> {
    const markdown = getActiveMarkdownText(this.app, file) ?? (await this.app.vault.cachedRead(file));
    const vaultDir = this.buildVaultDirForFile(file);
    await ensureAdapterFolder(this.app, vaultDir);
    const bibliography = await resolveMarkTexBibliography(file.path, this.app);
    const prepared = await prepareMarkdownAssets(markdown, file, this.app, vaultDir);
    const result = generateLatexDocument(prepared.markdown, {
      config: this.markTexConfig(),
      bibliographyFiles: bibliography ? ['references.bib'] : [],
      enableBiblatexApa: true,
      cjkFontPath: this.settings.enableChinese ? detectFandolFontPath(this.settings.latexmkPath) : null
    });
    await this.app.vault.adapter.write(normalizePath(`${vaultDir}/main.tex`), result.tex);
    if (bibliography) {
      await this.app.vault.adapter.write(normalizePath(`${vaultDir}/references.bib`), bibliography.content);
    }
    this.state = {
      ...this.state,
      file,
      tex: result.tex,
      diagnostics: [
        ...result.diagnostics,
        ...prepared.diagnostics,
        ...(bibliography ? [] : bibliographyMissingDiagnostics(result.citekeys))
      ],
      buildVaultDir: vaultDir,
      logExcerpt: '',
      recentLogLines: []
    };
    const absoluteDir = vaultPathToAbsolute(this.app, vaultDir);
    if (!absoluteDir) throw new Error('当前 vault adapter 不支持本机路径，无法运行 latexmk。');
    return { vaultDir, absoluteDir };
  }

  private buildVaultDirForFile(file: TFile): string {
    return normalizePath(`${this.settings.buildRoot}/${hashPath(file.path)}`);
  }

  private markTexConfig(): AppConfig {
    return {
      document: {
        documentClass: this.settings.documentClass,
        fontSize: this.settings.fontSize,
        pageSize: this.settings.pageSize,
        enableChinese: this.settings.enableChinese,
        enableTOC: this.settings.enableTOC
      },
      table: {
        tableStyle: this.settings.tableStyle,
        autoWrapThreshold: this.settings.autoWrapThreshold
      }
    };
  }

  private async refreshViews(): Promise<void> {
    await Promise.all(
      this.app.workspace.getLeavesOfType(MARKTEX_VIEW_TYPE).map(async (leaf) => {
        if (leaf.view instanceof MarkTexWorkbenchView) await leaf.view.render();
      })
    );
  }
}

class MarkTexWorkbenchView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly plugin: MarkTexObsidianPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return MARKTEX_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'MarkTex Workbench';
  }

  getIcon(): string {
    return 'file-text';
  }

  async onOpen(): Promise<void> {
    await this.plugin.refreshPreviewState();
  }

  async render(): Promise<void> {
    const state = this.plugin.getState();
    this.contentEl.empty();
    this.contentEl.addClass('marktex-workbench');

    const header = this.contentEl.createEl('div', { cls: 'marktex-workbench-header' });
    header.createEl('h3', { text: 'MarkTex Workbench' });
    const actions = header.createEl('div', { cls: 'marktex-workbench-actions' });
    this.addButton(actions, 'Compile', () => this.plugin.compileCurrentNote());
    this.addButton(actions, 'Copy LaTeX', () => this.plugin.copyGeneratedLatex());
    this.addButton(actions, 'Reveal Build', () => this.plugin.revealBuildFolder());

    this.contentEl.createEl('p', {
      cls: state.compiling ? 'marktex-status is-running' : 'marktex-status',
      text: state.status || 'Ready.'
    });

    if (state.compileProgress) {
      this.renderCompileProgress(state);
    }

    if (state.diagnostics.length > 0) {
      const diagnostics = this.contentEl.createEl('div', { cls: 'marktex-diagnostics' });
      for (const diagnostic of state.diagnostics) {
        diagnostics.createEl('div', {
          cls: `marktex-diagnostic is-${diagnostic.level}`,
          text: `${diagnostic.code}: ${diagnostic.message}`
        });
      }
    }

    const panes = this.contentEl.createEl('div', { cls: 'marktex-preview-panes' });
    const sourcePane = panes.createEl('section', { cls: 'marktex-pane marktex-source-pane' });
    sourcePane.createEl('h4', { text: 'LaTeX' });
    const source = sourcePane.createEl('textarea', { cls: 'marktex-latex-source' });
    source.readOnly = true;
    source.value = state.tex || '';

    const pdfPane = panes.createEl('section', { cls: 'marktex-pane marktex-pdf-pane' });
    pdfPane.createEl('h4', { text: 'PDF' });
    if (state.pdfVaultPath) {
      const ready = pdfPane.createEl('div', { cls: 'marktex-pdf-ready' });
      ready.createEl('p', { text: `PDF 已生成：${state.pdfVaultPath}` });
      const actions = ready.createEl('div', { cls: 'marktex-pdf-actions' });
      this.addButton(actions, 'Open PDF', () => this.plugin.openGeneratedPdf());
      this.addButton(actions, 'Reveal Build', () => this.plugin.revealBuildFolder());
    } else if (state.logExcerpt) {
      pdfPane.createEl('p', { cls: 'marktex-empty-pdf', text: `PDF 编译失败。Log: ${state.logVaultPath || 'main.log'}` });
      pdfPane.createEl('pre', { cls: 'marktex-log-excerpt', text: state.logExcerpt });
    } else if (state.logVaultPath) {
      pdfPane.createEl('p', { cls: 'marktex-empty-pdf', text: `暂无 PDF。Log: ${state.logVaultPath}` });
    } else {
      pdfPane.createEl('p', { cls: 'marktex-empty-pdf', text: '保存或点击 Compile 后显示 PDF。' });
    }
  }

  private renderCompileProgress(state: WorkbenchState): void {
    const progress = state.compileProgress;
    if (!progress) return;

    const container = this.contentEl.createEl('div', {
      cls: `marktex-compile-progress is-${progress.stage}`
    });
    const header = container.createEl('div', { cls: 'marktex-progress-header' });
    header.createEl('span', { cls: 'marktex-progress-label', text: progress.label });
    header.createEl('span', { cls: 'marktex-progress-percent', text: `${progress.percent}%` });

    const track = container.createEl('div', { cls: 'marktex-progress-track' });
    const fill = track.createEl('div', { cls: 'marktex-progress-fill' });
    fill.setCssProps({ '--marktex-progress-width': `${progress.percent}%` });

    container.createEl('p', { cls: 'marktex-progress-detail', text: progress.detail });
    if (state.recentLogLines.length > 0) {
      container.createEl('pre', {
        cls: 'marktex-progress-log',
        text: state.recentLogLines.join('\n')
      });
    }
  }

  private addButton(container: HTMLElement, label: string, onClick: () => Promise<void>): void {
    const button = container.createEl('button', { text: label });
    button.type = 'button';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void onClick();
    });
  }
}

class MarkTexSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: MarkTexObsidianPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('latexmk path')
      .setDesc('留空时自动探测 /Library/TeX/texbin/latexmk 或 PATH 中的 latexmk。')
      .addText((text) =>
        text.setValue(this.plugin.settings.latexmkPath).onChange(async (value) => {
          this.plugin.settings.latexmkPath = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Compile on save')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.compileOnSave).onChange(async (value) => {
          this.plugin.settings.compileOnSave = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Build root')
      .addText((text) =>
        text.setValue(this.plugin.settings.buildRoot).onChange(async (value) => {
          this.plugin.settings.buildRoot = normalizePath(value.trim() || DEFAULT_SETTINGS.buildRoot);
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Document class')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('article', 'article')
          .addOption('report', 'report')
          .addOption('book', 'book')
          .setValue(this.plugin.settings.documentClass)
          .onChange(async (value) => {
            this.plugin.settings.documentClass = value as MarkTexPluginSettings['documentClass'];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Font size')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('10pt', '10pt')
          .addOption('11pt', '11pt')
          .addOption('12pt', '12pt')
          .setValue(this.plugin.settings.fontSize)
          .onChange(async (value) => {
            this.plugin.settings.fontSize = value as MarkTexPluginSettings['fontSize'];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable Chinese')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableChinese).onChange(async (value) => {
          this.plugin.settings.enableChinese = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Enable table of contents')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableTOC).onChange(async (value) => {
          this.plugin.settings.enableTOC = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

export async function resolveMarkTexBibliography(notePath: string, app: App): Promise<{ path: string; content: string } | null> {
  const dir = dirname(notePath);
  const base = basenameWithoutExtension(notePath);
  const prefix = dir ? `${dir}/` : '';
  const candidates = [`${prefix}${base}.bib`, `${prefix}${base}.local-zotero.bib`].map((path) => normalizePath(path));
  for (const candidate of candidates) {
    if (await app.vault.adapter.exists(candidate)) {
      return { path: candidate, content: await app.vault.adapter.read(candidate) };
    }
  }
  return null;
}

async function prepareMarkdownAssets(
  markdown: string,
  file: TFile,
  app: App,
  buildVaultDir: string
): Promise<{ markdown: string; diagnostics: MarkTexDiagnostic[] }> {
  const diagnostics: MarkTexDiagnostic[] = [];
  const assetDir = normalizePath(`${buildVaultDir}/assets`);
  await ensureAdapterFolder(app, assetDir);
  let counter = 0;
  const replaced = await replaceAsync(markdown, /!\[([^\]]*)\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g, async (match, alt, markdownPath, wikiPath) => {
    const rawPath = String(markdownPath || wikiPath || '').trim();
    if (!rawPath || /^(https?:|data:|zotero:)/i.test(rawPath)) return match;
    const sourcePath = resolveAssetPath(rawPath, file.path);
    if (!(await app.vault.adapter.exists(sourcePath))) {
      diagnostics.push({ level: 'warning', code: 'missing-image', message: `Image not found: ${rawPath}` });
      return match;
    }
    const extension = extensionOf(sourcePath);
    const targetName = `asset-${counter}${extension}`;
    counter += 1;
    const targetPath = normalizePath(`${assetDir}/${targetName}`);
    const data = await app.vault.adapter.readBinary(sourcePath);
    await app.vault.adapter.writeBinary(targetPath, data);
    return `![${alt || ''}](assets/${targetName})`;
  });
  return { markdown: replaced, diagnostics };
}

function bibliographyMissingDiagnostics(citekeys: string[]): MarkTexDiagnostic[] {
  if (citekeys.length === 0) return [];
  return [
    {
      level: 'warning',
      code: 'missing-bibliography',
      message: `没有找到同名 .bib 文件，引用将保留为 \\parencite：${citekeys.join(', ')}`
    }
  ];
}

async function ensureAdapterFolder(app: App, folder: string): Promise<void> {
  const normalized = normalizePath(folder);
  const parts = normalized.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.adapter.mkdir(current);
    }
  }
}

async function replaceAsync(
  value: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>
): Promise<string> {
  const matches = [...value.matchAll(pattern)];
  let result = '';
  let cursor = 0;
  for (const match of matches) {
    result += value.slice(cursor, match.index);
    result += await replacer(...(match as unknown as string[]));
    cursor = (match.index || 0) + match[0].length;
  }
  return result + value.slice(cursor);
}

function getActiveMarkdownText(app: App, file: TFile): string | null {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  return view?.file?.path === file.path ? view.editor.getValue() : null;
}

function emptyState(): WorkbenchState {
  return {
    file: null,
    tex: '',
    diagnostics: [],
    buildVaultDir: '',
    pdfVaultPath: null,
    logVaultPath: null,
    logExcerpt: '',
    status: 'Ready.',
    compiling: false,
    compileProgress: null,
    recentLogLines: []
  };
}

async function readLogExcerpt(app: App, logVaultPath: string): Promise<string> {
  try {
    if (!(await app.vault.adapter.exists(logVaultPath))) return '';
    const log = await app.vault.adapter.read(logVaultPath);
    return summarizeLatexLog(log);
  } catch {
    return '';
  }
}

function summarizeLatexLog(log: string): string {
  const lines = log.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const ranges: Array<[number, number]> = [];
  const errorPattern = /(^! |^[./\\\w-]*main\.tex:\d+:|Package .* Error|LaTeX Error|Fatal error|Emergency stop|cannot be found|Undefined control sequence|Missing .* inserted)/i;
  for (let index = 0; index < lines.length; index += 1) {
    if (errorPattern.test(lines[index])) {
      ranges.push([Math.max(0, index - 2), Math.min(lines.length, index + 8)]);
    }
  }
  if (ranges.length === 0) return lines.slice(-30).join('\n').trim();

  const selected: string[] = [];
  let previousEnd = -1;
  for (const [start, end] of ranges.slice(0, 4)) {
    if (start > previousEnd && selected.length > 0) selected.push('...');
    for (let index = Math.max(start, previousEnd); index < end; index += 1) {
      selected.push(lines[index]);
    }
    previousEnd = Math.max(previousEnd, end);
  }
  const excerpt = selected.join('\n').trim();
  return excerpt.length > 5000 ? `${excerpt.slice(0, 5000)}\n...` : excerpt;
}

function vaultPathToAbsolute(app: App, vaultPath: string): string | null {
  const adapter = app.vault.adapter as unknown as { getBasePath?: () => string };
  const basePath = adapter.getBasePath?.();
  if (!basePath) return null;
  const path = require('node:path') as typeof import('node:path');
  return path.join(basePath, vaultPath);
}

function getElectronShell(): { openPath: (path: string) => Promise<string> } | null {
  try {
    return (require('electron') as { shell?: { openPath: (path: string) => Promise<string> } }).shell ?? null;
  } catch {
    return null;
  }
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const electron = require('electron') as { clipboard?: { writeText: (text: string) => void } };
    electron.clipboard?.writeText(text);
  }
}

function hashPath(path: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function resolveAssetPath(rawPath: string, notePath: string): string {
  const clean = rawPath.split('|')[0].trim().replace(/^<|>$/g, '');
  if (clean.startsWith('/')) return normalizePath(clean.slice(1));
  const dir = dirname(notePath);
  return normalizePath(dir ? `${dir}/${clean}` : clean);
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function basenameWithoutExtension(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.replace(/\.[^.]+$/, '');
}

function extensionOf(path: string): string {
  const match = path.match(/\.[A-Za-z0-9]+$/);
  return match?.[0] || '';
}
