"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promisifyMigration = exports.getBaseName = exports.colorizeError = exports.defineReverts = exports.defineActive = exports.isPromise = exports.initConfig = exports.colorize = exports.readJSONSync = exports.writeFileAsync = exports.readFileAsync = exports.findIndex = exports.isMatch = exports.MYGRA_DEFAULTS = exports.MYGRA_CONFIG_PATH = exports.MYGRA_DEFAULT_PATH = exports.MYGRA_CONFIG_DIR = exports.APP_PKG = exports.PKG = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const os_1 = require("os");
const log_symbols_1 = __importDefault(require("log-symbols"));
const ansi_colors_1 = __importDefault(require("ansi-colors"));
const flat_cache_1 = __importDefault(require("flat-cache"));
const pkgPath = __dirname.indexOf('cli') !== -1
    ? path_1.join(__dirname, '../../package.json')
    : path_1.join(__dirname, '../../package.json');
exports.PKG = readJSONSync(pkgPath);
exports.APP_PKG = readJSONSync(path_1.join(process.cwd(), 'package.json'));
exports.MYGRA_CONFIG_DIR = path_1.join(os_1.homedir(), '.mygra');
exports.MYGRA_DEFAULT_PATH = path_1.join(process.cwd(), 'mygra');
exports.MYGRA_CONFIG_PATH = path_1.join(os_1.homedir(), '.mygra');
exports.MYGRA_DEFAULTS = {
    initialized: true,
    directory: exports.MYGRA_DEFAULT_PATH,
    active: [],
    reverts: [],
    extension: '.js',
    templatePrefix: true
};
/**
 * Inspects a string matching by supplied pattern.
 *
 * @param value the value to inspect.
 * @param pattern a pattern to check for matching.
 * @returns a boolean indicating if the value matches pattern.
 */
function isMatch(value, pattern) {
    if (typeof pattern === 'string')
        return value.indexOf(pattern) !== -1;
    return pattern.test(value);
}
exports.isMatch = isMatch;
/**
 * Finds the index of a matched element in an array.
 *
 * @param values the string values to inspect.
 * @param pattern the pattern used for matching.
 * @returns the index of a matched element.
 */
function findIndex(values, pattern) {
    if (typeof pattern === 'undefined' || pattern === '')
        return -1;
    return values.findIndex(currentFile => isMatch(currentFile, pattern));
}
exports.findIndex = findIndex;
/**
 * Reads a file asynchronously.
 *
 * @param path the path to be read.
 * @returns a file as string.
 */
function readFileAsync(path) {
    return new Promise((res, rej) => {
        fs_extra_1.readFile(path, 'utf8', (err, data) => {
            if (err)
                rej(err);
            return res(data);
        });
    });
}
exports.readFileAsync = readFileAsync;
/**
 * Writes a file asynchronously.
 *
 * @param path the path to write to.
 * @param data the data to be written.
 * @returns a boolean indicating if successful write.
 */
function writeFileAsync(path, data) {
    data = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    return new Promise((res, rej) => {
        fs_extra_1.writeFile(path, data, (err) => {
            if (err) {
                console.error(err.name + ': ' + err.message);
                rej(err);
            }
            res(true);
        });
    });
}
exports.writeFileAsync = writeFileAsync;
/**
 * Reads JSON returning as a parsed object of specified type.
 *
 * @param path the path to be read.
 * @param defaults defaults to use when not found.
 * @returns a JSON parsed object.
 */
function readJSONSync(path, defaults = {}) {
    if (!fs_extra_1.existsSync(path))
        return defaults;
    return JSON.parse(fs_extra_1.readFileSync(path, 'utf-8'));
}
exports.readJSONSync = readJSONSync;
/**
 * Colorizes a string with ansi colors.
 *
 * @param str the string to be colorized.
 * @param styles the styles to be applied.
 * @returns a ansi colorized string.
 */
