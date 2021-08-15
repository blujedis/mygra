import { existsSync, readFile, readFileSync, writeFile } from 'fs-extra';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import colors, { StylesType } from 'ansi-colors';
import flatCache from 'flat-cache';
import { IMigration, IMygraConfig, MigrateDirection } from './types';

const pkgPath = __dirname.indexOf('cli') !== -1
  ? join(__dirname, '../../package.json')
  : join(__dirname, '../../package.json')

export const PKG = readJSONSync(pkgPath);
export const APP_PKG = readJSONSync(join(process.cwd(), 'package.json'));
export const MYGRA_CONFIG_DIR = join(homedir(), '.mygra');
export const MYGRA_DEFAULT_PATH = join(process.cwd(), 'mygra');
export const MYGRA_CONFIG_PATH = join(homedir(), '.mygra');
export const MYGRA_DEFAULTS: IMygraConfig = {
  initialized: true,
  directory: MYGRA_DEFAULT_PATH,
  active: [] as any,
  reverts: [] as any,
  extension: '.js'
};

/**
 * Inspects a string matching by supplied pattern.
 * 
 * @param value the value to inspect.
 * @param pattern a pattern to check for matching.
 * @returns a boolean indicating if the value matches pattern.
 */
export function isMatch(value: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string')
    return value.indexOf(pattern) !== -1;
  return pattern.test(value);
}

/**
 * Finds the index of a matched element in an array.
 * 
 * @param values the string values to inspect.
 * @param pattern the pattern used for matching.
 * @returns the index of a matched element.
 */
export function findIndex(values: string[], pattern: string | RegExp): number {
  if (typeof pattern === 'undefined' || pattern === '')
    return -1;
  return values.findIndex(currentFile => isMatch(currentFile, pattern));
}

/**
 * Reads a file asynchronously. 
 * 
 * @param path the path to be read. 
 * @returns a file as string.
 */
export function readFileAsync(path: string): Promise<string> {
  return new Promise((res, rej) => {
    readFile(path, 'utf8', (err, data) => {
      if (err)
        rej(err);
      return res(data as any);
    });
  });
}

/**
 * Writes a file asynchronously.
 * 
 * @param path the path to write to.
 * @param data the data to be written.
 * @returns a boolean indicating if successful write.
 */
export function writeFileAsync(path: string, data: string | object): Promise<boolean> {
  data = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
  return new Promise((res, rej) => {
    writeFile(path, data as string, (err) => {
      if (err) {
        console.error(err.name + ': ' + err.message);
        rej(err);
      }
      res(true);
    });
  });
}

/**
 * Reads JSON returning as a parsed object of specified type.
 * 
 * @param path the path to be read.
 * @param defaults defaults to use when not found.
 * @returns a JSON parsed object.
 */
export function readJSONSync<T = Record<string, any>>(path: string, defaults = {} as T): T {
  if (!existsSync(path))
    return defaults;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * Colorizes a string with ansi colors.
 * 
 * @param str the string to be colorized.
 * @param styles the styles to be applied.
 * @returns a ansi colorized string.
 */
export function colorize(str: string, ...styles: (keyof StylesType<any>)[]) {
  return styles.reduce((a, c) => {
    if (!colors[c])
      return a;
    return colors[c](a);
  }, str);
}

/**
 * 
 * @param name the name of the config to create.
 * @param directory the directory where the config is to be stored.
 * @returns 
 */
export function initConfig<T extends Record<string, any>>(name = APP_PKG.name, directory = MYGRA_CONFIG_DIR) {

  const config = flatCache.load(`${name}.config.json`, directory);

  const api = {
    get props() {
      return config.all();
    },
    defaults,
    get,
    set,
    update,
    save: config.save
  };

  /**
   * Initialize the configuration merging defaults.
   * 
   * @param defaults optional defaults.
   */
  function defaults(initDefaults = {} as Partial<T>) {
    set({ ...initDefaults, ...config.all() });
  }

  /**
   * Gets a key's value from config store.
   * 
   * @param key the get to get.
   */
  function get(key: string) {
    return config.getKey(key);
  }

  /**
   * Sets key value in config store.
   * 
   * @param key the key to be set.  
   * @param value the value to be set for key.
   */
  function set(key: string, value: any): void;

  /**
   * Sets all keys in the provided object.
   * 
   * @param obj updates entire object.  
   */
  function set(obj: Partial<T>);
  function set(keyOrObject: string | Partial<T>, value?: any) {
    let obj = keyOrObject as Partial<T>;
    if (arguments.length > 1)
      obj = {
        [keyOrObject as string]: value
      } as Partial<T>;
    for (const k in obj) {
      config.setKey(k, obj[k]);
    }
    config.save(true);
  }

  /**
   * Updates config only for known keys.
   * 
   * @param obj the config object to update from.
   */
  function update(obj: Partial<T>) {
    const keys = Object.keys(MYGRA_DEFAULTS);
    for (const k in obj) {
      if (keys.includes(k))
        config.setKey(k, obj[k]);
    }
    config.save();
  }

  if (!config.getKey('initialized'))
    defaults(MYGRA_DEFAULTS as unknown as T);

  return api;

}

/**
 * Checks if the value is a promise.
 * 
 * @param value the value to inspect as a promise.
 */
export function isPromise<T = any>(value: unknown): value is Promise<T> {
  return Promise.resolve(value) === value;
}

/**
 * Helper to format the last or active migration for storage.
 * 
 * @param migrations the array of successful migrations.
 * @param dir the migration direction.
 * @returns a tuple containing last migration and direction.
 */
export function defineActive(migrations: IMigration[], dir: MigrateDirection) {
  return [basename(migrations[migrations.length - 1].filename), dir] as [string, MigrateDirection];
}

/**
 * Helper to format the last migrations for reverting.
 * 
 * @param migrations the array of successful migrations.
 * @param dir the migration direction.
 * @returns a tuple containing last migrations and direction.
 */
export function defineReverts(migrations: IMigration[], dir: MigrateDirection) {
  const clone = [...migrations].reverse(); // reverse so we traverse in opposite order.
  const names = clone.map(file => basename(file.filename).replace(extname(file.filename), ''));
  // Don't flip direction here as mygra.revert() will do that automatically.
  return [names, dir] as [string[], MigrateDirection];
}
