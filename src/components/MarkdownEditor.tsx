/**
 * Markdown 编辑器组件
 * 集成 CodeMirror 6
 */

import { useEffect, useRef, useMemo } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { useAppStore } from '../stores/appStore';
import { countMarkdownWords } from '../services/wordCounter';
import './MarkdownEditor.css';

export function MarkdownEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { markdownContent, setMarkdownContent } = useAppStore();
  
  // 计算字数统计
  const wordCount = useMemo(() => {
    return countMarkdownWords(markdownContent);
  }, [markdownContent]);

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: markdownContent,
      extensions: [
        lineNumbers(),
        markdown(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            setMarkdownContent(newContent);
          }
        }),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div className="markdown-editor">
      <div className="editor-header">
        <h2>Markdown 编辑器</h2>
        <div className="editor-stats">
          <span className="stat-item" title="总字数（包含表格）">
            总计: {wordCount.totalWords} 词
          </span>
          <span className="stat-separator">|</span>
          <span className="stat-item" title="正文字数（不含表格）">
            正文: {wordCount.bodyWords} 词
          </span>
          <span className="stat-separator">|</span>
          <span className="stat-item" title="表格字数">
            表格: {wordCount.tableWords} 词
          </span>
          <span className="stat-separator">|</span>
          <span className="stat-item">
            {markdownContent.split('\n').length} 行
          </span>
        </div>
      </div>
      <div className="editor-body" ref={editorRef}></div>
    </div>
  );
}
