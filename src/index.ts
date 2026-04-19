/**
 * MarkTex Library Exports
 * 可嵌入的 Markdown/LaTeX 编辑面板库
 */

// 面板组件
import { MarkTexPanel, type MarkTexPanelProps } from './components/MarkTexPanel';

// 将组件暴露到全局（用于通过 script 标签加载时）
if (typeof window !== 'undefined') {
  (window as any).MarkTexPanel = MarkTexPanel;
}

// Store
export {
  createMarkTexStore,
  type MarkTexState,
  type CreateStoreOptions,
  type Note,
  type SearchResult,
  type NoteManagementState,
} from './stores/storeFactory';

// 类型
export type { AppConfig, EngineStatus, CompilationStage, FontStatus, TableConfig, DocumentConfig } from './types';

// Wiki-link 插件
export {
  wikilinkPlugin,
  parseWikiLinks,
  extractTriplesFromContent,
  type ExtractedTriple,
  RELATION_TYPES,
} from './plugins/wikilink';

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

// 重新导出组件（保持向后兼容）
export { MarkTexPanel, type MarkTexPanelProps };
