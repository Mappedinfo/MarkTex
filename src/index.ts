/**
 * MarkTex Library Exports
 * 可嵌入的 Markdown/LaTeX 编辑面板库
 */

// 面板组件
export { MarkTexPanel, type MarkTexPanelProps } from './components/MarkTexPanel';

// Store
export { createMarkTexStore, type MarkTexState, type CreateStoreOptions } from './stores/storeFactory';

// 类型
export type { AppConfig, EngineStatus, CompilationStage, FontStatus, TableConfig, DocumentConfig } from './types';

// 服务
export { LatexRenderer } from './services/latexRenderer';
export { DocumentGenerator } from './services/documentGenerator';
export { TableProcessor } from './services/tableProcessor';
export { swiftlatexService } from './services/swiftlatexService';
export { countMarkdownWords } from './services/wordCounter';

// 原始组件（需要自己提供 store）
export { MarkdownEditor } from './components/MarkdownEditor';
export { LatexPreview } from './components/LatexPreview';
export { SettingsPanel } from './components/SettingsPanel';
export { Toolbar } from './components/Toolbar';
