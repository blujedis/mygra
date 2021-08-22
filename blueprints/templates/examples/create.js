module.exports = ({ table, columns, defaults, description }) => {

  if (!table)
    throw new Error(`Create table migration requires table name.`);

  const indent = 6;

  const defaultColumns = defaults === false ? [] : [
    `created TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
  ];

  // Columns in the format of:
  // column:datatype:attr1:attr2...
  columns = [...columns.map(c => {
    const segments = c.split(':');
    if (segments.length === 1)
      segments.push('VARCHAR(50)');
    return segments.join(' ');
  }), ...defaultColumns].map((v, i) => {
    if (i > 0)
      v = ' '.repeat(indent) + v;
    return v;
  });

  const columnsStr = !columns.length ? '' : columns.join(',\n');

  return `
  const table = \`${table}\`;
  const description = '${description}';
  
  async function up(conn, cb) {
    const query = \`CREATE TABLE IF NOT EXISTS \${table\} (
      id INT PRIMARY KEY AUTO_INCREMENT,
      ${columnsStr}
      )\`;
    return conn.query(query);
  }
  
  async function down(conn, cb) {
    const query = \`DROP TABLE IF EXISTS \${table\}\`;
    return conn.query(query);
  }
  
  module.exports = {
    description,
    up,
    down
  };
  `;

};
