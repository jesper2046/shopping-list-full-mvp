declare namespace SQL {
  interface Database {
    run(sql: string, params?: any[]): any;
    prepare(sql: string): { run(params?: any[]): any; finalize(): void };
    exec(sql: string, params?: any[]): Array<{ columns: string[]; values: any[][] }>;
    export(): Uint8Array;
  }
  interface DatabaseConstructor {
    new (buffer?: Uint8Array): Database;
  }
  const Database: DatabaseConstructor;
}

declare module 'sql.js' {
  export default function initSqlJs(opts?: {
    locateFile?: (file: string) => string;
  }): Promise<{
    Database: SQL.DatabaseConstructor;
  }>;
  export class Database {
    constructor(buffer?: Uint8Array);
    run(sql: string, params?: any[]): any;
    prepare(sql: string): { run(params?: any[]): any; finalize(): void };
    exec(sql: string, params?: any[]): Array<{ columns: string[]; values: any[][] }>;
    export(): Uint8Array;
  }
}
