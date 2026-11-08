import { choicesForChapter, type ChoiceLine, type MoralChoiceDef } from '../morality/catalog';
import type { DialogueNode, DialogueTree } from './engine';

/** Düz bir satır listesinden ağaç: her satır bir sonrakine bağlanır. */
export function linesTree(id: string, lines: readonly ChoiceLine[]): DialogueTree {
  const nodes: Record<string, DialogueNode> = {};
  lines.forEach((l, i) => {
    const nodeId = `l${i}`;
    nodes[nodeId] = { id: nodeId, type: 'line', speaker: l.speaker, text: l.text, next: i + 1 < lines.length ? `l${i + 1}` : undefined };
  });
  if (lines.length === 0) nodes.l0 = { id: 'l0', type: 'line', speaker: '', text: '' };
  return { id, start: 'l0', nodes };
}

/**
 * Bir ahlak seçiminin diyalog ağacı: durumu anlatan satırlar → iki seçenek (iyi / kötü) → seçime göre tepki satırları.
 * Seçeneğin etkisi `moral` türündedir; ahlak puanı bu etkiyle değişir.
 */
export function buildChoiceTree(choice: MoralChoiceDef): DialogueTree {
  const nodes: Record<string, DialogueNode> = {};
  const chain = (prefix: string, lines: readonly ChoiceLine[], then: string | undefined): string | undefined => {
    lines.forEach((l, i) => {
      const id = `${prefix}${i}`;
      nodes[id] = { id, type: 'line', speaker: l.speaker, text: l.text, next: i + 1 < lines.length ? `${prefix}${i + 1}` : then };
    });
    return lines.length > 0 ? `${prefix}0` : then;
  };

  const goodStart = chain('good', choice.good.result, undefined);
  const badStart = chain('bad', choice.bad.result, undefined);
  nodes.choice = {
    id: 'choice',
    type: 'choice',
    prompt: choice.title,
    options: [
      { id: 'good', label: choice.good.label, next: goodStart, effect: { type: 'moral', choiceId: choice.id, side: 'good' } },
      { id: 'bad', label: choice.bad.label, next: badStart, effect: { type: 'moral', choiceId: choice.id, side: 'bad' } },
    ],
  };
  const start = chain('intro', choice.intro, 'choice') ?? 'choice';
  return { id: choice.id, start, nodes };
}

/** Bir bölümün ahlak seçimleri için ağaçlar (bölümde 2 seçim vardır). */
export const chapterChoiceTrees = (chapter: number): DialogueTree[] => choicesForChapter(chapter).map(buildChoiceTree);
