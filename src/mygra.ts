import { EventEmitter } from 'events';
import glob from 'fast-glob';
import { join, basename, resolve, parse, extname } from 'path';
import { existsSync } from 'fs';
import defaultTemplates from './templates';
import { promisify } from 'util';
import { findIndex, writeFileAsync, initConfig, defineActive, defineReverts, colorizeError, getBaseName, promisifyMigration } from './utils';
import { ConnectionHandler, CreateMigrationHandler, Events, IMigration, IMigrationCreateResult, IMigrationOptions, IMigrationResult, IMygra, MigrateDirection } from './types';

const config = initConfig();

export class Mygra<C extends ConnectionHandler = ConnectionHandler> extends EventEmitter {

  options!: IMygra<C>;

  constructor(options = {} as IMygra) {

    super();

    options.templates = { ...defaultTemplates, ...options.templates };
    this.options = {
      ...config.props,
      events: {},
      connection: (..._args: any[]) => {
        throw new Error(`Database connection NOT implemented`);
      },
      ...options
    } as Required<IMygra<C>>;

    this.bindEvents(this.options.events);
    config.update({ ...this.options });

    this.duplicateNames().then(dupes => {
      if (dupes.length) {
        const err = colorizeError(Error(`Please remove duplicate migration names:`));
        const stack = err.colorizedMessage + '\n' + dupes.join('\n') + '\n' + err.colorizedStack;
        throw stack;
      }
    });

  }

  private bindEvents(events?: Events) {
    if (!events) return;
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
    return this.options.directory
  }

  get reverts() {
    return this.options.reverts;
  }

  /**
   * Gets the active migration.
   */
  get active() {
    return this.options.active || [] as unknown as [string, MigrateDirection];
  }

  /**
   * The extension to use for filenames.
   */
  get extension() {
    return this.options.extension
  }

  get templates() {
    return (this.options.templates || {}) as Record<string, CreateMigrationHandler>
  }

  /**
   * Gets the database connection.
   */
  get connection() {
    return this.options.connection as C;
  }

  /**
   * Sets the active migration.
   */
  set active(state: [string, MigrateDirection]) {
    if (!state || !state.length || typeof state[0] === 'undefined' || state[0] === '' || state[0] === null)
      return;
    this.emit('active', state);
    this.options.active = state;
    config.set('active', state);
  }

