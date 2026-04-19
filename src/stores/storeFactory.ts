/**
 * Store Factory - 创建独立的 MarkTex 状态管理实例
 * 用于支持多个 MarkTex 面板实例
 */

import { create } from 'zustand';
import type { AppConfig, EngineStatus, CompilationStage, FontStatus } from '../types';
import type { ExtractedTriple } from '../plugins/wikilink';

// 笔记接口
export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
  sourceType?: 'manual' | 'research';
  createdAt?: number;
  updatedAt?: number;
}

// 搜索结果接口
export interface SearchResult {
  type: 'node' | 'relation';
  id: string;
  label: string;
  subLabel?: string;
}

// 笔记管理状态
export interface NoteManagementState {
  // 笔记列表
  notes: Note[];
  setNotes: (notes: Note[]) => void;

  // 当前编辑的笔记
  currentNoteId: string | null;
  setCurrentNoteId: (id: string | null) => void;

  // 笔记搜索
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;

  // 加载状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // 自动保存状态
  isAutoSaving: boolean;
  setIsAutoSaving: (saving: boolean) => void;
  lastSavedAt: number | null;
  setLastSavedAt: (time: number | null) => void;

  // 引用搜索
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;

  // 提取的三元组
  extractedTriples: ExtractedTriple[];
  setExtractedTriples: (triples: ExtractedTriple[]) => void;
}

export interface MarkTexState {
  // Markdown 内容
  markdownContent: string;
  setMarkdownContent: (content: string) => void;

  // LaTeX 输出
  latexOutput: string;
  setLatexOutput: (output: string) => void;

  // 配置
  config: AppConfig;
  updateConfig: (config: Partial<AppConfig>) => void;

  // 预览模式：'source' 源码 | 'pdf' PDF渲染 | 'preview' Markdown预览
  previewMode: 'source' | 'pdf' | 'preview';
  setPreviewMode: (mode: 'source' | 'pdf' | 'preview') => void;

  // 编译错误
  compileError: string | null;
  setCompileError: (error: string | null) => void;

  // PDF URL
  pdfUrl: string | null;
  setPdfUrl: (url: string | null) => void;

  // 编译状态
  isCompiling: boolean;
  setIsCompiling: (compiling: boolean) => void;

  // 引擎状态
  engineStatus: EngineStatus;
  setEngineStatus: (status: EngineStatus) => void;

  // 编译阶段
  compilationStage: CompilationStage;
  setCompilationStage: (stage: CompilationStage) => void;

  // 编译进度
  compilationProgress: number;
  setCompilationProgress: (progress: number) => void;

  // 字体加载状态
  fontLoadStatus: FontStatus;
  setFontLoadStatus: (status: FontStatus) => void;

  // UI 状态
  isSettingsPanelOpen: boolean;
  toggleSettingsPanel: () => void;
  closeSettingsPanel: () => void;

  // 通知
  notification: {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  };
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  hideNotification: () => void;

  // 笔记管理
  noteManagement: NoteManagementState;
  updateNoteManagement: (updates: Partial<NoteManagementState>) => void;

  // Wiki-link 点击回调
  onWikiLinkClick?: (type: 'node' | 'relation', id: string, label: string) => void;
  setOnWikiLinkClick: (callback: (type: 'node' | 'relation', id: string, label: string) => void) => void;

  // 笔记保存回调
  onNoteSave?: (note: Note) => Promise<void>;
  setOnNoteSave: (callback: (note: Note) => Promise<void>) => void;

  // 笔记加载回调
  onNotesLoad?: () => Promise<Note[]>;
  setOnNotesLoad: (callback: () => Promise<Note[]>) => void;

  // 节点/关系搜索回调
  onSearchNodes?: (keyword: string) => Promise<SearchResult[]>;
  setOnSearchNodes: (callback: (keyword: string) => Promise<SearchResult[]>) => void;

  // 三元组创建回调
  onTriplesExtracted?: (triples: ExtractedTriple[]) => Promise<void>;
  setOnTriplesExtracted: (callback: (triples: ExtractedTriple[]) => Promise<void>) => void;
}

const defaultConfig: AppConfig = {
  document: {
    documentClass: 'article',
    fontSize: '11pt',
    pageSize: 'a4paper',
    enableChinese: true,
    enableTOC: false,
  },
  table: {
    tableStyle: 'booktabs',
    autoWrapThreshold: 20,
  },
};

const defaultInitialContent = `# Markdown to LaTeX 转换工具

欢迎使用 **MarkTex**！

## 功能特性

- ✅ 完整的 Markdown 语法支持
- ✅ 智能表格处理
- ✅ 实时预览 LaTeX 代码
- ✅ Wiki-link 支持：[[节点引用|id]] 和 [[关系类型]]
`;

