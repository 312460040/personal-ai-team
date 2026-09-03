export type MemoryType = 'decision' | 'focus' | 'problem' | 'preference' | 'pattern';

export interface ManagerMemory {
  id: string;
  type: MemoryType;
  content: string;
  createdAt: string;
  confidence: number;
  source: 'owner' | 'observed' | 'inferred';
}

export function createMemory(input: {
  type: MemoryType;
  content: string;
  source?: ManagerMemory['source'];
  confidence?: number;
  now?: Date;
}): ManagerMemory {
  return {
    id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    content: input.content,
    createdAt: (input.now ?? new Date()).toISOString(),
    confidence: Math.max(0, Math.min(1, input.confidence ?? 1)),
    source: input.source ?? 'owner',
  };
}

export function consolidateMemories(memories: ManagerMemory[]): ManagerMemory[] {
  const latest = new Map<string, ManagerMemory>();
  for (const memory of memories) {
    const key = `${memory.type}:${memory.content.trim().toLowerCase()}`;
    const existing = latest.get(key);
    if (!existing || new Date(memory.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      latest.set(key, memory);
    }
  }
  return [...latest.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function inferRepeatedPattern(memories: ManagerMemory[], phrase: string): ManagerMemory | null {
  const matches = memories.filter((memory) => memory.content.includes(phrase));
  if (matches.length < 3) return null;
  return createMemory({
    type: 'pattern',
    content: `觀察到「${phrase}」已出現 ${matches.length} 次，Manager 可將其視為可能的長期模式。`,
    source: 'inferred',
    confidence: Math.min(0.95, 0.5 + matches.length * 0.1),
  });
}
