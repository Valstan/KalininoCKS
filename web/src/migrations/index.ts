import * as migration_20260621_145321_initial from './20260621_145321_initial';
import * as migration_20260802_173215 from './20260802_173215';
import * as migration_20260804_123500 from './20260804_123500';
import * as migration_20260822_214500 from './20260822_214500';

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
  {
    up: migration_20260804_123500.up,
    down: migration_20260804_123500.down,
    name: '20260804_123500'
  },
  {
    up: migration_20260822_214500.up,
    down: migration_20260822_214500.down,
    name: '20260822_214500'
  },
];
