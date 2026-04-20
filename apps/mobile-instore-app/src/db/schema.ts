import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const dbSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'walk_ins',
      columns: [
        { name: 'tenant_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'party_size', type: 'number' },
        { name: 'occasion', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'queue_position', type: 'number' },
        { name: 'estimated_wait_minutes', type: 'number', isOptional: true },
        { name: 'assigned_stylist_id', type: 'string', isOptional: true },
        { name: 'checked_in_at', type: 'number' },  // epoch ms
        { name: 'called_at', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'appointments',
      columns: [
        { name: 'tenant_id', type: 'string' },
        { name: 'customer_id', type: 'string', isOptional: true },
        { name: 'stylist_id', type: 'string', isOptional: true },
        { name: 'appointment_date', type: 'number' },  // epoch ms
        { name: 'duration_minutes', type: 'number' },
        { name: 'service_type', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'confirmation_code', type: 'string' },
      ],
    }),
  ],
});
