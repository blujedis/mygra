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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_parser_1 = __importDefault(require("yargs-parser"));
const path_1 = require("path");
const mygra_1 = require("./mygra");
const log_symbols_1 = __importDefault(require("log-symbols"));
const fs_extra_1 = require("fs-extra");
const utils_1 = require("./utils");
const argv = yargs_parser_1.default(process.argv.slice(2), {
    alias: { up: ['u'], down: ['d'], preview: ['p'], force: ['f'], defaults: ['d'], column: ['c'], table: ['t'] },
    string: ['description', 'table'],
    boolean: ['preview', 'force'],
    array: ['column']
});
const appNameLower = utils_1.PKG.name;
const appName = appNameLower.charAt(0).toUpperCase() + appNameLower.slice(1);
const cwd = process.cwd();
let cmd = argv._[0];
let template = 'default';
const commands = [
    'generate', 'g', 'up', 'down', 'init',
    'help', 'list', 'show', 'get', 'set',
    'config', 'revert', 'examples'
];
if (cmd.startsWith('create')) // support legacy.
    cmd = cmd.replace('create', 'generate');
if (cmd.includes(':')) {
    const segments = cmd.split(':');
    cmd = segments[0];
    template = segments[1] || 'default';
}
cmd = cmd === 'g' ? 'generate' : cmd;
if (!commands.includes(cmd))
    process.exit();