  /**
   * Sets the previous migration.
   */
  set reverts(state: [string[], MigrateDirection]) {
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
  async getTemplates(templates: Record<string, CreateMigrationHandler> = this.templates) {

    const templatesDir = join(this.directory, 'templates');
    const hasTemplates = existsSync(templatesDir);

    const _templates = templates;

    // If user templates directory load them.
    if (hasTemplates) {
      const files = glob.sync(`${templatesDir}/*${this.extension}`, { onlyFiles: true });
      for (const file of files) {
        const base = getBaseName(file);
        const result = await import(file) as CreateMigrationHandler;
        _templates[base] = (result as any).default || result;
      }
    }

    return _templates;

  }

  /**
   * Loads migration filenames.
   * 
   * @returns an array of migration file names.
   */
  async getFilenames() {
    let files = await glob(`${this.directory}/migrations/**/*${this.extension}`, { onlyFiles: true });
    files = files.sort().reverse().map(f => resolve(f));
    return files;
  }

  /**
   * Gets a create migration handler template.
   * 
   * @param name the name of the template to get.
   * @returns a create migration template handler.
   */
  async getTemplate(name = 'default') {
    const templates = await this.getTemplates();
    return templates[name];
  }

  /**
   * Verifies that the provided migration name is unique.
   * 
   * @param name the name to be inspected
   * @returns a boolean indicating if the name is unique.
   */
  async isUniqueName(name: string) {
    const filenames = await this.getFilenames();
    const stripped = filenames.map(v => parse(v).name.replace(/^\d+_/, ''));
    const found = stripped.findIndex(v => {
      return v.indexOf(name) !== -1;
    });
    return found === -1;
  }

  /**
   * Gets list of duplicate migration names.
   * 
   * @returns object indicating duplicates and their names.
   */
  async duplicateNames() {
    let filenames = await this.getFilenames();
    filenames = filenames.map(name => {
      const base = basename(name);
      return base.replace(/^\d+_/, '').replace(extname(name), '');
    });
    if (filenames.length === 1)
      return [];
    const found = [] as string[];
    return filenames.filter(v => {
      const isDupe = found.includes(v);
      found.push(v);
      return isDupe;
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
  isFirstMigration(files: string[], active: [string, string]) {
    const clone = [...files].sort();
    const [name, dir] = active;
    const idx = clone.findIndex(v => v.indexOf(name) !== -1);
    return idx === 0 && dir === 'down';
  }

  /**
   * Creates new migration.
   * 
   * @param name the name of the migration to create.
   * @param options optional values to pass to creation handler.
   * @return true if successful.
   */
  async create(name: string, options?: Omit<IMigrationOptions, 'name'>): Promise<IMigrationCreateResult>;

  /**
   * Creates new migration.
   * 
   * @param options values to pass to creation handler.
   * @return true if successful.
   */
  async create(options: IMigrationOptions): Promise<IMigrationCreateResult>;
  async create(nameOrOptions: string | IMigrationOptions, options?: IMigrationOptions) {

    let name: string | undefined = nameOrOptions as string;

    if (typeof nameOrOptions === 'object') {
      options = nameOrOptions;
      name = undefined;
    }

    options = {
      up: '',
      down: '',
      ...options
    } as Required<IMigrationOptions>;

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

    const isUnique = await this.isUniqueName(baseName);

    if (!isUnique)
      return {
        ok: false,
        name,
        message: `Cannot create duplicate migration name: "${baseName}"`
      } as IMigrationCreateResult;

    name = Date.now() + '_' + baseName;
    const filename = join(this.directory, 'migrations', name + this.extension);

    try {

      const template = await this.getTemplate(options.template);

      options.up = options.up?.length ? "`" + options.up + "`" : "`" + "`";
      options.down = options.down?.length ? "`" + options.down + "`" : "`" + "`";

      const writeResult = await writeFileAsync(filename, template({ ...options, name: baseName }));

      this.emit('created', { name, filename, ok: writeResult || false });

      return {
        ok: writeResult || false,
        name,
        message: writeResult === true
          ? ` Migration "${name}" succesfully created`
          : ` Migration "${name}" was NOT created`,
        filename
      } as IMigrationCreateResult;

    }

    catch (err) {

      return {
        ok: false,
        name,
        message: err,
        filename
      } as IMigrationCreateResult;

    }

  }

  /**
   * Filters out filenames of migrations from name relative to last migration.
   * 
   * @param name the name of the migration.
   * @param dir the direction of the migration.
   * @returns Promise<string[]>
   */
  async filter(name: string, dir: MigrateDirection): Promise<string[]>;

  /**
   * Filters out filenames of migrations from name relative to last migration.
   * 
   * @param name the name of the migration.
   * @param dir the direction of the migration.
   * @returns Promise<string[]>
   */
  async filter(dir: MigrateDirection, levels?: number | '*'): Promise<string[]>;

  /**
   * Filters out filenames of migrations from name relative to last migration.
   * 
   * @returns Promise<string[]>
   */
  async filter(): Promise<string[]>;
  async filter(nameOrDir?: string | MigrateDirection, dirOrLevels?: MigrateDirection | number | '*') {

    let name: string | undefined = nameOrDir as string;
    let dir: MigrateDirection = dirOrLevels as MigrateDirection;
    let levels: number | undefined;

    if (['up', 'down'].includes(nameOrDir as any)) {
      levels = (dirOrLevels || 0) as number;
      if (dirOrLevels === '*')
        levels = 999999;
      dir = nameOrDir as MigrateDirection;
      name = undefined;
    }

    // levels only used when name not present
    // default to one step or level user can
    // define if they want more.
    levels = levels || 1;

    const [active, activeDir] = this.active;
    const files = await this.getFilenames();
    const isFirst = this.isFirstMigration(files, this.active);
    const idx = findIndex(files, name as string);

    // used to shift index depending on last
    // active direction of migration.
    const offset = activeDir === 'down' ? 1 : 0;

    let lastIdx = findIndex(files, active);
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

  }

  /**
   * Loads a single migration from file.
   * 
   * @param filename the filename to be loaded.
   * @returns an IMigration instance from file.
   */
  async import(filename: string) {
    const file = await import(filename) as IMigration;
    Object.defineProperty(file, 'filename', {
      value: filename
    });
    return file;
  }

  /**
   * Imports array of migrations by filename.
   * 
   * @param filenames the file names to import/load.
   * @returns Promise<IMigration[]>;
   */
  async load(filenames: string[]) {
    const proms = filenames.map(filename => this.import(filename));
    const migrations = await Promise.all(proms) as IMigration[];
    this.emit('loaded', { filenames, migrations });
    return migrations;
  }

  /**
   * Checks if is preview or filtered files are out of scope.
   * 
   * @param dir the direction of the migration.
   * @param files the files to be migrated.
   * @param preview indicates preview mode requested.
   * @returns IMigrationResult.
   */
  checkPreviewAndScope(dir: MigrateDirection, migrations: IMigration[], preview = false) {

    const message = preview
      ? 'Migration Preview'
      : `Migration out of scope, no files match request`;
    const names = preview ? migrations.map(m => parse(m.filename).name) : [];
    const count = migrations.length;
    const ok = preview || !!migrations.length

    return {
      type: dir,
      ok,
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
  async up(nameOrLevels?: string | number, preview = false) {

    let files: string[];
    let result = { type: 'up', ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] } as IMigrationResult;
    let count = 0;
    let success = 0;
    const migrated = [] as IMigration[];

    try {

      if (typeof nameOrLevels === 'number' || nameOrLevels === '*')
        files = await this.filter('up', nameOrLevels);
      else
        files = await this.filter(nameOrLevels as string, 'up');

      files.sort() // ascending order.
      const migrations = await this.load(files);
      count = migrations.length;

      result = this.checkPreviewAndScope('up', migrations, preview);

      if (!result.ok || result.isPreview)
        return result;

      for (const [, file] of migrations.entries()) {
        this.emit('up', file);
        const fn = promisifyMigration(file['up']);
        await fn(this.connection)
          .then(_ => {
            success += 1;
            migrated.push(file);
          });

      }

      result.ok = count === success;

    }
    catch (err) {
      if (migrated.length)
        await (this.revert(migrated, 'up'));
      result = {
        ...result,
        ok: false,
        message: err,
        names: migrated.map(m => m.filename)
      };
    }

    result.count = count;
    result.success = success;
    result.failed = Math.max(0, count - success);

    if (result.ok) {
      result.message = `Migration up successful`;
      result.names = migrated.map(m => m.filename)
    }

    // Update the active migration when
    // result status is ok store last migration run.
    if (result.ok && migrated.length) {
      this.reverts = defineReverts(migrated, 'up');
      this.active = defineActive(migrated, 'up');
    }

    this.emit('migration', result);

    return result;

  }

  /**
   * Migrates down automatically or by level count or name of migration.
   * 
   * @param nameOrLevels the name or level count to migrate down.
   * @param preview returns a dry run.
   * @returns status, count affected and message.
   */
  async down(nameOrLevels?: string | number, preview = false) {

    let files: string[];
    let result = { type: 'up', ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] } as IMigrationResult;
    let count = 0;
    let success = 0;
    const migrated = [] as IMigration[];

    try {

      if (typeof nameOrLevels === 'number' || nameOrLevels === '*')
        files = await this.filter('down', nameOrLevels);
      else
        files = await this.filter(nameOrLevels as string, 'down');

      const migrations = await this.load(files);

      count = migrations.length;

      result = this.checkPreviewAndScope('up', migrations, preview);

      if (!result.ok || result.isPreview)
        return result;

      for (const [, file] of migrations.entries()) {
        this.emit('down', file);
        const fn = promisifyMigration(file['down']);
        await fn(this.connection)
          .then(_ => {
            success += 1;
            migrated.push(file);
          });
      }


      result.ok = count === success;

    }
    catch (err) {
      if (migrated.length)
        await (this.revert(migrated, 'down'))
      result = {
        ...result,
        ok: false,
        message: err,
        names: migrated.map(m => m.filename)
      };
    }

    result.count = count;
    result.success = success;
    result.failed = Math.max(0, count - success);

    if (result.ok) {
      result.message = `Migration down successful`;
      result.names = migrated.map(m => m.filename)
    }

    // Update the active migration when
    // result status is ok store last migration run.
    if (result.ok && migrated.length) {
      this.reverts = defineReverts(migrated, 'down');
      this.active = defineActive(migrated, 'down');
    }

    this.emit('migration', result);

    return result;

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
  async revert(migrations: IMigration[], dir: MigrateDirection, preview = false) {

    const clone = [...migrations];
    const newDir = dir === 'up' ? 'down' : 'up';

    let result = { type: newDir, ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] } as IMigrationResult;
    let revertNames = [] as string[];
    let last: IMigration;
    let name = '';

    const count = migrations.length;
    let success = 0;
    const migrated = [] as IMigration[];

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
      revertNames = [...clone].reverse().map(file => getBaseName(file.filename));

      // Get last to store as active migration.
      last = clone[clone.length - 1];
      name = getBaseName(last.filename);

      result = this.checkPreviewAndScope('up', clone, preview);

      if (!result.count || result.isPreview)
        return result;

      for (const [, file] of migrations.entries()) {
        this.emit(newDir, file);
        const fn = promisifyMigration(file[newDir]);
        await fn(this.connection)
          .then(_ => {
            success += 1;
            migrated.push(file);
          });
      }

      result.ok = count === success;

    }

    catch (err) {
      result = {
        ...result,
        ok: false,
        message: err,
        names: migrated.map(m => m.filename)
      }
    }

    result.count = count;
    result.success = success;
    result.failed = Math.max(0, count - success);

    if (result.ok) {
      result.message = `Revert Migration ${newDir} successful`;
      result.names = migrated.map(m => m.filename)
    }

    if (result.ok && migrated.length) {
      this.reverts = [revertNames, newDir] as any;
      this.active = [name, newDir];
    }

    this.emit('migration', result);

    return result;

  }

  /**
   * Revert all migrations.
   * 
   * @param name migration name to reset to.
   */
  async reset(preview = false) {

    let result = { type: 'down', ok: false, message: 'Unknown', count: 0, success: 0, failed: 0, names: [] } as IMigrationResult;
    let count = 0;
    let success = 0;
    const migrated = [] as IMigration[];

    try {

      const files = await this.filter('down', '*');
      const migrations = await this.load(files);

      count = migrations.length;

      if (!files.length) {

        return {
          ...result,
          message: `Migration out of scope, no files match request`,
          count,
          names: migrated.map(m => m.filename)
        }

      }

      else if (preview) {

        return {
          ...result,
          ok: true,
          message: 'Migration preview',
          count: files.length,
          names: files
        };

      }

      else {

        for (const [i, file] of migrations.entries()) {
          const name = parse(files[i]).name;
          this.emit('down', { name, revert: true });
          await promisify(file.down)(this.connection)
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
        await (this.revert(migrated, 'down'))
      result = {
        ...result,
        ok: false,
        message: err,
        count
      };
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
      this.reverts = defineReverts(migrated, 'down');
      this.active = defineActive(migrated, 'down');
    }

    this.emit('migration', result);

    return result;

  }


}