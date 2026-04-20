import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { dbSchema } from './schema';
import WalkIn from './models/WalkIn';
import Appointment from './models/Appointment';

const adapter = new SQLiteAdapter({
  schema: dbSchema,
  dbName: 'toptenprom_instore',
  // jsi: true enables faster JSI bridge (available in Expo SDK 52 + hermes)
  jsi: true,
});

export const database = new Database({
  adapter,
  modelClasses: [WalkIn, Appointment],
});
