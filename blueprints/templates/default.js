module.exports = ({ up, down, description }) => `

const description = '${description}';

async function up(conn, cb) {
  const query = ${up};
}

async function down(conn, cb) {
  const query = ${down};
}

module.exports = {
  description,
  up,
  down
};
`;