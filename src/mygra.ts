import { EventEmitter } from 'events';
import glob from 'fast-glob';
import { join, basename, resolve, parse, extname } from 'path';
import { existsSync } from 'fs';
import defaultTemplates from './templates';
import { promisify } from 'util';
import { findIndex, writeFileAsync, initConfig, defineActive, defineReverts } from './utils';
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
        const base = basename(file).replace(extname(file), '');
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
      name,
      description: '',
      up: '',
      down: '',
      ...options
    } as Required<IMigrationOptions>;


    if (!options.name)
      throw new Error(`Cannot create migration with name of undefined.`);

    const baseName = options.name.replace(/\s/g, '_').toLowerCase();
    name = Date.now() + '_' + baseName;
    const template = await this.getTemplate(options.template);

    const filename = join(this.directory, 'migrations', name + this.extension);

    const writeResult = await writeFileAsync(filename, template({ ...options, name }));

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
    const idx = findIndex(files, name as string);

    // used to shift index depending on last
    // active direction of migration.
    const offset = activeDir === 'down' ? 1 : 0;

    let lastIdx = findIndex(files, active);
    lastIdx = !active ? files.length : lastIdx;

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
   * Migrates up automatically or by level count or name of migration.
   * 
   * @param nameOrLevels the name or level count to migrate up.
   * @param preview returns a dry run.
   * @returns status, count affected and message.
   */
  async up(nameOrLevels?: string | number, preview = false) {

    let files: string[];
    let result = { type: 'up', ok: false, message: 'Unknown', count: 0, names: [] } as IMigrationResult;
    let count = 0;
    const migrated = [] as IMigration[];

    try {

      if (typeof nameOrLevels === 'number' || nameOrLevels === '*')
        files = await this.filter('up', nameOrLevels);
      else
        files = await this.filter(nameOrLevels as string, 'up');

      // If no files the requested migration
      // is out of scope.
      if (!files.length) {
        result = {
          type: 'up',
          ok: false,
          message: `Migration out of scope, no files match request`,
          count,
          names: []
        }
      }

      else if (preview) {

        result = {
          type: 'up',
          ok: true,
          message: 'Migration preview',
          count: files.length,
          names: files.sort()
        };

      }

      else {

        files.sort() // ascending order.

        const migrations = await this.load(files);

        for (const [i, file] of migrations.entries()) {
          const name = parse(files[i]).name;
          this.emit('up', { name });
          await promisify(file.up)(this.connection);
          migrated.push(file);
          count++;

        }

        result = {
          type: 'up',
          ok: true,
          message: 'Migration successful',
          count,
          names: migrated.map(m => m.filename)
        };

      }


    }
    catch (err) {

      if (migrated.length)
        await (this.revert(migrated, 'up'))

      result = {
        type: 'up',
        ok: false,
        message: err,
        count,
        names: migrated.map(m => m.filename)
      };

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
    let result = { type: 'up', ok: false, message: 'Unknown', count: 0, names: [] } as IMigrationResult;
    let count = 0;
    const migrated = [] as IMigration[];

    try {

      if (typeof nameOrLevels === 'number' || nameOrLevels === '*')
        files = await this.filter('down', nameOrLevels);
      else
        files = await this.filter(nameOrLevels as string, 'down');

      // If no files the requested migration
      // is out of scope.
      if (!files.length) {

        result = {
          type: 'down',
          ok: false,
          message: `Migration out of scope, no files match request`,
          count,
          names: []
        }

      }

      else if (preview) {

        result = {
          type: 'up',
          ok: true,
          message: 'Migration preview',
          count: files.length,
          names: files
        };

      }

      else {

        const migrations = await this.load(files);

        for (const [i, file] of migrations.entries()) {
          const name = parse(files[i]).name;
          this.emit('down', { name });
          await promisify(file.down)(this.connection);
          migrated.push(file);
          count++;
        }

        result = {
          type: 'down',
          ok: true,
          message: 'Migration successful',
          count,
          names: migrated.map(m => m.filename)
        };

      }

    }
    catch (err) {
      if (migrated.length)
        await (this.revert(migrated, 'down'))
      result = {
        type: 'down',
        ok: false,
        message: err,
        count,
        names: migrated.map(m => m.filename)
      };
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

    let result = { type: 'up', ok: false, message: 'Unknown', count: 0, names: [] } as IMigrationResult;
    let revertNames = [] as string[];
    let last: IMigration;
    let name = '';
    let count = 0;
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
      revertNames = [...clone].reverse().map(file => basename(file.filename).replace(extname(file.filename), ''));

      // Get last to store as active migration.
      last = clone[clone.length - 1];
      name = basename(last.filename).replace(extname(last.filename), '');

      if (!clone.length) {

        result = {
          type: newDir,
          ok: false,
          message: `Revert migration out of scope, no files match request`,
          count: 0,
          names: []
        };

      }

      else if (preview) {

        result = {
          type: 'up',
          ok: true,
          message: 'Migration preview',
          count: migrations.length,
          names: clone.map(file => file.filename)
        };

      }

      else {

        for (const file of migrations) {
          if (dir === 'up') {
            await promisify(file.down)(this.connection);
          }
          else {
            await promisify(file.up)(this.connection);
          }
          migrated.push(file);
          count++;
        }

        result = {
          type: newDir,
          ok: true,
          message: 'Revert migration successful',
          count,
          names: migrated.map(m => m.filename)
        };

      }

    }
    catch (err) {

      result = {
        type: newDir,
        ok: false,
        message: err,
        count,
        names: migrated.map(m => m.filename)
      }

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

    let result = { type: 'up', ok: false, message: 'Unknown', count: 0, names: [] } as IMigrationResult;
    let count = 0;
    const migrated = [] as IMigration[];

    try {

      const files = await this.filter('down', '*');
      const migrations = await this.load(files);

      if (!files.length) {

        result = {
          type: 'down',
          ok: false,
          message: `Migration out of scope, no files match request`,
          count,
          names: migrated.map(m => m.filename)
        }

      }

      else if (preview) {

        result = {
          type: 'up',
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
          await promisify(file.down)(this.connection);
          migrated.push(file);
          count++
        }

        result = {
          type: 'down',
          ok: false,
          message: 'Migration successful',
          count,
          names: migrated.map(m => m.filename)
        };

      }

    }

    catch (err) {
      if (migrated.length)
        await (this.revert(migrated, 'down'))
      result = {
        type: 'down',
        ok: false,
        message: err,
        count,
        names: migrated.map(m => m.filename)
      };
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


}