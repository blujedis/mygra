export type MigrateDirection = 'up' | 'down';

export type CreateMigrationHandler = (options: IMigrationOptions) => string;

export type ConnectionHandler = (...args: any[]) => Promise<boolean>;

// Events:
//
// created    { name, filename }
// filtered   { filenames, direction, name, levels }
// loaded     { filenames, migrations }
// migration  { type, message, ok, count }
// up         { name }
// down       { name }
// active     [migration_name, direction];
// revert     { names }
export const EVENTS = ['created', 'filtered', 'loaded', 'migration', 'up', 'down', 'active', 'revert'] as const;

export type Event = typeof EVENTS[number];

export type Events = Record<keyof Event, ((...args: any[]) => void)[]>;

export interface IMigration<C extends ConnectionHandler = ConnectionHandler> {
  name: string;
  readonly description: string;
  readonly filename: string;
  up: (conn: C) => Promise<any>;
  down: (conn: C) => Promise<any>;
}

export interface IFilteredMigration {
  config: IMygra;
  files: string[];
}

export interface IMigrationOptions {
  readonly name?: string;
  description?: string;
  template?: string;
  table?: string;
  defaults?: boolean;
  columns?: string[]
  up?: string;
  down?: string;
  [key: string]: any;
}

export interface IMygraConfig {
  readonly initialized: boolean;
  directory: string;
  active: [string, MigrateDirection];
  reverts: [string[], MigrateDirection];
  extension: string;
  templatePrefix: boolean;
}

export interface IMygra<C extends ConnectionHandler = ConnectionHandler> extends IMygraConfig {
  templates?: Record<string, CreateMigrationHandler>;
  connection?: C;
  events?: Events;
}

export interface IMigrationResult {
  names?: string[];
  type?: MigrateDirection;
  ok: boolean;
  message: string | Error;
  count: number;
  success?: number;
  failed?: number;
  migrated?: IMigration[];
  isPreview?: boolean;
}

export interface IMigrationCreateResult {
  ok: boolean;
  name: string;
  filename: string;
  message: string | Error;
}