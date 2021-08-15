import parser from 'yargs-parser';
import { join, parse, basename, extname } from 'path';
import { Mygra } from './mygra';
import symbols from 'log-symbols';
import { copySync, existsSync } from 'fs-extra';
import { colorize, MYGRA_DEFAULT_PATH, initConfig, PKG, APP_PKG, findIndex } from './utils';
import { IMigrationResult, IMygra } from './types';

const argv = parser(process.argv.slice(2), {
  alias: { template: ['t'], up: ['u'], down: ['d'], preview: ['p'], force: ['f'] },
  string: ['template', 'up', 'down', 'description'],
  boolean: ['preview', 'force']
});

const appNameLower = PKG.name;
const appName = appNameLower.charAt(0).toUpperCase() + appNameLower.slice(1);
const cwd = process.cwd();
const cmd = argv._[0];
const commands = ['create', 'up', 'down', 'init', 'help', 'active', 'list', 'show', 'get', 'set', 'config', 'revert'];

if (!commands.includes(cmd))
  process.exit();

const nameStr = colorize(appName, 'blueBright');
const verStr = colorize(PKG.version, 'blueBright');

const help = `
${nameStr}                                                        ver: ${verStr}
=======================================================================

${colorize(`Usage: ${appNameLower} <command> [...options]`, 'dim')}

${colorize('Commands:', 'cyanBright')}
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

${colorize('Options:', 'cyanBright')}
  --template, -t            specifies the template to be used
  --up, -u                  specify migration up command
  --down, -d                specify migration down command
  --description, -e         specify migration description
  --preview, -p             up, down or reset shows dry run
  --stacktrace, -s          errors will show stacktrace
  --force, -f               forces migration action

${colorize('Examples:', 'cyanBright')}
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

function handleResult(result: IMigrationResult) {
  let names = !result.names.length ? 'none' : result.names;
  if (Array.isArray(names))
    names = names.map(f => basename(f).replace(extname(f), '')).join(', ');
  let message = result.message;
  let stack = '';
  if (message instanceof Error) {
    if (argv.stacktrace)
      stack = (message.stack || '').split('\n').slice(1).map(v => '  ' + v).join('\n')
    message = message.message;
  }
  if (stack.length)
    message = message + '\n' + stack;
  console.log(`\n${result.ok ? symbols.success : symbols.error} ${message}\n`);
  console.log(`  direction: ${result.type}`);
  console.log(`  migrations: ${names}`);
  console.log(`  count: ${result.count}\n`);
}

async function listen() {

  const config = initConfig();
  const userDir = config.get('directory');
  const userExt = config.get('extension');
  const userConfigPath = join(userDir, `config${userExt}`);

  let userConfig = {} as IMygra;

  if (existsSync(userConfigPath)) {
    userConfig = await import(userConfigPath);
  }
  else {
    console.log(`${symbols.warning} ${APP_PKG.name} initialized without config.js`);
  }

  const mygra = new Mygra(userConfig);

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
    let val = argv._[2] as any;
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
      val = val || MYGRA_DEFAULT_PATH;
    }
    config.set(key, val);
  }

  else if (cmd === 'init') {
    const srcPath = join(__dirname, '../../blueprints');
    const targetPath = join(cwd, appNameLower);
    if (!existsSync(targetPath) || argv.force) {
      copySync(srcPath, targetPath);
      console.log(symbols.success, `successfully initialized ${appName}`);
    }
    // already exists merge instead
    // don't overwrite config just 
    // merge/copy templates
    else {
      copySync(join(__dirname, '../../blueprints/templates'), join(cwd, appNameLower, 'templates'));
      console.log(symbols.success, `successfully reinitialized ${appName}, config was NOT overwritten use --force to overwrite`);
    }
  }

  else if (!existsSync(config.get('directory'))) {
    const initCmd = `${appNameLower} init`;
    const setCmd = `${appNameLower} set directory /path/to/mygra`
    console.log(`\n${symbols.warning} ${appName} directory NOT found or has moved, please initialize.\n`);
    console.log(`  Run ${colorize(initCmd, 'cyan')} or ${colorize(setCmd, 'cyan')}\n`);
  }

  else if (cmd === 'list') {
    const files = await mygra.getFilenames();
    console.log(files.join('\n'));
  }

  else if (cmd === 'show') {
    const files = await mygra.getFilenames();
    const found = findIndex(files, argv._[1]) as any;
    if (found === -1) {
      console.log(`Migration ${argv._[1]} NOT found`);
    }
    else {
      const filename = files[found];
      const imported = await mygra.import(filename);
      const parsed = parse(filename);
      console.log(`\n----------------------------------------------`);
      console.log(` ${colorize(parsed.name, 'whiteBright')}`);
      if (imported.description)
        console.log(` ${colorize(imported.description, 'dim')}`);
      console.log(`----------------------------------------------\n`);
      console.log(colorize((imported.up || '').toString(), 'greenBright'));
      console.log();
      console.log(colorize((imported.down || '').toString(), 'redBright'));
      console.log();
    }
  }

  else if (cmd === 'active') {
    console.log(config.get('active'));
  }

  else if (cmd === 'create') {
    const { _, $0, ...rest } = argv;
    const result = await mygra.create({
      name: _[1],
      ...rest
    });
    const symbol = result.ok ? symbols.success : symbols.error;
    if (result.ok) {
      console.log(symbol, result.message);
    }
    else {
      console.error(symbol, result.message);
    }
  }

  else if (cmd === 'up') {
    const val = argv._[1] === 'all' ? '*' : argv._[1];
    const nameOrLevel = (/^\d+$/.test(val) ? parseInt(val) : val) as string | number;
    const result = await mygra.up(nameOrLevel, argv.preview);
    handleResult(result);
  }

  else if (cmd === 'down') {
    const val = argv._[1] === 'all' ? '*' : argv._[1];
    const nameOrLevel = (/^\d+$/.test(val) ? parseInt(val) : val) as string | number;
    const result = await mygra.down(nameOrLevel, argv.preview);
    handleResult(result);
  }

  else if (cmd === 'reset') {
    const result = await mygra.reset(argv.preview);
    handleResult(result);
  }

  else if (cmd === 'revert') {
    const [reverts, dir] = mygra.reverts || [];
    if (!reverts?.length) {
      console.log(symbols.warning, `Cannot revert with migration steps of undefined`);
    }
    else {
      // Rebuild filenames maybe not necessary but
      // by storing reverts by name only allows moving
      // directory, won't break basically.
      const filenames = reverts.map(name => `${mygra.directory}/migrations/${name}${mygra.extension}`)
      const migrations = await mygra.load(filenames);
      const result = await mygra.revert(migrations, dir);
      handleResult(result);
    }
  }

}

process.on('uncaughtException', (err) => {
  console.error(symbols.error, colorize((err.name || 'Error') + ': ' + err.message || 'Unknown', 'redBright'));
  console.error(colorize((err.stack || '').split('\n').slice(1).join('\n'), 'dim'));
});

process.on('unhandledRejection', (reason) => {
  if (reason)
    console.error(reason);
});

listen();




