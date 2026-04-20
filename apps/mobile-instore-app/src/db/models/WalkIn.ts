import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export type WalkInStatus = 'waiting' | 'called' | 'with_stylist' | 'completed' | 'left';

export default class WalkIn extends Model {
  static table = 'walk_ins';

  @text('tenant_id') tenantId!: string;
  @text('customer_name') customerName!: string;
  @text('phone_number') phoneNumber!: string;
  @field('party_size') partySize!: number;
  @text('occasion') occasion!: string | null;
  @text('notes') notes!: string | null;
  @text('status') status!: WalkInStatus;
  @field('queue_position') queuePosition!: number;
  @field('estimated_wait_minutes') estimatedWaitMinutes!: number | null;
  @text('assigned_stylist_id') assignedStylistId!: string | null;
  @date('checked_in_at') checkedInAt!: Date;
  @date('called_at') calledAt!: Date | null;
  @date('completed_at') completedAt!: Date | null;
}
