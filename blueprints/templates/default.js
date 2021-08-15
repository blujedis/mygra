module.exports = ({ name, up, down, description }) => `
const name = '${name}';
const description = '${description}';

async function up(conn, cb) {
  const query = ${up};
}

async function down(conn, cb) {
  const query = ${down};
}

module.exports = {
  name,
  description,
  up,
  down
};
`;