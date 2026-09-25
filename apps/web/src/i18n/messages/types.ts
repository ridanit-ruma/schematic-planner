/**
 * The shape every catalog has to fill: the English one, with each literal
 * widened to `string` so another language can say something else. A message is
 * a string, or a function when it takes values — a count, a name, a link —
 * because word order and plural rules differ by language and only a function
 * can move them.
 */
export type Catalog<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R extends string ? string : R
    : { readonly [K in keyof T]: Catalog<T[K]> };
