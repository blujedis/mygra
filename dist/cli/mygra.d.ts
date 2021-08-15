/// <reference types="node" />
import { EventEmitter } from 'events';
import { ConnectionHandler, CreateMigrationHandler, IMigration, IMigrationCreateResult, IMigrationOptions, IMigrationResult, IMygra, MigrateDirection } from './types';
export declare class Mygra<C extends ConnectionHandler = ConnectionHandler> extends EventEmitter {
    options: IMygra<C>;
    constructor(options?: IMygra<ConnectionHandler>);
    private bindEvents;
    /**
     * Gets the directory where migrations are stored.
     */
    get directory(): string;
    get reverts(): [string[], MigrateDirection];
    /**
     * Gets the active migration.
     */
    get active(): [string, MigrateDirection];
    /**
     * The extension to use for filenames.
     */
    get extension(): string;
    get templates(): Record<string, CreateMigrationHandler>;
    /**
     * Gets the database connection.
     */
    get connection(): C;
    /**
     * Sets the active migration.
     */
    set active(state: [string, MigrateDirection]);
    /**
     * Sets the previous migration.
     */
    set reverts(state: [string[], MigrateDirection]);
    /**
      * Loads templates.
      *
      * @returns an object containing templates.
      */
    getTemplates(templates?: Record<string, CreateMigrationHandler>): Promise<Record<string, CreateMigrationHandler>>;
    /**
     * Loads migration filenames.
     *
     * @returns an array of migration file names.
     */
    getFilenames(): Promise<string[]>;
    /**
     * Gets a create migration handler template.
     *
     * @param name the name of the template to get.
     * @returns a create migration template handler.
     */
    getTemplate(name?: string): Promise<CreateMigrationHandler>;
    /**
     * Creates new migration.
     *
     * @param name the name of the migration to create.
     * @param options optional values to pass to creation handler.
     * @return true if successful.
     */
    create(name: string, options?: Omit<IMigrationOptions, 'name'>): Promise<IMigrationCreateResult>;
    /**
     * Creates new migration.
     *
     * @param options values to pass to creation handler.
     * @return true if successful.
     */
    create(options: IMigrationOptions): Promise<IMigrationCreateResult>;
    /**
     * Filters out filenames of migrations from name relative to last migration.
     *
     * @param name the name of the migration.
     * @param dir the direction of the migration.
     * @returns Promise<string[]>
     */
    filter(name: string, dir: MigrateDirection): Promise<string[]>;
    /**
     * Filters out filenames of migrations from name relative to last migration.
     *
     * @param name the name of the migration.
     * @param dir the direction of the migration.
     * @returns Promise<string[]>
     */
    filter(dir: MigrateDirection, levels?: number | '*'): Promise<string[]>;
    /**
     * Filters out filenames of migrations from name relative to last migration.
     *
     * @returns Promise<string[]>
     */
    filter(): Promise<string[]>;
    /**
     * Loads a single migration from file.
     *
     * @param filename the filename to be loaded.
     * @returns an IMigration instance from file.
     */
    import(filename: string): Promise<IMigration<ConnectionHandler>>;
    /**
     * Imports array of migrations by filename.
     *
     * @param filenames the file names to import/load.
     * @returns Promise<IMigration[]>;
     */
    load(filenames: string[]): Promise<IMigration<ConnectionHandler>[]>;
    /**
     * Migrates up automatically or by level count or name of migration.
     *
     * @param nameOrLevels the name or level count to migrate up.
     * @param preview returns a dry run.
     * @returns status, count affected and message.
     */
    up(nameOrLevels?: string | number, preview?: boolean): Promise<IMigrationResult>;
    /**
     * Migrates down automatically or by level count or name of migration.
     *
     * @param nameOrLevels the name or level count to migrate down.
     * @param preview returns a dry run.
     * @returns status, count affected and message.
     */
    down(nameOrLevels?: string | number, preview?: boolean): Promise<IMigrationResult>;
    /**
     * Reverts a list of migrations by calling the opposite direction
     * on the previously migrated files.
     *
     * @param migrations an array of migrations to revert.
     * @param dir the original direction of the migration
     * @param preview shows dry run of revert.
     * @returns status, count affected and message.
     */
    revert(migrations: IMigration[], dir: MigrateDirection, preview?: boolean): Promise<IMigrationResult>;
    /**
     * Revert all migrations.
     *
     * @param name migration name to reset to.
     */
    reset(preview?: boolean): Promise<IMigrationResult>;
}
