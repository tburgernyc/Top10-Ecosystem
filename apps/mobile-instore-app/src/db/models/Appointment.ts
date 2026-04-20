import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export default class Appointment extends Model {
  static table = 'appointments';

  @text('tenant_id') tenantId!: string;
  @text('customer_id') customerId!: string | null;
  @text('stylist_id') stylistId!: string | null;
  @date('appointment_date') appointmentDate!: Date;
  @field('duration_minutes') durationMinutes!: number;
  @text('service_type') serviceType!: string;
  @text('status') status!: AppointmentStatus;
  @text('notes') notes!: string | null;
  @text('confirmation_code') confirmationCode!: string;
}
