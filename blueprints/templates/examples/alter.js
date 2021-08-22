module.exports = ({ table, columns, defaults, description }) => {

  if (!table)
    throw new Error(`Alter table migration requires table name.`);

  const indent = 6;

  const defaultColumns = !defaults ? [] : [];

  // Columns in the format of:
  // column:datatype:attr1:attr2...
  columns = [...(columns || []).map(c => {
    if (!c.includes(':'))
      return c;
    const segments = c.split(':');
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
    const query = \`ALTER TABLE \${table\} (
      ${columnsStr}
    )\`;
    return conn.query(query);
  }
  
  async function down(conn, cb) {
    const query = \`ALTER TABLE \${table\} (
    )\`;
    return conn.query(query);
  }
  
  module.exports = {
    description,
    up,
    down
  };
  `;

};
