/**
 * Wiki-Link Markdown-It 插件
 * 支持 [[名称|id]] 和 [[relation-type]] 语法
 */

// Wiki-link token types
export const WIKI_LINK_NODE = 'wikilink_node';
export const WIKI_LINK_RELATION = 'wikilink_relation';

// 预定义的关系类型
export const RELATION_TYPES = [
  '引用',
  '批判支持',
  '支持',
  '反驳',
  '扩展',
  '补充',
  '质疑',
  '关联',
  '对比',
  '应用',
  'cites',
  'supports',
  'criticizes',
  'relatesTo',
  'isDerivedFrom',
  'uses',
] as const;

export type RelationType = typeof RELATION_TYPES[number];

// 判断是否为节点 ID
function isNodeId(id: string): boolean {
  return id.startsWith('node-') || /^[a-f0-9]{16,}$/i.test(id);
}

// Wiki-link plugin for markdown-it
export function wikilinkPlugin(md: any): void {
  // 规则名称
  const WIKILINK_RULE = 'wikilink';

  // 添加解析规则
  md.inline.ruler.before('link', WIKILINK_RULE, (state: any, silent: boolean): boolean => {
    const pos = state.pos;
    const max = state.posMax;
    const src = state.src;

    // 检查是否为 wiki-link 开头
    if (src[pos] !== '[' || src[pos + 1] !== '[') {
      return false;
    }

    // 找到匹配的结尾
    let end = pos + 2;
    let pipeIndex = -1;
    let closeCount = 2; // 已消费两个 '['

    while (end < max) {
      if (src[end] === '[' && src[end - 1] !== '\\') {
        closeCount++;
      }
      if (src[end] === ']' && src[end - 1] !== '\\') {
        closeCount--;
        if (closeCount === 0) {
          break;
        }
      }
      if (src[end] === '|' && pipeIndex === -1 && closeCount === 2) {
        pipeIndex = end;
      }
      end++;
    }

    // 检查是否找到完整的 wiki-link
    if (end >= max || src[end] !== ']' || src[end - 1] !== ']') {
      return false;
    }

    // 解析 wiki-link 内容（end 指向第二个 ']'，end-1 是第一个 ']'）
    const content = src.slice(pos + 2, pipeIndex !== -1 ? pipeIndex : end - 1);
    const target = pipeIndex !== -1 ? src.slice(pipeIndex + 1, end - 1) : null;

    const displayText = content.trim();

    // 判断类型
    let type: 'node' | 'relation' | 'unknown' = 'unknown';

    if (target) {
      // 有第二个参数，根据内容判断类型
      if (isNodeId(target.trim())) {
        type = 'node';
      } else {
        type = 'relation';
      }
    } else {
      // 没有第二个参数，检查是否为已知的关系类型
      const normalizedText = displayText.toLowerCase();
      const isKnownRelation = RELATION_TYPES.some(
        (rt) => rt.toLowerCase() === normalizedText || rt === displayText
      );
      if (isKnownRelation) {
        type = 'relation';
      }
    }

    if (silent) {
      // silent 模式下只检查语法，不创建 token
      return true;
    }

    // 创建 token
    const token = state.push(WIKI_LINK_NODE, 'span', 0);
    token.meta = {
      displayText,
      target: target?.trim() || null,
      type,
    };

    // 更新位置
    state.pos = end + 1;

    return true;
  });

  // 添加渲染规则
  md.renderer.rules[WIKI_LINK_NODE] = (tokens: any[], idx: number): string => {
    const token = tokens[idx];
    const { displayText, target, type } = token.meta;

    if (type === 'node') {
      // 节点引用样式
      return `<span class="wikilink-node" data-id="${target || ''}" data-label="${displayText}">${displayText}</span>`;
    } else if (type === 'relation') {
      // 关系类型样式
      return `<span class="wikilink-relation" data-type="${target || displayText}">${displayText}</span>`;
    } else {
      // 未知类型，作为普通文本
      return `<span class="wikilink-unknown">[[${displayText}${target ? '|' + target : ''}]]</span>`;
    }
  };
}

/**
 * 从内容中解析所有 wiki-links
 */
export function parseWikiLinks(content: string): Array<{
  type: 'node' | 'relation' | 'unknown';
  displayText: string;
  target: string | null;
  start: number;
  end: number;
}> {
  const results: Array<{
    type: 'node' | 'relation' | 'unknown';
    displayText: string;
    target: string | null;
    start: number;
    end: number;
  }> = [];

  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const displayText = match[1].trim();
    const target = match[2]?.trim() || null;

    let type: 'node' | 'relation' | 'unknown' = 'unknown';

    if (target) {
      if (isNodeId(target)) {
        type = 'node';
      } else {
        type = 'relation';
      }
    } else {
      const normalizedText = displayText.toLowerCase();
      const isKnownRelation = RELATION_TYPES.some(
        (rt) => rt.toLowerCase() === normalizedText || rt === displayText
      );
      if (isKnownRelation) {
        type = 'relation';
      }
    }

    results.push({
      type,
      displayText,
      target,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return results;
}

/**
 * 从内容中提取三元组
 * 规则：如果同一句子中有两个节点引用和一个关系引用，创建三元组
 */
export interface ExtractedTriple {
  source: string;
  target: string;
  relationType: string;
  sourceLabel: string;
  targetLabel: string;
}

export function extractTriplesFromContent(content: string): ExtractedTriple[] {
  const triples: ExtractedTriple[] = [];
  const wikiLinks = parseWikiLinks(content);

  // 按句子分割
  const sentences = content.split(/[。！？\n]/);

  sentences.forEach((sentence) => {
    const sentenceLinks = wikiLinks.filter(
      (link) => sentence.includes(`[[${link.displayText}${link.target ? '|' + link.target : ''}]]`)
    );

    // 找出所有节点和关系
    const nodes = sentenceLinks.filter((l) => l.type === 'node');
    const relations = sentenceLinks.filter((l) => l.type === 'relation');

    // 如果有至少两个节点和一个关系类型，创建三元组
    if (nodes.length >= 2 && relations.length >= 1) {
      triples.push({
        source: nodes[0].target || '',
        target: nodes[1].target || '',
        relationType: relations[0].target || relations[0].displayText,
        sourceLabel: nodes[0].displayText,
        targetLabel: nodes[1].displayText,
      });
    }
  });

  return triples;
}

export default wikilinkPlugin;
