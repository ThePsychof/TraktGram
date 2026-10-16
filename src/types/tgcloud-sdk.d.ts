declare module 'sdk' {
  export const api: Record<string, (payload: unknown) => Promise<unknown>>;
  export const fetch: typeof globalThis.fetch;
  export const db: typeof import('sdk/db').db;

  export class EndpointError extends Error {
    constructor(description: string, parameters?: Record<string, unknown>);
  }
}

declare module 'sdk/db' {
  type Column = { readonly name: string };
  type ColumnBuilder = {
    primaryKey(): ColumnBuilder;
    notNull(): ColumnBuilder;
  };
  type Table = Record<string, Column>;
  type Row = Record<string, unknown>;
  type Condition = unknown;

  export function text(name?: string): ColumnBuilder;
  export function integer(name?: string): ColumnBuilder;
  export function table<T extends Record<string, ColumnBuilder>>(
    name: string,
    columns: T,
  ): { [K in keyof T]: Column };
  export function eq(column: Column, value: unknown): Condition;

  export const db: {
    select(): {
      from(table: Table): {
        where(condition: Condition): {
          get(): Promise<Row | null>;
        };
      };
    };
    insert(table: Table): {
      values(values: Row): {
        onConflictDoUpdate(options: {
          target: Column;
          set: Record<string, unknown>;
        }): {
          run(): Promise<unknown>;
        };
      };
    };
    delete(table: Table): {
      where(condition: Condition): {
        run(): Promise<unknown>;
      };
    };
  };
}
