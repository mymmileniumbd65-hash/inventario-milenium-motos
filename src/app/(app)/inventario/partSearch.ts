// Lógica pura de búsqueda del PartCombobox — sin JSX ni imports de React,
// en archivo aparte para poder testearla en Vitest (mismo patrón que movementLogic.ts).

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filterParts<T extends { sku: string; description: string }>(parts: T[], query: string): T[] {
  const q = normalize(query.trim());
  if (q === '') return parts;
  return parts.filter((p) => normalize(p.sku).includes(q) || normalize(p.description).includes(q));
}
