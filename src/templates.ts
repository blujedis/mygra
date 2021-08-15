import { IMigrationOptions } from './types';

const _default = ({ name, up, down, description }: IMigrationOptions) => `
const name = '${name}';
const description = '${description || ''}';

async function up(conn, cb) {
  ${up || ''}
}

async function down(conn, cb) {
  ${down || ''}
}

module.exports = {
  name,
  description,
  up,
  down
};
`;

export default {
  default: _default
};
