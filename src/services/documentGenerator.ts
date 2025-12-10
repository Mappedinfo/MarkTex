/**
 * LaTeX 文档生成器
 * 将渲染的内容包装为完整的可编译 LaTeX 文档
 */

import type { DocumentConfig, LatexRenderResult } from '../types';

export class DocumentGenerator {
  /**
   * 生成完整的 LaTeX 文档
   * @param forExport 是否用于导出(true: Overleaf兼容, false: SwiftLaTeX预览)
   */
  generate(renderResult: LatexRenderResult, config: DocumentConfig, forExport: boolean = false): string {
    const sections: string[] = [];

    // 1. 文档类声明
    sections.push(this.generateDocumentClass(config));
    sections.push('');

    // 2. 导入宏包
    sections.push(this.generatePackages(renderResult, config, forExport));
    sections.push('');

    // 3. 文档配置
    sections.push(this.generateDocumentConfig(renderResult, config));
    sections.push('');

    // 4. 开始文档
    sections.push('\\begin{document}');
    sections.push('');

    // 5. 目录（如果启用）
    if (config.enableTOC) {
      sections.push('\\tableofcontents');
      sections.push('\\newpage');
      sections.push('');
    }

    // 6. 正文内容
    sections.push(renderResult.content);
    sections.push('');

    // 7. 结束文档
    sections.push('\\end{document}');

    return sections.join('\n');
  }

  /**
   * 生成文档类声明
   */
  private generateDocumentClass(config: DocumentConfig): string {
    const options = [config.fontSize, config.pageSize];
    return `\\documentclass[${options.join(',')}]{${config.documentClass}}`;
  }

  /**
   * 生成宏包导入
   * @param forExport 是否用于导出
   */
  private generatePackages(result: LatexRenderResult, config: DocumentConfig, forExport: boolean = false): string {
    const packages: string[] = [];

    // 必需宏包
    packages.push('\\usepackage{geometry}');
    
    // 中文支持 - 兼容两种环境
    if (config.enableChinese || result.hasChinese) {
      packages.push('\\usepackage{fontspec}');
      packages.push('\\usepackage{xeCJK}');
      
      if (forExport) {
        // Overleaf/标准 LaTeX 环境 - 使用系统字体名称
        packages.push('% 使用 Overleaf 系统字体,如果编译失败请改为其他中文字体');
        packages.push('% 可选字体: Noto Sans CJK SC, Source Han Sans SC, SimSun, FandolSong');
        packages.push('\\setCJKmainfont{Noto Sans CJK SC}');
        packages.push('\\setCJKsansfont{Noto Sans CJK SC}');
        packages.push('\\setCJKmonofont{Noto Sans CJK SC}');
      } else {
        // SwiftLaTeX 前端环境 - 使用虚拟文件系统路径
        packages.push('\\setCJKmainfont[Path=/fonts/]{NotoSansCJKsc-Regular.otf}');
        packages.push('\\setCJKsansfont[Path=/fonts/]{NotoSansCJKsc-Regular.otf}');
        packages.push('\\setCJKmonofont[Path=/fonts/]{NotoSansCJKsc-Regular.otf}');
      }
    }

    // 图片支持
    if (result.hasImages) {
      packages.push('\\usepackage{graphicx}');
    }

    // 超链接支持
    if (result.packages.has('hyperref')) {
      packages.push('\\usepackage{hyperref}');
      packages.push('\\hypersetup{');
      packages.push('    colorlinks=true,');
      packages.push('    linkcolor=blue,');
      packages.push('    urlcolor=blue,');
      packages.push('    citecolor=blue');
      packages.push('}');
    }

    // 数学公式支持
    if (result.hasMath) {
      packages.push('\\usepackage{amsmath}');
      packages.push('\\usepackage{amssymb}');
    }

    // 表格宏包
    if (result.hasTables) {
      if (result.packages.has('booktabs')) {
        packages.push('\\usepackage{booktabs}');
      }
      if (result.packages.has('tabularx')) {
        packages.push('\\usepackage{tabularx}');
      }
      if (result.packages.has('longtable')) {
        packages.push('\\usepackage{longtable}');
      }
      packages.push('\\usepackage{array}');
    }

    // 代码高亮
    if (result.hasCode) {
      packages.push('\\usepackage{listings}');
      packages.push('\\usepackage{xcolor}');
      
      // listings 配置
      packages.push('\\lstset{');
      packages.push('    basicstyle=\\ttfamily\\small,');
      packages.push('    breaklines=true,');
      packages.push('    frame=single,');
      packages.push('    numbers=left,');
      packages.push('    numberstyle=\\tiny,');
      packages.push('    backgroundcolor=\\color{gray!10},');
      packages.push('    keywordstyle=\\color{blue},');
      packages.push('    commentstyle=\\color{green!50!black},');
      packages.push('    stringstyle=\\color{red}');
      packages.push('}');
    }

    // 删除线支持
    if (result.packages.has('ulem')) {
      packages.push('\\usepackage[normalem]{ulem}');
    }

    // 其他必要宏包
    packages.push('\\usepackage{enumitem}');
    packages.push('\\usepackage{float}');

    return packages.join('\n');
  }

  /**
   * 生成文档配置
   */
  private generateDocumentConfig(_result: LatexRenderResult, _config: DocumentConfig): string {
    const configs: string[] = [];

    // 页面布局
    configs.push('% 页面布局设置');
    configs.push('\\geometry{');
    configs.push('    left=2.5cm,');
    configs.push('    right=2.5cm,');
    configs.push('    top=2.5cm,');
    configs.push('    bottom=2.5cm');
    configs.push('}');
    configs.push('');

    // 段落设置
    configs.push('% 段落设置');
    configs.push('\\setlength{\\parindent}{0pt}');
    configs.push('\\setlength{\\parskip}{0.5em}');

    return configs.join('\n');
  }
}
