# Mygra

An agnostic Database migrations utility. Mygra provides a simple CLI to migrate up and down allowing you to define any database/connection to be passed to each up and down method.

## Getting Started

For best use install `mygra` globally.

```sh
npm install mygra -g
```

## Initialize

Navigate to your project and then initialize. You should then see a folder called **mygra** in the root of your project.

**NOTE** you can call this any time to reset or reinit it will not overwrite your `config.js` unless you call `mygra init --force`

```js
mygra init
```

## Define Config

Edit the `mygra/config.js` file and define the exported connection method to be passed to your up and down migration method.

The default example is [Sqlite3](https://www.npmjs.com/package/sqlite3) connection.

```js
const dbPath = ':memory'; // or /your/db/path.
const connection = new Database(dbPath, (err) => {
  if (err) console.error(err);
});
module.exports = {
  connection,
};
```

## Create a Migration

Run the following to generate a migration the resulting output will be located at `mygra/migrations/1628915422808_user_table`

```sh
mygra create 'user table'
```

## Edit Migration

Open the newly created migration and edit your statements as required. In this case our **config.js** is exporting a [Sqlite3](https://www.npmjs.com/package/sqlite3) connection with which we use `conn.run()`.

Where `conn` is our `connection` that we exported in our `config.js`. The connection is passed to each migration up/down handlers.

You may return a promise of boolean or use node style callback as shown here.

```js
const name = 'user_table';
const description = '';

async function up(conn, cb) {
  const query = `CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
  )`;

  conn.run(query, (err) => {
    if (err) return cb(err);
    cb(null, true);
  });
}

async function down(conn, cb) {
  const query = `DROP TABLE IF EXISTS user`;

  return conn.run(query, (err) => {
    if (err) return cb(err);
    cb(null, true);
  });
}

module.exports = {
  name,
  description,
  up,
  down,
};
```

## Run the Migration

Migrations can be run as `up` or `down`. If you wish to see a dry run simply add `--preview` to your command.

```sh
mygra up
```

Migrate down two migrations.

```sh
mygra down 2
```

Migrate up at `user_table`

```sh
mygra up user_table
```

Previewing a migration will show you all the steps it is about to take!

```sh
mygra user_table --preview
```

After running a migration you should see something like the following:

```sh
✔ Migration successful

  direction: down
  migrations: 1628915422808_user_table
  count: 1
```

## Named Migrations

In the above example we called `mygra up user_table`. When using a named migration it is important to not that all migrations from the last or previous migration will be run also. If you wish to only step one at a time or a specified number of steps simply call up or down in the format of `mygra up 1` or `mygra down 3` where the numeric value is the number of steps you wish to traverse.

Consider the following where you've already run the **user_table** migration:

<pre>
1628915422808_user_table
1628915422809_blog_table
1628915422810_acl_table
1628915422811_cart_table
1628915422812_invoice_table
</pre>

If we now run the named mygration

```sh
mygra up cart_table
```

You will notice that not only does **cart_table** run but also **blog_table** and **acl_table**. This is because migrations are run in order of creation, hence why an epoch or timestamp is prepended to each name.

## Revert Migrations

To undo the last migration and all steps that were run, could be one or multiple, just call the revert method. It's important to note that only one history step is preserved for simplicity. Once a new migration is run the previous revert steps will be overwritten.

```sh
mygra revert
```

## Reset Migrations

You can also reset all migrations back to the begining or the first migration. Running reset will migrate down to the first migration step. Obviously this can be invasive and should be used with caution.

```sh
mygra reset
```

## Out of Scope Error

You may receive an error complaining about the requested migration being out of scope. There are a few reasons this can happen.

- There are no more migrations to run either you're at the most recent or you've run down to the first created.
- You've requested a migration that's already be run. In our above example you ran the `cart_table` migration but then next call the `acl_table` migration but it's already been run.
- The named migration you've specified does not exist.

## Renamed Project

We base your config filename off of the package.json project name. If you rename your project you will end up with a default config.

If you move your project the path to your `mygra` migrations and templates likely in the root of your project will have a different. We can easily correct either of those.

If you've renamed your project run the following command and open the `mygra` config folder which is stored in your home directory:

```sh
mygra config --open
```

Find the old config file using the previous project name and open it in a text editor of your choice, then copy the JSON you see.

Either manually create a new config file with the proper project name or open the blank one that might have been created.

Next just paste in the config from the old config file and you should be good as new.

## Moved Project

When you move a project the config file will still be found as it is named after your project name. However while it will find the correct config you'll find that migrations won't run as the migrations folder path stored in the config won't be correct.

To resolve this update the directory path using the command line.

```sh
mygra set directory '/path/to/project/mygra'
```

## No Remove Migration

Why is there no remove migration?

This is by design as it's better to either migrate below the migration you wish to remove or to create a migration that overwrites or fixes the issue you are attempting to resolve. In short deleting migrations sort of defeats the purpose.

That said if you do need to remove a migration please ensure the following keys in your config do not reference the migration.

```sh
mygra config
```

You should then see something like the following. You will want to manually edit both the **active** and **reverts** keys so that the deleted migration is not referenced. When editing the active migration step you'll need to enter the step which you wish to be the newly active step. For the reverts key just remove reference to the deleted file from the array.

```js
{
  initialized: true,
  directory: '/your/path/to/project_name/mygra',
  active: [ '1628915422808_user_table', 'up' ],
  reverts: [ [ '1628915422808_user_table' ], 'up' ],
  extension: '.js'
}
```

## Do I need to Know the Timestamp Prefix

When working with named migrations you do NOT need to specify the timestamp prefix. Mygra will search the migrations and find the matching name.

It is important that migration names be unique even without the prefixed timestamp for this reason. Creating a migration even manually using a previous migration name will throw an error to ensure this is not done.

## Can I Use Typescript Migrations

We're huge fans of Typescript, however in this case we decided to leave transpiling out of the equation. If you notice in the Mygra config there is an "extension" option. This is a placeholder in the event we decide to support Typescript in the future for migrations.

If interested in tinkering with this using ts-node for example feel free to do so and make a PR!!!

## Ran Migration but Nothing Happens

If your database connection is failing you may see this behavior. Admittedly we need to spend some more time handling errors of this type and perhaps require a database connectivity check method be exported from `mygra/config.js`.

Simply run `node mygra/config.js` directly using Node where some sort of connectivity check is defined in your config.

Once successfully connecting Mygra should catch errors as you'd expect.

## More Help

From your terminal run the help command which will show all options as well as a few command line examples.

```sh
mygra help
```

## API Docs

See [https://blujedis.github.io/mygra/](https://blujedis.github.io/mygra/)

## Change

See [CHANGELOG.md](CHANGELOG.md)

## License

See [LICENSE](LICENSE)
