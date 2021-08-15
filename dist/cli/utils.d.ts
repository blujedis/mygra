import { StylesType } from 'ansi-colors';
import { IMigration, IMygraConfig, MigrateDirection } from './types';
export declare const PKG: Record<string, any>;
export declare const APP_PKG: Record<string, any>;
export declare const MYGRA_CONFIG_DIR: string;
export declare const MYGRA_DEFAULT_PATH: string;
export declare const MYGRA_CONFIG_PATH: string;
export declare const MYGRA_DEFAULTS: IMygraConfig;
/**
 * Inspects a string matching by supplied pattern.
 *
 * @param value the value to inspect.
 * @param pattern a pattern to check for matching.
 * @returns a boolean indicating if the value matches pattern.
 */
export declare function isMatch(value: string, pattern: string | RegExp): boolean;
/**
 * Finds the index of a matched element in an array.
 *
 * @param values the string values to inspect.
 * @param pattern the pattern used for matching.
 * @returns the index of a matched element.
 */
export declare function findIndex(values: string[], pattern: string | RegExp): number;
/**
 * Reads a file asynchronously.
 *
 * @param path the path to be read.
 * @returns a file as string.
 */
export declare function readFileAsync(path: string): Promise<string>;
/**
 * Writes a file asynchronously.
 *
 * @param path the path to write to.
 * @param data the data to be written.
 * @returns a boolean indicating if successful write.
 */
export declare function writeFileAsync(path: string, data: string | object): Promise<boolean>;
/**
 * Reads JSON returning as a parsed object of specified type.
 *
 * @param path the path to be read.
 * @param defaults defaults to use when not found.
 * @returns a JSON parsed object.
 */
export declare function readJSONSync<T = Record<string, any>>(path: string, defaults?: T): T;
/**
 * Colorizes a string with ansi colors.
 *
 * @param str the string to be colorized.
 * @param styles the styles to be applied.
 * @returns a ansi colorized string.
 */
export declare function colorize(str: string, ...styles: (keyof StylesType<any>)[]): string;
/**
 *
 * @param name the name of the config to create.
 * @param directory the directory where the config is to be stored.
 * @returns
 */
export declare function initConfig<T extends Record<string, any>>(name?: any, directory?: string): {
    readonly props: {
        [key: string]: any;
    };
    defaults: (initDefaults?: Partial<T>) => void;
    get: (key: string) => any;
    set: {
        (key: string, value: any): void;
        (obj: Partial<T>): any;
    };
    update: (obj: Partial<T>) => void;
    save: (noPrune?: boolean | undefined) => void;
};
/**
 * Checks if the value is a promise.
 *
 * @param value the value to inspect as a promise.
 */
export declare function isPromise<T = any>(value: unknown): value is Promise<T>;
/**
 * Helper to format the last or active migration for storage.
 *
 * @param migrations the array of successful migrations.
 * @param dir the migration direction.
 * @returns a tuple containing last migration and direction.
 */
export declare function defineActive(migrations: IMigration[], dir: MigrateDirection): [string, MigrateDirection];
/**
 * Helper to format the last migrations for reverting.
 *
 * @param migrations the array of successful migrations.
 * @param dir the migration direction.
 * @returns a tuple containing last migrations and direction.
 */
export declare function defineReverts(migrations: IMigration[], dir: MigrateDirection): [string[], MigrateDirection];
/**
 * Makes errors more readable.
 *
 * @param err the error to addd colorization to.
 */
export declare function colorizeError(err: Error): Error & {
    colorizedMessage: string;
    colorizedStack: string;
};
/**
 * Gets the base name of a file path with or without file extension.
 *
 * @param filepath the full path to the file.
 * @param includeExt when true the file extension is retained.
 * @returns the filename only from the specified path.
 */
export declare function getBaseName(filepath: string, includeExt?: boolean): string;
