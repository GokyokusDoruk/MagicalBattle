import type { Side } from '../morality/catalog';

/** Diyalog motoru (arayüzden bağımsız): düğümler, seçenekler, koşullar, etkiler. */

export type DialogueEffect =
  | { type: 'moral'; choiceId: string; side: Side }
  | { type: 'flag'; key: string };

export interface Condition {
  /** Ahlak puanı en az bu kadar olmalı */
  minScore?: number;
  /** Ahlak puanı en çok bu kadar olmalı */
  maxScore?: number;
  /** Bu bayrak ayarlı olmalı */
  flag?: string;
  /** Bu bayrak ayarlı olmamalı */
  notFlag?: string;
}

export interface DialogueOption {
  id: string;
  label: string;
  /** Sonraki düğüm; yoksa diyalog biter */
  next?: string;
  effect?: DialogueEffect;
  requires?: Condition;
}

export type DialogueNode =
  | { id: string; type: 'line'; speaker: string; text: string; next?: string }
  | { id: string; type: 'choice'; speaker?: string; prompt?: string; options: DialogueOption[] };

export interface DialogueTree {
  id: string;
  start: string;
  nodes: Record<string, DialogueNode>;
}

/** Motorun dış dünyayla bağı: güncel puan, bayraklar ve etkilerin uygulanışı. */
export interface DialogueContext {
  score: () => number;
  flags: Set<string>;
  onEffect: (effect: DialogueEffect) => void;
}

export const MAX_STEPS = 500;

export function meets(cond: Condition | undefined, ctx: Pick<DialogueContext, 'score' | 'flags'>): boolean {
  if (!cond) return true;
  const score = ctx.score();
  if (cond.minScore !== undefined && score < cond.minScore) return false;
  if (cond.maxScore !== undefined && score > cond.maxScore) return false;
  if (cond.flag !== undefined && !ctx.flags.has(cond.flag)) return false;
  if (cond.notFlag !== undefined && ctx.flags.has(cond.notFlag)) return false;
  return true;
}

/** Ağaçtaki hataları (olmayan başlangıç, boş yöne işaret eden `next`, seçeneksiz seçim, tekrarlı seçenek kimliği) listeler. */
export function validateTree(tree: DialogueTree): string[] {
  const errors: string[] = [];
  const has = (id: string | undefined): boolean => id === undefined || id in tree.nodes;
  if (!(tree.start in tree.nodes)) errors.push(`${tree.id}: başlangıç düğümü yok (${tree.start})`);
  for (const [key, node] of Object.entries(tree.nodes)) {
    if (node.id !== key) errors.push(`${tree.id}: düğüm kimliği anahtarla uyuşmuyor (${key})`);
    if (node.type === 'line') {
      if (!has(node.next)) errors.push(`${tree.id}/${node.id}: olmayan düğüme gidiyor (${node.next})`);
    } else {
      if (node.options.length === 0) errors.push(`${tree.id}/${node.id}: seçenek yok`);
      const seen = new Set<string>();
      for (const o of node.options) {
        if (seen.has(o.id)) errors.push(`${tree.id}/${node.id}: tekrarlı seçenek ${o.id}`);
        seen.add(o.id);
        if (!has(o.next)) errors.push(`${tree.id}/${node.id}/${o.id}: olmayan düğüme gidiyor (${o.next})`);
      }
    }
  }
  return errors;
}

/**
 * Bir diyalog ağacını adım adım yürütür. `line` düğümünde `advance()`, `choice` düğümünde `choose(id)`
 * çağrılır. Seçeneğin etkisi seçilince uygulanır. Koşulu sağlanmayan seçenekler listelenmez ve seçilemez.
 */
export class DialogueRunner {
  private nodeId: string | null;
  private steps = 0;
  private readonly visited: string[] = [];

  constructor(
    private readonly tree: DialogueTree,
    private readonly ctx: DialogueContext,
  ) {
    const errors = validateTree(tree);
    if (errors.length > 0) throw new Error(errors.join('; '));
    this.nodeId = tree.start;
    this.visited.push(tree.start);
  }

  get current(): DialogueNode | null {
    return this.nodeId === null ? null : this.tree.nodes[this.nodeId];
  }

  get isDone(): boolean {
    return this.nodeId === null;
  }

  /** Şimdiye kadar gezilen düğümler (sıralı) */
  get history(): readonly string[] {
    return this.visited;
  }

  /** Geçerli seçim düğümünün koşulunu sağlayan seçenekleri verir. */
  availableOptions(): DialogueOption[] {
    const node = this.current;
    if (!node || node.type !== 'choice') return [];
    return node.options.filter((o) => meets(o.requires, this.ctx));
  }

  private go(next: string | undefined): void {
    if (++this.steps > MAX_STEPS) throw new Error('Diyalog döngüye girdi');
    this.nodeId = next ?? null;
    if (next) this.visited.push(next);
  }

  /** Satır düğümünde bir sonrakine geçer. Seçim düğümünde bir şey yapmaz. */
  advance(): void {
    const node = this.current;
    if (!node || node.type !== 'line') return;
    this.go(node.next);
  }

  /** Seçim düğümünde bir seçeneği seçer; geçersizse false. */
  choose(optionId: string): boolean {
    const node = this.current;
    if (!node || node.type !== 'choice') return false;
    const option = this.availableOptions().find((o) => o.id === optionId);
    if (!option) return false;
    if (option.effect) this.ctx.onEffect(option.effect);
    this.go(option.next);
    return true;
  }
}
