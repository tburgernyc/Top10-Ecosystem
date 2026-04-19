import type { Metadata } from 'next';
import BookingWizard from './BookingWizard';
import BackButton from '@/components/navigation/BackButton';

export const metadata: Metadata = {
  title: 'Book an Appointment | Top 10 Prom',
  description: 'Schedule a personal styling session at your nearest Top 10 Prom boutique.',
};

export default function BookPage() {
  return (
    <div className="mesh-bg" style={{ minHeight: '100dvh', paddingTop: '8rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <BackButton />
        </div>
        <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>Schedule</p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', textAlign: 'center', marginBottom: '3rem' }}>
          Book Your Appointment
        </h1>
        <BookingWizard />
      </div>
    </div>
  );
}
