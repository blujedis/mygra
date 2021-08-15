"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENTS = void 0;
// Events:
//
// created    { name, filename }
// filtered   { filenames, direction, name, levels }
// loaded     { filenames, migrations }
// migration  { type, message, ok, count }
// up         { name }
// down       { name }
// active     [migration_name, direction];
// revert     { names }
exports.EVENTS = ['created', 'filtered', 'loaded', 'migration', 'up', 'down', 'active', 'revert'];
