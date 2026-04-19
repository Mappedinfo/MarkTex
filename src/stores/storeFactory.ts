/**
 * Store Factory - 创建独立的 MarkTex 状态管理实例
 * 用于支持多个 MarkTex 面板实例
 */

import { create } from 'zustand';
import type { AppConfig, EngineStatus, CompilationStage, FontStatus } from '../types';

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

  // 预览模式：'source' 源码 | 'pdf' PDF渲染
  previewMode: 'source' | 'pdf';
  setPreviewMode: (mode: 'source' | 'pdf') => void;

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
`;

export interface CreateStoreOptions {
  initialContent?: string;
  config?: Partial<AppConfig>;
}

export function createMarkTexStore(options: CreateStoreOptions = {}) {
  const { initialContent = defaultInitialContent, config: initialConfig } = options;

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
  }));
}

// 导出类型
export type { AppConfig, EngineStatus, CompilationStage, FontStatus } from '../types';
