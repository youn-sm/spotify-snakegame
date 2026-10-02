type Child = Node | string | null | undefined | false;

/** Creates an element; text children are inserted as text, never parsed as HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}
