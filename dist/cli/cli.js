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
    alias: { template: ['t'], up: ['u'], down: ['d'], preview: ['p'], force: ['f'] },
    string: ['template', 'up', 'down', 'description'],
    boolean: ['preview', 'force']
});
const appNameLower = utils_1.PKG.name;
const appName = appNameLower.charAt(0).toUpperCase() + appNameLower.slice(1);
const cwd = process.cwd();
const cmd = argv._[0];
const commands = ['create', 'up', 'down', 'init', 'help', 'active', 'list', 'show', 'get', 'set', 'config', 'revert'];
if (!commands.includes(cmd))
    process.exit();
const nameStr = utils_1.colorize(appName, 'blueBright');
const verStr = utils_1.colorize(utils_1.PKG.version, 'blueBright');
const help = `
${nameStr}                                                        ver: ${verStr}
=======================================================================

${utils_1.colorize(`Usage: ${appNameLower} <command> [...options]`, 'dim')}

${utils_1.colorize('Commands:', 'cyanBright')}
  create  [name]                  generates migration from template
  up      [name, count, or all]   runs up migration
  down    [name, count or all]    runs down migration
  show    [name]                  outputs migration file to console
  get     [key]                   gets value of app config key
  set     [key] [value]           sets value of app config key
  revert                          reverts or undos last migration
  reset                           resets all migrations
  list                            shows list of migration files
  active                          shows active or last migration
  config                          shows the app's config
  init                            initializes copying blueprints
  help                            show the help menu

${utils_1.colorize('Options:', 'cyanBright')}
  --template, -t            specifies the template to be used
  --up, -u                  specify migration up command
  --down, -d                specify migration down command
  --description, -e         specify migration description
  --preview, -p             up, down or reset shows dry run
  --stacktrace, -s          errors will show stacktrace
  --force, -f               forces migration action

${utils_1.colorize('Examples:', 'cyanBright')}
  ${appNameLower} create user
  ${appNameLower} create user --template my-template
  ${appNameLower} up user
  ${appNameLower} up 2
  ${appNameLower} up all
  ${appNameLower} set directory /path/to/mygra
  ${appNameLower} set active some_migration up 
  ${appNameLower} set active null (or empty or none to reset to []) 
  ${appNameLower} set reverts "migration_one,migration_two" down
`;
function handleResult(result) {
    let names = !result.names.length ? 'none' : result.names;
    if (Array.isArray(names))
        names = names.map(f => path_1.basename(f).replace(path_1.extname(f), '')).join(', ');
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
    console.log(`  direction: ${result.type}`);
    console.log(`  migrations: ${names}`);
    console.log(`  count: ${result.count}\n`);
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
        if (cmd === 'help') {
            console.log(help);
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
        else if (!fs_extra_1.existsSync(config.get('directory'))) {
            const initCmd = `${appNameLower} init`;
            const setCmd = `${appNameLower} set directory /path/to/mygra`;
            console.log(`\n${log_symbols_1.default.warning} ${appName} directory NOT found or has moved, please initialize.\n`);
            console.log(`  Run ${utils_1.colorize(initCmd, 'cyan')} or ${utils_1.colorize(setCmd, 'cyan')}\n`);
        }
        else if (cmd === 'list') {
            const files = yield mygra.getFilenames();
            console.log(files.join('\n'));
        }
        else if (cmd === 'show') {
            const files = yield mygra.getFilenames();
            let found = utils_1.findIndex(files, argv._[1]);
            if (found === -1) {
                console.log(`Migration ${argv._[1]} NOT found`);
            }
            else {
                const filename = files[found];
                const imported = yield mygra.import(filename);
                const parsed = path_1.parse(filename);
                console.log(`\n----------------------------------------------`);
                console.log(` ${utils_1.colorize(parsed.name, 'whiteBright')}`);
                if (imported.description)
                    console.log(` ${utils_1.colorize(imported.description, 'dim')}`);
                console.log(`----------------------------------------------\n`);
                console.log(utils_1.colorize((imported.up || '').toString(), 'greenBright'));
                console.log();
                console.log(utils_1.colorize((imported.down || '').toString(), 'redBright'));
                console.log();
            }
        }
        else if (cmd === 'active') {
            console.log(config.get('active'));
        }
        else if (cmd === 'create') {
            const { _, $0 } = argv, rest = __rest(argv, ["_", "$0"]);
            const result = yield mygra.create(Object.assign({ name: _[1] }, rest));
            const symbol = result.ok ? log_symbols_1.default.success : log_symbols_1.default.error;
            if (result.ok) {
                console.log(symbol, result.message);
            }
            else {
                console.error(symbol, result.message);
            }
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
    });
}
process.on('uncaughtException', (err) => {
    console.error(log_symbols_1.default.error, utils_1.colorize((err.name || 'Error') + ': ' + err.message || 'Unknown', 'redBright'));
    console.error(utils_1.colorize((err.stack || '').split('\n').slice(1).join('\n'), 'dim'));
});
process.on('unhandledRejection', (reason) => {
    if (reason)
        console.error(reason);
});
listen();
