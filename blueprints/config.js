const { Database } = require('sqlite3');

const dbPath = ':memory'; // or /your/db/path.
const connection = new Database(dbPath, (err) => {
  if (err)
    console.error(err);
});

//  MySQL Example //
// const mysql = require('mysql2');
// 
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'todo'
// });
//

// Any Mygra class option can be
// provided in this export.
// The connection seen here below will
// be passed to each up/down migration
// handler
module.exports = {
  connection
};