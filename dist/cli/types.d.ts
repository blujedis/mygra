export declare type MigrateDirection = 'up' | 'down';
export declare type CreateMigrationHandler = (options: IMigrationOptions) => string;
export declare type ConnectionHandler = (...args: any[]) => Promise<boolean>;
export declare const EVENTS: readonly ["created", "filtered", "loaded", "migration", "up", "down", "active", "revert"];
export declare type Event = typeof EVENTS[number];
export declare type Events = Record<keyof Event, ((...args: any[]) => void)[]>;
export interface IMigration<C extends ConnectionHandler = ConnectionHandler> {
    name: string;
    readonly description: string;
    readonly filename: string;
    up: (conn: C) => Promise<void>;
    down: (conn: C) => Promise<void>;
}
export interface IFilteredMigration {
    config: IMygra;
    files: string[];
}
export interface IMigrationOptions {
    name?: string;
    description?: string;
    template?: string;
    up?: string;
    down?: string;
}
export interface IMygraConfig {
    readonly initialized: boolean;
    directory: string;
    active: [string, MigrateDirection];
    reverts: [string[], MigrateDirection];
    extension: string;
}
export interface IMygra<C extends ConnectionHandler = ConnectionHandler> extends IMygraConfig {
    templates?: Record<string, CreateMigrationHandler>;
    connection?: C;
    events?: Events;
}
export interface IMigrationResult {
    names: string[];
    type: MigrateDirection;
    ok: boolean;
    message: string | Error;
    count: number;
}
export interface IMigrationCreateResult {
    ok: boolean;
    name: string;
    filename: string;
    message: string | Error;
}