function colorize(str, ...styles) {
    return styles.reduce((a, c) => {
        if (!ansi_colors_1.default[c])
            return a;
        return ansi_colors_1.default[c](a);
    }, str);
}
exports.colorize = colorize;
/**
 *
 * @param name the name of the config to create.
 * @param directory the directory where the config is to be stored.
 * @returns
 */
function initConfig(name = exports.APP_PKG.name, directory = exports.MYGRA_CONFIG_DIR) {
    const filename = `${name}.config.json`;
    const fullpath = path_1.join(directory, filename);
    const config = flat_cache_1.default.load(`${name}.config.json`, directory);
    const api = {
        get props() {
            return config.all();
        },
        directory,
        filename,
        fullpath,
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
    function defaults(initDefaults = {}) {
        set(Object.assign(Object.assign({}, initDefaults), config.all()));
    }
    /**
     * Gets a key's value from config store.
     *
     * @param key the get to get.
     */
    function get(key) {
        return config.getKey(key);
    }
    function set(keyOrObject, value) {
        let obj = keyOrObject;
        if (arguments.length > 1)
            obj = {
                [keyOrObject]: value
            };
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
    function update(obj) {
        const keys = Object.keys(exports.MYGRA_DEFAULTS);
        for (const k in obj) {
            if (keys.includes(k))
                config.setKey(k, obj[k]);
        }
        config.save();
    }
    if (!config.getKey('initialized'))
        defaults(exports.MYGRA_DEFAULTS);
    return api;
}
exports.initConfig = initConfig;
/**
 * Checks if the value is a promise.
 *
 * @param value the value to inspect as a promise.
 */
function isPromise(value) {
    return Promise.resolve(value) === value;
}
exports.isPromise = isPromise;
/**
 * Helper to format the last or active migration for storage.
 *
 * @param migrations the array of successful migrations.
 * @param dir the migration direction.
 * @returns a tuple containing last migration and direction.
 */
function defineActive(migrations, dir) {
    const last = migrations[migrations.length - 1].filename;
    return [getBaseName(last), dir];
}
exports.defineActive = defineActive;
/**
 * Helper to format the last migrations for reverting.
 *
 * @param migrations the array of successful migrations.
 * @param dir the migration direction.
 * @returns a tuple containing last migrations and direction.
 */
function defineReverts(migrations, dir) {
    const clone = [...migrations].reverse(); // reverse so we traverse in opposite order.
    const names = clone.map(file => getBaseName(file.filename));
    // Don't flip direction here as mygra.revert() will do that automatically.
    return [names, dir];
}
exports.defineReverts = defineReverts;
/**
 * Makes errors more readable.
 *
 * @param err the error to addd colorization to.
 */
function colorizeError(err) {
    const _err = err;
    _err.colorizedMessage = log_symbols_1.default.error + ' ' + colorize((err.name || 'Error') + ': ' + err.message || 'Unknown', 'redBright');
    _err.colorizedStack = colorize((err.stack || '').split('\n').slice(1).join('\n'), 'dim');
    return _err;
}
exports.colorizeError = colorizeError;
/**
 * Gets the base name of a file path with or without file extension.
 *
 * @param filepath the full path to the file.
 * @param includeExt when true the file extension is retained.
 * @returns the filename only from the specified path.
 */
function getBaseName(filepath, includeExt = false) {
    filepath = path_1.basename(filepath);
    if (includeExt)
        return filepath;
    return filepath.replace(path_1.extname(filepath), '');
}
exports.getBaseName = getBaseName;
function promisifyMigration(fn) {
    return (conn) => {
        return new Promise((res, rej) => {
            const prom = fn(conn, (err, data) => {
                if (err)
                    return rej(err);
                return res(data);
            });
            if (!isPromise(prom))
                return prom;
            return prom.then(res).catch(rej);
        });
    };
}
exports.promisifyMigration = promisifyMigration;
