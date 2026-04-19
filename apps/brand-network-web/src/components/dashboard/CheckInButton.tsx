'use client';

import { useTransition } from 'react';
import { checkInWalkIn } from '@/actions/walk-in-actions';

interface Props {
  walkInId: string;
  currentStatus: string;
}

export default function CheckInButton({ walkInId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  if (currentStatus !== 'waiting') return null;

  return (
    <button
      type="button"
      className="btn-primary"
      style={{ padding: '0.375rem 1rem', fontSize: '0.75rem' }}
      disabled={isPending}
      aria-disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await checkInWalkIn(walkInId);
        });
      }}
    >
      {isPending ? '…' : 'Call In'}
    </button>
  );
}
