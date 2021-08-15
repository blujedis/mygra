"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _default = ({ name, up, down, description }) => `
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
exports.default = {
    default: _default
};
