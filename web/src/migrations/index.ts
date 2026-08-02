import * as migration_20260621_145321_initial from './20260621_145321_initial';
import * as migration_20260802_173215 from './20260802_173215';

export const migrations = [
  {
    up: migration_20260621_145321_initial.up,
    down: migration_20260621_145321_initial.down,
    name: '20260621_145321_initial',
  },
  {
    up: migration_20260802_173215.up,
    down: migration_20260802_173215.down,
    name: '20260802_173215'
  },
];
