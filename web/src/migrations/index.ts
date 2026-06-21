import * as migration_20260621_145321_initial from './20260621_145321_initial';

export const migrations = [
  {
    up: migration_20260621_145321_initial.up,
    down: migration_20260621_145321_initial.down,
    name: '20260621_145321_initial'
  },
];
