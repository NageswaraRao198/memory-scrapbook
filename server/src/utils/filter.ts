/** Builds a parameterised WHERE clause for Postgres ($1, $2, ...) from `?` placeholders. */
export class Filter {
  private readonly conditions: string[] = [];
  readonly params: unknown[] = [];

  add(condition: string, ...values: unknown[]): this {
    let sql = condition;
    for (const value of values) {
      this.params.push(value);
      sql = sql.replace('?', `$${this.params.length}`);
    }
    this.conditions.push(sql);
    return this;
  }

  /** Registers a value (e.g. LIMIT) and returns its placeholder. */
  push(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  get clause(): string {
    return this.conditions.join(' AND ');
  }
}
