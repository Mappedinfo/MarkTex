/**
 * 设置面板
 */

import { useAppStore } from '../stores/appStore';
import './SettingsPanel.css';

export function SettingsPanel() {
  const { config, updateConfig, isSettingsPanelOpen, closeSettingsPanel } =
    useAppStore();

  if (!isSettingsPanelOpen) return null;

  return (
    <>
      <div className="settings-overlay" onClick={closeSettingsPanel}></div>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>设置</h2>
          <button onClick={closeSettingsPanel} className="btn-close">
            ×
          </button>
        </div>
        <div className="settings-body">
          <section className="settings-section">
            <h3>文档设置</h3>
            <div className="form-group">
              <label>文档类：</label>
              <select
                value={config.document.documentClass}
                onChange={(e) =>
                  updateConfig({
                    document: { documentClass: e.target.value as any },
                  })
                }
              >
                <option value="article">article（文章）</option>
                <option value="report">report（报告）</option>
                <option value="book">book（书籍）</option>
              </select>
            </div>
            <div className="form-group">
              <label>字体大小：</label>
              <select
                value={config.document.fontSize}
                onChange={(e) =>
                  updateConfig({ document: { fontSize: e.target.value as any } })
                }
              >
                <option value="10pt">10pt</option>
                <option value="11pt">11pt</option>
                <option value="12pt">12pt</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.document.enableChinese}
                  onChange={(e) =>
                    updateConfig({ document: { enableChinese: e.target.checked } })
                  }
                />
                启用中文支持
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>表格选项</h3>
            <div className="form-group">
              <label>表格样式：</label>
              <select
                value={config.table.tableStyle}
                onChange={(e) =>
                  updateConfig({ table: { tableStyle: e.target.value as any } })
                }
              >
                <option value="booktabs">专业样式（booktabs）</option>
                <option value="standard">标准样式</option>
              </select>
            </div>
            <div className="form-group">
              <label>自动换行阈值：</label>
              <input
                type="number"
                value={config.table.autoWrapThreshold}
                onChange={(e) =>
                  updateConfig({
                    table: { autoWrapThreshold: parseInt(e.target.value) },
                  })
                }
                min="10"
                max="100"
              />
              <small>单元格字符数超过此值将启用自动换行</small>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