export interface CreateStoreOptions {
  initialContent?: string;
  config?: Partial<AppConfig>;
  /** Wiki-link 点击回调 */
  onWikiLinkClick?: (type: 'node' | 'relation', id: string, label: string) => void;
  /** 笔记保存回调 */
  onNoteSave?: (note: Note) => Promise<void>;
  /** 笔记加载回调 */
  onNotesLoad?: () => Promise<Note[]>;
  /** 节点/关系搜索回调 */
  onSearchNodes?: (keyword: string) => Promise<SearchResult[]>;
  /** 三元组创建回调 */
  onTriplesExtracted?: (triples: ExtractedTriple[]) => Promise<void>;
}

export function createMarkTexStore(options: CreateStoreOptions = {}) {
  const {
    initialContent = defaultInitialContent,
    config: initialConfig,
    onWikiLinkClick,
    onNoteSave,
    onNotesLoad,
    onSearchNodes,
    onTriplesExtracted,
  } = options;

  // 默认笔记管理状态
  const defaultNoteManagement: NoteManagementState = {
    notes: [],
    setNotes: () => {},
    currentNoteId: null,
    setCurrentNoteId: () => {},
    searchKeyword: '',
    setSearchKeyword: () => {},
    isLoading: false,
    setIsLoading: () => {},
    isAutoSaving: false,
    setIsAutoSaving: () => {},
    lastSavedAt: null,
    setLastSavedAt: () => {},
    searchResults: [],
    setSearchResults: () => {},
    isSearching: false,
    setIsSearching: () => {},
    extractedTriples: [],
    setExtractedTriples: () => {},
  };

  return create<MarkTexState>((set) => ({
    // 初始 Markdown 内容
    markdownContent: initialContent,
    setMarkdownContent: (content) => set({ markdownContent: content }),

    latexOutput: '',
    setLatexOutput: (output) => set({ latexOutput: output }),

    // 预览模式
    previewMode: 'source',
    setPreviewMode: (mode) => set({ previewMode: mode }),

    // 编译错误
    compileError: null,
    setCompileError: (error) => set({ compileError: error }),

    // PDF URL
    pdfUrl: null,
    setPdfUrl: (url) => set({ pdfUrl: url }),

    // 编译状态
    isCompiling: false,
    setIsCompiling: (compiling) => set({ isCompiling: compiling }),

    // 引擎状态
    engineStatus: 'unloaded',
    setEngineStatus: (status) => set({ engineStatus: status }),

    // 编译阶段
    compilationStage: 'idle',
    setCompilationStage: (stage) => set({ compilationStage: stage }),

    // 编译进度
    compilationProgress: 0,
    setCompilationProgress: (progress) => set({ compilationProgress: progress }),

    // 字体加载状态
    fontLoadStatus: {},
    setFontLoadStatus: (status) => set({ fontLoadStatus: status }),

    // 配置
    config: {
      document: {
        ...defaultConfig.document,
        ...initialConfig?.document,
      },
      table: {
        ...defaultConfig.table,
        ...initialConfig?.table,
      },
    },
    updateConfig: (newConfig) =>
      set((state) => {
        const newDocument = newConfig.document
          ? { ...state.config.document, ...newConfig.document }
          : state.config.document;
        const newTable = newConfig.table
          ? { ...state.config.table, ...newConfig.table }
          : state.config.table;

        return {
          config: {
            document: newDocument,
            table: newTable,
          },
        };
      }),

    isSettingsPanelOpen: false,
    toggleSettingsPanel: () =>
      set((state) => ({ isSettingsPanelOpen: !state.isSettingsPanelOpen })),
    closeSettingsPanel: () => set({ isSettingsPanelOpen: false }),

    notification: {
      show: false,
      message: '',
      type: 'info',
    },

    showNotification: (message, type) => {
      set({
        notification: {
          show: true,
          message,
          type,
        },
      });

      // 3秒后自动隐藏
      setTimeout(() => {
        set((state) => ({
          notification: {
            ...state.notification,
            show: false,
          },
        }));
      }, 3000);
    },

    hideNotification: () =>
      set((state) => ({
        notification: {
          ...state.notification,
          show: false,
        },
      })),

    // 笔记管理
    noteManagement: defaultNoteManagement,
    updateNoteManagement: (updates) =>
      set((state) => ({
        noteManagement: {
          ...state.noteManagement,
          ...updates,
        },
      })),

    // Wiki-link 点击回调
    onWikiLinkClick: onWikiLinkClick || (() => {}),
    setOnWikiLinkClick: (callback) => set({ onWikiLinkClick: callback }),

    // 笔记保存回调
    onNoteSave: onNoteSave || (async () => {}),
    setOnNoteSave: (callback) => set({ onNoteSave: callback }),

    // 笔记加载回调
    onNotesLoad: onNotesLoad || (async () => []),
    setOnNotesLoad: (callback) => set({ onNotesLoad: callback }),

    // 节点/关系搜索回调
    onSearchNodes: onSearchNodes || (async () => []),
    setOnSearchNodes: (callback) => set({ onSearchNodes: callback }),

    // 三元组创建回调
    onTriplesExtracted: onTriplesExtracted || (async () => {}),
    setOnTriplesExtracted: (callback) => set({ onTriplesExtracted: callback }),
  }));
}
