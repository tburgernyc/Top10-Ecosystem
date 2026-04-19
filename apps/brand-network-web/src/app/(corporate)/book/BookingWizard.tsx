'use client';

import { useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Step = 'location' | 'service' | 'time' | 'confirm';

const SERVICES = [
  { id: 'prom-styling', label: 'Prom Styling Session', duration: 90, description: 'Full 90-minute personal styling with our expert team.' },
  { id: 'wedding-consultation', label: 'Wedding Consultation', duration: 60, description: '60-minute consultation for bridal party and wedding gowns.' },
  { id: 'vto-session', label: 'VTO In-Store Session', duration: 45, description: 'Try dresses guided by your AI Virtual Try-On results.' },
  { id: 'alteration-fitting', label: 'Alteration Fitting', duration: 30, description: '30-minute fitting appointment for alterations.' },
] as const;

function BookingWizardInner() {
  const [step, setStep] = useState<Step>('location');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [isPending, startTransition] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-populate location from /locator query param
  const preselectedLocation = searchParams.get('location') ?? '';

  const steps: Step[] = ['location', 'service', 'time', 'confirm'];
  const currentStepIndex = steps.indexOf(step);

  const handleConfirm = () => {
    startTransition(async () => {
      setBookingError(null);
      try {
        const response = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, serviceId, date: selectedDate, time: selectedTime }),
        });

        if (!response.ok) {
          const { error, nearbyLocation } = await response.json() as { error: string; nearbyLocation?: string };
          if (nearbyLocation) {
            setBookingError('Primary location full. We found availability at a nearby boutique. Redirecting…');
            setTimeout(() => router.push(`/book?location=${nearbyLocation}`), 2000);
          } else {
            setBookingError(error ?? 'Booking failed. Please try again.');
          }
          return;
        }

        const { confirmation_code } = await response.json() as { confirmation_code: string };
        setConfirmationCode(confirmation_code);
      } catch {
        setBookingError('Network error. Please check your connection and try again.');
      }
    });
  };

  if (confirmationCode) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✓</div>
        <p className="label-luxury" style={{ color: 'var(--color-success)', marginBottom: '0.75rem' }}>Confirmed</p>
        <h2 className="heading-display" style={{ fontSize: '2rem', marginBottom: '1rem' }}>You&apos;re Booked!</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Confirmation Code</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--color-brand-secondary)', fontWeight: 700 }}>
          {confirmationCode}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '2.5rem' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              width: '32px',
              height: '4px',
              borderRadius: 'var(--radius-pill)',
              background: i <= currentStepIndex
                ? 'var(--color-brand-primary)'
                : 'var(--color-surface-border-md)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Step: Location */}
      {step === 'location' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Choose Location</h2>
          <input
            id="booking-location"
            type="text"
            className="input-luxury"
            placeholder="Enter location ID or browse /locator"
            value={locationId || preselectedLocation}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', marginTop: '1.5rem' }}
            disabled={!locationId && !preselectedLocation}
            onClick={() => { if (!locationId && preselectedLocation) setLocationId(preselectedLocation); setStep('service'); }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step: Service */}
      {step === 'service' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Select Service</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {SERVICES.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceId(service.id)}
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${serviceId === service.id ? 'var(--color-brand-primary)' : 'var(--color-surface-border)'}`,
                  background: serviceId === service.id ? 'var(--color-surface-glass-md)' : 'var(--color-surface-glass)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{service.label}</p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {service.description} · {service.duration} min
                </p>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('location')} style={{ flex: 1 }}>Back</button>
            <button type="button" className="btn-primary" disabled={!serviceId} onClick={() => setStep('time')} style={{ flex: 2 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step: Time */}
      {step === 'time' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Select Date &amp; Time</h2>
          <input
            id="booking-date"
            type="date"
            className="input-luxury"
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            style={{ marginBottom: '1rem', fontSize: '1rem' /* iOS zoom prevention */ }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {['10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'].map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                style={{
                  padding: '0.75rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedTime === time ? 'var(--color-brand-primary)' : 'var(--color-surface-border)'}`,
                  background: selectedTime === time ? 'var(--color-surface-glass-md)' : 'transparent',
                  color: selectedTime === time ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {time}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('service')} style={{ flex: 1 }}>Back</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep('confirm')}
              style={{ flex: 2 }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Confirm Booking</h2>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {([
                ['Service', SERVICES.find((s) => s.id === serviceId)?.label ?? ''],
                ['Date', selectedDate?.toLocaleDateString() ?? ''],
                ['Time', selectedTime],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{label}</p>
                  <p style={{ fontWeight: 600 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {bookingError && (
            <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
              {bookingError}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('time')} style={{ flex: 1 }}>Back</button>
            <button
              type="button"
              id="booking-confirm-btn"
              className="btn-primary"
              onClick={handleConfirm}
              // Double-submit prevention — mandatory guardrail
              disabled={isPending}
              aria-disabled={isPending}
              style={{
                flex: 2,
                opacity: isPending ? 0.5 : 1,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Confirming…' : 'Confirm Appointment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense because useSearchParams() requires it
export default function BookingWizard() {
  return (
    <Suspense fallback={<div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>Loading…</div>}>
      <BookingWizardInner />
    </Suspense>
  );
}