const nameStr = utils_1.colorize(appName, 'blueBright');
const verStr = utils_1.colorize(utils_1.PKG.version, 'blueBright');
const help = `
${nameStr} (${verStr})
------------------------------------------------------------------------

${utils_1.colorize(`Usage: ${appNameLower} <command> [...options]`, 'dim')}

${utils_1.colorize('Commands:', 'cyanBright')}
  generate, g  <name>               generates migration from template
    generate:template <name>        generate using specific template
  up        [name]                  runs up migration one level
  down      [name, count or all]    runs down migration
  show      <name>                  outputs migration file to console
  get       <key>                   gets value of app config key
  set       <key> <value>           sets value of app config key
  revert                            reverts or undos last migration
  reset                             resets all migrations
  list                              shows list of migration files
  config                            shows the app's config
  init                              initializes copying blueprints
  examples                          shows examples
  help                              show the help menu

${utils_1.colorize('Options:', 'cyanBright')}
  --defaults, -d            flag useful in template generation          [boolean]
  --table, -t               specify table name for migrations            [string]
  --column, -c              specify column(s) to pass to template   Array<string>
  --up, -u                  specify migration up command string          [string]
  --down, -d                specify migration down command string        [string]
  --description, -e         specify migration description                [string]
  --preview, -p             up, down or reset shows dry run             [boolean]
  --stacktrace, -s          errors will show stacktrace                 [boolean]
  --force, -f               forces migration action                     [boolean]
`;
const examples = `
${utils_1.colorize('Examples:', 'cyanBright')}
  ${appNameLower} generate user_table (uses default template)
  ${appNameLower} g:create user_table (uses create template)
  ${appNameLower} generate:create user_table --up='CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY AUTOINCREMENT)' --down='DROP TABLE IF EXISTS user' --description='ACL permissions table.'
  ${appNameLower} up user
  ${appNameLower} up 2
  ${appNameLower} up all
  ${appNameLower} set directory /path/to/mygra
  ${appNameLower} set active some_migration up 
  ${appNameLower} set active null (or empty or none to reset to []) 
  ${appNameLower} set reverts "migration_one,migration_two" down
`;
function exit(code = 0) {
    process.exit(code);
}
function handleResult(result) {
    var _a;
    let names = !((_a = result.names) === null || _a === void 0 ? void 0 : _a.length) ? 'none' : result.names;
    if (Array.isArray(names))
        names = names.map(f => utils_1.getBaseName(f)).join(', ');
    let message = result.message;
    let stack = '';
    if (message instanceof Error) {
        if (argv.stacktrace)
            stack = (message.stack || '').split('\n').slice(1).map(v => '  ' + v).join('\n');
        message = message.message;
    }
    if (stack.length)
        message = message + '\n' + stack;
    console.log(`\n${result.ok ? log_symbols_1.default.success : log_symbols_1.default.error} ${message}\n`);
    if (result.type)
        console.log(`  direction: ${result.type}`);
    if (result.names)
        console.log(`  migrations: ${names}`);
    if (typeof result.count !== 'undefined')
        console.log(`  count: ${result.count}`);
    if (typeof result.success !== 'undefined') {
        const success = typeof result.failed !== 'undefined' && result.failed > 0
            ? result.success
            : utils_1.colorize(result.success + '', 'greenBright');
        console.log(`  success: ${success}`);
    }
    if (typeof result.failed !== 'undefined') {
        const failed = result.failed > 0
            ? utils_1.colorize(result.failed + '', 'redBright')
            : result.failed;
        console.log(`  failed: ${failed}`);
    }
    console.log();
    exit();
}
function listen() {
    return __awaiter(this, void 0, void 0, function* () {
        const config = utils_1.initConfig();
        const userDir = config.get('directory');
        const userExt = config.get('extension');
        const userConfigPath = path_1.join(userDir, `config${userExt}`);
        let userConfig = {};
        if (fs_extra_1.existsSync(userConfigPath)) {
            userConfig = yield Promise.resolve().then(() => __importStar(require(userConfigPath)));
        }
        else {
            console.log(`${log_symbols_1.default.warning} ${utils_1.APP_PKG.name} initialized without config.js`);
        }
        const mygra = new mygra_1.Mygra(userConfig);
        if (['help', 'examples', 'config', 'get', 'set', 'init'].includes(cmd)) {
            if (cmd === 'help') {
                console.log(help);
            }
            if (cmd === 'examples') {
                console.log(examples);
            }
            else if (cmd === 'config') {
                console.log(config.props);
            }
            else if (cmd === 'get') {
                console.log(config.get(argv._[1]));
            }
            else if (cmd === 'set') {
                // const current = config.props;
                const key = argv._[1];
                let val = argv._[2];
                const val2 = argv._[3];
                if (key === 'active' || key === 'reverts') {
                    if (val === 'null' || val === 'none' || val === 'empty') {
                        val = [];
                    }
                    else if (!val2) {
                        console.log(`Set ${key} using format "mygra set ${key} migration_name up"`);
                        process.exit();
                    }
                    else {
                        if (key === 'reverts')
                            val = val.split(',').map(v => v.trim());
                        val = [val, val2];
                    }
                }
                else if (key === 'directory') {
                    val = val || utils_1.MYGRA_DEFAULT_PATH;
                }
                else if (key === 'templatePrefix') {
                    val = /true/.test(val) ? true : false;
                }
                config.set(key, val);
            }
            else if (cmd === 'init') {
                const srcPath = path_1.join(__dirname, '../../blueprints');
                const targetPath = path_1.join(cwd, appNameLower);
                if (!fs_extra_1.existsSync(targetPath) || argv.force) {
                    fs_extra_1.copySync(srcPath, targetPath);
                    console.log(log_symbols_1.default.success, `successfully initialized ${appName}`);
                }
                // already exists merge instead
                // don't overwrite config just 
                // merge/copy templates
                else {
                    fs_extra_1.copySync(path_1.join(__dirname, '../../blueprints/templates'), path_1.join(cwd, appNameLower, 'templates'));
                    console.log(log_symbols_1.default.success, `successfully reinitialized ${appName}, config was NOT overwritten use --force to overwrite`);
                }
            }
            exit();
        }
        else if (!fs_extra_1.existsSync(config.get('directory'))) {
            const initCmd = `${appNameLower} init`;
            const setCmd = `${appNameLower} set directory /path/to/mygra`;
            console.log(`\n${log_symbols_1.default.warning} ${appName} directory NOT found or has moved, please initialize.\n`);
            console.log(`  Run ${utils_1.colorize(initCmd, 'cyan')} or ${utils_1.colorize(setCmd, 'cyan')}\n`);
        }
        else {
            if (cmd === 'list') {
                let filenames = yield mygra.getFilenames();
                filenames = filenames.map(file => utils_1.getBaseName(file));
                console.log('\n' + filenames.join('\n') + '\n');
                exit();
            }
            else if (cmd === 'show') {
                const files = yield mygra.getFilenames();
                if (!argv._[1]) {
                    console.log(`Cannot show Migration of undefined.`);
                    exit();
                }
                const found = utils_1.findIndex(files, argv._[1]);
                if (found === -1) {
                    console.log(`Migration ${argv._[1]} NOT found`);
                    exit();
                }
                else {
                    const filename = files[found];
                    const imported = yield mygra.import(filename);
                    const parsed = path_1.parse(filename);
                    const hasMethod = argv.up || argv.down;
                    const showStates = {
                        up: !hasMethod || argv.up,
                        down: !hasMethod || argv.down
                    };
                    console.log(`\n----------------------------------------------`);
                    console.log(` ${utils_1.colorize(parsed.name, 'whiteBright')}`);
                    if (imported.description)
                        console.log(` ${utils_1.colorize(imported.description, 'dim')}`);
                    console.log(`----------------------------------------------\n`);
                    if (showStates.up) {
                        console.log(utils_1.colorize((imported.up || '').toString(), 'greenBright'));
                        console.log();
                    }
                    if (showStates.down) {
                        console.log(utils_1.colorize((imported.down || '').toString(), 'redBright'));
                        console.log();
                    }
                    exit();
                }
            }
            else if (cmd === 'generate') {
                const { _, $0, column } = argv, rest = __rest(argv, ["_", "$0", "column"]);
                rest.columns = column || [];
                const opts = Object.assign({ name: _[1], template, description: '' }, rest);
                opts.table = opts.table || opts.name;
                const result = yield mygra.create(opts);
                handleResult(result);
                exit();
            }
            else if (cmd === 'up') {
                const val = argv._[1] === 'all' ? '*' : argv._[1];
                const nameOrLevel = (/^\d+$/.test(val) ? parseInt(val) : val);
                const result = yield mygra.up(nameOrLevel, argv.preview);
                handleResult(result);
            }
            else if (cmd === 'down') {
                const val = argv._[1] === 'all' ? '*' : argv._[1];
                const nameOrLevel = (/^\d+$/.test(val) ? parseInt(val) : val);
                const result = yield mygra.down(nameOrLevel, argv.preview);
                handleResult(result);
            }
            else if (cmd === 'reset') {
                const result = yield mygra.reset(argv.preview);
                handleResult(result);
            }
            else if (cmd === 'revert') {
                const [reverts, dir] = mygra.reverts || [];
                if (!(reverts === null || reverts === void 0 ? void 0 : reverts.length)) {
                    console.log(log_symbols_1.default.warning, `Cannot revert with migration steps of undefined`);
                    exit();
                }
                else {
                    // Rebuild filenames maybe not necessary but
                    // by storing reverts by name only allows moving
                    // directory, won't break basically.
                    const filenames = reverts.map(name => `${mygra.directory}/migrations/${name}${mygra.extension}`);
                    const migrations = yield mygra.load(filenames);
                    const result = yield mygra.revert(migrations, dir);
                    handleResult(result);
                }
            }
            else {
                exit();
            }
        }
    });
}
process.on('uncaughtException', (err) => {
    const _err = utils_1.colorizeError(err);
    console.log(_err.colorizedMessage);
    console.log(_err.colorizedStack);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    if (reason)
        console.error(reason);
});
listen();
