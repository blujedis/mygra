"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mygra = void 0;
const events_1 = require("events");
const fast_glob_1 = __importDefault(require("fast-glob"));
const path_1 = require("path");
const fs_1 = require("fs");
const templates_1 = __importDefault(require("./templates"));
const util_1 = require("util");
const utils_1 = require("./utils");
const config = utils_1.initConfig();
class Mygra extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        options.templates = Object.assign(Object.assign({}, templates_1.default), options.templates);
        this.options = Object.assign(Object.assign(Object.assign({}, config.props), { events: {}, connection: (..._args) => {
                throw new Error(`Database connection NOT implemented`);
            } }), options);
        this.bindEvents(this.options.events);
        config.update(Object.assign({}, this.options));
        this.duplicateNames().then(dupes => {
            if (dupes.length) {
                const err = utils_1.colorizeError(Error(`Please remove duplicate migration names:`));
                const stack = err.colorizedMessage + '\n' + dupes.join('\n') + '\n' + err.colorizedStack;
                throw stack;
            }
        });
    }
    bindEvents(events) {
        if (!events)
            return;
        for (const event in events) {
            const listeners = events[event] || [];
            for (const listener of listeners) {
                this.on(event, listener);
            }
        }
    }
    /**
     * Gets the directory where migrations are stored.
     */
    get directory() {
        return this.options.directory;
    }
    get reverts() {
        return this.options.reverts;
    }
    /**
     * Gets the active migration.
     */
    get active() {
        return this.options.active || [];
    }
    /**
     * The extension to use for filenames.
     */
    get extension() {
        return this.options.extension;
    }
    get templates() {
        return (this.options.templates || {});
    }
    /**
     * Gets the database connection.
     */
    get connection() {
        return this.options.connection;
    }
    /**
     * Sets the active migration.
     */
    set active(state) {
        if (!state || !state.length || typeof state[0] === 'undefined' || state[0] === '' || state[0] === null)
            return;
        this.emit('active', state);
        this.options.active = state;
        config.set('active', state);
    }
    /**
     * Sets the previous migration.
     */
    set reverts(state) {
        if (!state || !state.length || typeof state[0] === 'undefined' || state[0] === null)
            return;
        this.emit('reverts', state);
        this.options.reverts = state;
        config.set('reverts', state);
    }
    /**
      * Loads templates.
      *
      * @returns an object containing templates.
      */
    getTemplates(templates = this.templates) {
        return __awaiter(this, void 0, void 0, function* () {
            const templatesDir = path_1.join(this.directory, 'templates');
            const hasTemplates = fs_1.existsSync(templatesDir);
            const _templates = templates;
            // If user templates directory load them.
            if (hasTemplates) {
                const files = fast_glob_1.default.sync(`${templatesDir}/*${this.extension}`, { onlyFiles: true });
                for (const file of files) {
                    const base = utils_1.getBaseName(file);
                    const result = yield Promise.resolve().then(() => __importStar(require(file)));
                    _templates[base] = result.default || result;
                }
            }
            return _templates;
        });
    }
    /**
     * Loads migration filenames.
     *
     * @returns an array of migration file names.
     */
    getFilenames() {
        return __awaiter(this, void 0, void 0, function* () {
            let files = yield fast_glob_1.default(`${this.directory}/migrations/**/*${this.extension}`, { onlyFiles: true });
            files = files.sort().reverse().map(f => path_1.resolve(f));
            return files;
        });
    }
    /**
     * Gets a create migration handler template.
     *
     * @param name the name of the template to get.
     * @returns a create migration template handler.
     */
    getTemplate(name = 'default') {
        return __awaiter(this, void 0, void 0, function* () {
            const templates = yield this.getTemplates();
            return templates[name];
        });
    }
    /**
     * Verifies that the provided migration name is unique.
     *
     * @param name the name to be inspected
     * @returns a boolean indicating if the name is unique.
     */
    isUniqueName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const filenames = yield this.getFilenames();
            const stripped = filenames.map(v => path_1.parse(v).name.replace(/^\d+_/, ''));
            const found = stripped.findIndex(v => v.indexOf(name));
            return found === -1;
        });
    }
    /**
     * Gets list of duplicate migration names.
     *
     * @returns object indicating duplicates and their names.
     */
    duplicateNames() {
        return __awaiter(this, void 0, void 0, function* () {
            let filenames = yield this.getFilenames();
            filenames = filenames.map(name => {
                const base = path_1.basename(name);
                return base.replace(/^\d+_/, '').replace(path_1.extname(name), '');
            });
            if (filenames.length === 1)
                return [];
            const found = [];
            return filenames.filter(v => {
                const isDupe = found.includes(v);
                found.push(v);
                return isDupe;
            });
        });
    }
    /**
     * Checks if the current active migration is the first migration
     * and has a current migration direction of down.
     *
     * @param files the filenames to be inspected.
     * @param active the active migration.
     * @returns a boolean indicating if is first migration.
     */
    isFirstMigration(files, active) {
        const clone = [...files].sort();
        const [name, dir] = active;
        const idx = clone.findIndex(v => v.indexOf(name) !== -1);
        return idx === 0 && dir === 'down';
    }
    create(nameOrOptions, options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let name = nameOrOptions;
            if (typeof nameOrOptions === 'object') {
                options = nameOrOptions;
                name = undefined;
            }
            options = Object.assign({ up: '', down: '' }, options);
            if (!options.name)
                throw new Error(`Cannot create migration with name of undefined.`);
            let baseName = options.name.replace(/\s/g, '_').toLowerCase();
            options.table = options.table || baseName;
            // Check if should prefix name with the template
            // name, for ex: generate:create user_table will
            // become create_user_table.
            baseName = this.options.templatePrefix
                ? options.template + '_' + baseName
                : baseName;
            const isUnique = yield this.isUniqueName(baseName);
            if (!isUnique)
                return {
                    ok: false,
                    name,
                    message: `Cannot create duplicate migration name: "${baseName}"`
                };
            name = Date.now() + '_' + baseName;
            const filename = path_1.join(this.directory, 'migrations', name + this.extension);
            try {
                const template = yield this.getTemplate(options.template);
                options.up = ((_a = options.up) === null || _a === void 0 ? void 0 : _a.length) ? "`" + options.up + "`" : "`" + "`";
                options.down = ((_b = options.down) === null || _b === void 0 ? void 0 : _b.length) ? "`" + options.down + "`" : "`" + "`";
                const writeResult = yield utils_1.writeFileAsync(filename, template(Object.assign(Object.assign({}, options), { name: baseName })));
                this.emit('created', { name, filename, ok: writeResult || false });
                return {
                    ok: writeResult || false,
                    name,
                    message: writeResult === true
                        ? ` Migration "${name}" succesfully created`
                        : ` Migration "${name}" was NOT created`,
                    filename
                };
            }
            catch (err) {
                return {
                    ok: false,
                    name,
                    message: err,
                    filename
                };
            }
        });
    }
    filter(nameOrDir, dirOrLevels) {
        return __awaiter(this, void 0, void 0, function* () {
            let name = nameOrDir;
            let dir = dirOrLevels;
            let levels;
            if (['up', 'down'].includes(nameOrDir)) {
                levels = (dirOrLevels || 0);
                if (dirOrLevels === '*')
                    levels = 999999;
                dir = nameOrDir;
                name = undefined;
            }
            // levels only used when name not present
            // default to one step or level user can
            // define if they want more.
            levels = levels || 1;
            const [active, activeDir] = this.active;
            const files = yield this.getFilenames();
            const isFirst = this.isFirstMigration(files, this.active);
            const idx = utils_1.findIndex(files, name);
            // used to shift index depending on last
            // active direction of migration.
            const offset = activeDir === 'down' ? 1 : 0;
            let lastIdx = utils_1.findIndex(files, active);
            lastIdx = !active || isFirst ? files.length : lastIdx;
            let filtered = files;
            if (name && idx === -1)
                throw new Error(`Migration ${name} required but not found.`);
            if (name) {
                dir = dir || 'up';
                if (dir === 'up') {
                    filtered = files.slice(idx, lastIdx + offset);
                }
                else {
                    filtered = files.slice(lastIdx + offset, idx + 1 + offset);
                }
            }
            else if (dir) {
                if (dir === 'up') {
                    filtered = files.slice(0, lastIdx + offset);
                    filtered = levels ? filtered.slice(-levels) : filtered;
                }
                else {
                    levels = levels || 1;
                    return files.slice(lastIdx + offset, lastIdx + offset + levels);
                }
            }
            this.emit('filtered', { name, direction: dir, filenames: filtered, levels });
            return filtered;
        });
    }
    /**
     * Loads a single migration from file.
     *
     * @param filename the filename to be loaded.
     * @returns an IMigration instance from file.
     */
    import(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = yield Promise.resolve().then(() => __importStar(require(filename)));
            Object.defineProperty(file, 'filename', {
                value: filename
            });
            return file;
        });
    }
    /**
     * Imports array of migrations by filename.
     *
     * @param filenames the file names to import/load.
     * @returns Promise<IMigration[]>;
     */
    load(filenames) {
        return __awaiter(this, void 0, void 0, function* () {
            const proms = filenames.map(filename => this.import(filename));
            const migrations = yield Promise.all(proms);
            this.emit('loaded', { filenames, migrations });
            return migrations;
        });
    }
    /**
     * Checks if is preview or filtered files are out of scope.
     *
     * @param dir the direction of the migration.
     * @param files the files to be migrated.
     * @param preview indicates preview mode requested.
     * @returns IMigrationResult.
     */
    checkPreviewAndScope(dir, migrations, preview = false) {
        const message = preview
            ? 'Migration Preview'
            : `Migration out of scope, no files match request`;
        const names = preview ? migrations.map(m => path_1.parse(m.filename).name) : [];
        const count = migrations.length;
        return {
            type: dir,
            ok: !!migrations.length,
            message,
            count,
            success: 0,
            failed: 0,
            names,
            isPreview: preview
        };
    }
    // /**
    //  * Iterates in series the migrations.
    //  * 
    //  * @param dir the direction of the migration
    //  * @param files the file list being migration.
    //  * @param migrations the loaded migrations.
    //  * @returns IMigrationResult
    //  */
    // async run(dir: MigrateDirection, migrations: IMigration[]) {
    //   const migrated = [] as IMigration[];
    //   let count = 0;
    //   for (const [, file] of migrations.entries()) {
    //     this.emit(dir, file);
    //     const fn = promisifyMigration(file[dir]);
    //     await fn(this.connection);
    //     count += 1;
    //     migrated.push(file);
    //   }
    //   return {
    //     names: migrated.map(m => m.filename),
    //     type: dir,
    //     ok: count === migrated.length,
    //     count,
    //     migrated,
    //   } as IMigrationResult;
    // }
    /**
     * Migrates up automatically or by level count or name of migration.
     *
     * @param nameOrLevels the name or level count to migrate up.
     * @param preview returns a dry run.
     * @returns status, count affected and message.
     */
    up(nameOrLevels, preview = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let files;
            let result = { type: 'up', ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] };
            let count = 0;
            let success = 0;
            const migrated = [];
            try {
                if (typeof nameOrLevels === 'number' || nameOrLevels === '*')
                    files = yield this.filter('up', nameOrLevels);
                else
                    files = yield this.filter(nameOrLevels, 'up');
                files.sort(); // ascending order.
                const migrations = yield this.load(files);
                count = migrations.length;
                result = this.checkPreviewAndScope('up', migrations, preview);
                if (!result.ok || result.isPreview)
                    return result;
                for (const [, file] of migrations.entries()) {
                    this.emit('up', file);
                    const fn = utils_1.promisifyMigration(file['up']);
                    yield fn(this.connection)
                        .then(_ => {
                        success += 1;
                        migrated.push(file);
                    });
                }
                result.ok = count === success;
            }
            catch (err) {
                if (migrated.length)
                    yield (this.revert(migrated, 'up'));
                result = Object.assign(Object.assign({}, result), { ok: false, message: err, names: migrated.map(m => m.filename) });
            }
            result.count = count;
            result.success = success;
            result.failed = Math.max(0, count - success);
            if (result.ok) {
                result.message = `Migration up successful`;
                result.names = migrated.map(m => m.filename);
            }
            // Update the active migration when
            // result status is ok store last migration run.
            if (result.ok && migrated.length) {
                this.reverts = utils_1.defineReverts(migrated, 'up');
                this.active = utils_1.defineActive(migrated, 'up');
            }
            this.emit('migration', result);
            return result;
        });
    }
    /**
     * Migrates down automatically or by level count or name of migration.
     *
     * @param nameOrLevels the name or level count to migrate down.
     * @param preview returns a dry run.
     * @returns status, count affected and message.
     */
    down(nameOrLevels, preview = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let files;
            let result = { type: 'up', ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] };
            let count = 0;
            let success = 0;
            const migrated = [];
            try {
                if (typeof nameOrLevels === 'number' || nameOrLevels === '*')
                    files = yield this.filter('down', nameOrLevels);
                else
                    files = yield this.filter(nameOrLevels, 'down');
                const migrations = yield this.load(files);
                count = migrations.length;
                result = this.checkPreviewAndScope('up', migrations, preview);
                if (!result.ok || result.isPreview)
                    return result;
                for (const [, file] of migrations.entries()) {
                    this.emit('down', file);
                    const fn = utils_1.promisifyMigration(file['down']);
                    yield fn(this.connection)
                        .then(_ => {
                        success += 1;
                        migrated.push(file);
                    });
                }
                result.ok = count === success;
            }
            catch (err) {
                if (migrated.length)
                    yield (this.revert(migrated, 'down'));
                result = Object.assign(Object.assign({}, result), { ok: false, message: err, names: migrated.map(m => m.filename) });
            }
            result.count = count;
            result.success = success;
            result.failed = Math.max(0, count - success);
            if (result.ok) {
                result.message = `Migration down successful`;
                result.names = migrated.map(m => m.filename);
            }
            // Update the active migration when
            // result status is ok store last migration run.
            if (result.ok && migrated.length) {
                this.reverts = utils_1.defineReverts(migrated, 'down');
                this.active = utils_1.defineActive(migrated, 'down');
            }
            this.emit('migration', result);
            return result;
        });
    }
    /**
     * Reverts a list of migrations by calling the opposite direction
     * on the previously migrated files.
     *
     * @param migrations an array of migrations to revert.
     * @param dir the original direction of the migration
     * @param preview shows dry run of revert.
     * @returns status, count affected and message.
     */
    revert(migrations, dir, preview = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const clone = [...migrations];
            const newDir = dir === 'up' ? 'down' : 'up';
            let result = { type: newDir, ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] };
            let revertNames = [];
            let last;
            let name = '';
            const count = migrations.length;
            let success = 0;
            const migrated = [];
            try {
                // Ensure migrations are in correct order
                // using timestamped filenames.
                if (dir === 'up') {
                    // we'll be descending so we need last first.
                    clone.sort().reverse();
                }
                else {
                    // we'll be ascending as we are reverting a down
                    // sort ensuring that the oldest is first.
                    clone.sort();
                }
                // The revert migration names will now be the opposite
                // of whatever the clone order is.
                revertNames = [...clone].reverse().map(file => utils_1.getBaseName(file.filename));
                // Get last to store as active migration.
                last = clone[clone.length - 1];
                name = utils_1.getBaseName(last.filename);
                result = this.checkPreviewAndScope('up', clone, preview);
                if (!result.count || result.isPreview)
                    return result;
                for (const [, file] of migrations.entries()) {
                    this.emit(newDir, file);
                    const fn = utils_1.promisifyMigration(file[newDir]);
                    yield fn(this.connection)
                        .then(_ => {
                        success += 1;
                        migrated.push(file);
                    });
                }
                result.ok = count === success;
            }
            catch (err) {
                result = Object.assign(Object.assign({}, result), { ok: false, message: err, names: migrated.map(m => m.filename) });
            }
            result.count = count;
            result.success = success;
            result.failed = Math.max(0, count - success);
            if (result.ok) {
                result.message = `Revert Migration ${newDir} successful`;
                result.names = migrated.map(m => m.filename);
            }
            if (result.ok && migrated.length) {
                this.reverts = [revertNames, newDir];
                this.active = [name, newDir];
            }
            this.emit('migration', result);
            return result;
        });
    }
    /**
     * Revert all migrations.
     *
     * @param name migration name to reset to.
     */
    reset(preview = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = { type: 'down', ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] };
            let count = 0;
            let success = 0;
            const migrated = [];
            try {
                const files = yield this.filter('down', '*');
                const migrations = yield this.load(files);
                count = migrations.length;
                if (!files.length) {
                    return Object.assign(Object.assign({}, result), { message: `Migration out of scope, no files match request`, count, names: migrated.map(m => m.filename) });
                }
                else if (preview) {
                    return Object.assign(Object.assign({}, result), { ok: true, message: 'Migration preview', count: files.length, names: files });
                }
                else {
                    for (const [i, file] of migrations.entries()) {
                        const name = path_1.parse(files[i]).name;
                        this.emit('down', { name, revert: true });
                        yield util_1.promisify(file.down)(this.connection)
                            .then(_ => {
                            migrated.push(file);
                            success += 1;
                        });
                    }
                    result.ok = count === success;
                }
            }
            catch (err) {
                if (migrated.length)
                    yield (this.revert(migrated, 'down'));
                result = Object.assign(Object.assign({}, result), { ok: false, message: err, count });
            }
            result.count = count;
            result.success = success;
            result.failed = Math.max(0, count - success);
            result.names = migrated.map(m => m.filename);
            if (result.ok)
                result.message = `Migration reset successful`;
            // Update the active migration when
            // result status is ok store last migration run.
            if (result.ok && migrated.length) {
                this.reverts = utils_1.defineReverts(migrated, 'down');
                this.active = utils_1.defineActive(migrated, 'down');
            }
            this.emit('migration', result);
            return result;
        });
    }
}
exports.Mygra = Mygra;
