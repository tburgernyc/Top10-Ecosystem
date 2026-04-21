'use client';

import { useState, useTransition, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Boutique = { id: string; name: string; city: string; state: string };

type Step = 'location' | 'service' | 'customer' | 'time' | 'confirm';

type CustomerInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate: string;
};

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
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isPending, startTransition] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerInfo>({
    firstName: '', lastName: '', phone: '', email: '', eventType: '', eventDate: '',
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch('/api/boutiques')
      .then((r) => r.json())
      .then((d: { boutiques: Boutique[] }) => setBoutiques(d.boutiques ?? []))
      .catch(() => {/* non-fatal */});
  }, []);

  useEffect(() => {
    if (!selectedDate || !locationId || step !== 'time') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlotsLoading(true);
    setAvailableSlots(null);
    fetch(`/api/bookings/availability?tenantId=${locationId}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((d: { available: string[] }) => setAvailableSlots(d.available ?? []))
      .catch(() => setAvailableSlots(['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM']))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, locationId, step]);

  // Pre-populate location from /locator query param
  const preselectedLocation = searchParams.get('location') ?? '';

  const steps: Step[] = ['location', 'service', 'customer', 'time', 'confirm'];
  const currentStepIndex = steps.indexOf(step);

  const handleConfirm = () => {
    startTransition(async () => {
      setBookingError(null);
      try {
        const response = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, serviceId, date: selectedDate, time: selectedTime, customer }),
          // selectedDate is YYYY-MM-DD string; bookings/create parses it
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
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Confirmation Code</p>
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
                ? 'var(--color-primary)'
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
          {boutiques.length > 0 ? (
            <select
              id="booking-location"
              className="input-luxury"
              value={locationId || preselectedLocation}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ fontSize: '1rem', width: '100%' }}
            >
              <option value="">Select a boutique…</option>
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.city}, {b.state}</option>
              ))}
            </select>
          ) : (
            <input
              id="booking-location"
              type="text"
              className="input-luxury"
              placeholder="Loading boutiques…"
              value={locationId || preselectedLocation}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ fontSize: '1rem' }}
            />
          )}
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
                  border: `1px solid ${serviceId === service.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: serviceId === service.id ? 'var(--color-surface-glass-md)' : 'var(--color-bg-glass)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>{service.label}</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {service.description} · {service.duration} min
                </p>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('location')} style={{ flex: 1 }}>Back</button>
            <button type="button" className="btn-primary" disabled={!serviceId} onClick={() => setStep('customer')} style={{ flex: 2 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step: Customer Info */}
      {step === 'customer' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Your Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>First Name *</label>
                <input className="input-luxury" style={{ fontSize: '1rem' }} value={customer.firstName}
                  onChange={(e) => setCustomer((c) => ({ ...c, firstName: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Last Name *</label>
                <input className="input-luxury" style={{ fontSize: '1rem' }} value={customer.lastName}
                  onChange={(e) => setCustomer((c) => ({ ...c, lastName: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Email *</label>
              <input type="email" className="input-luxury" style={{ fontSize: '1rem' }} value={customer.email}
                onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Phone Number *</label>
              <input type="tel" className="input-luxury" style={{ fontSize: '1rem' }} value={customer.phone}
                onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Event Type *</label>
              <select className="input-luxury" style={{ fontSize: '1rem' }} value={customer.eventType}
                onChange={(e) => setCustomer((c) => ({ ...c, eventType: e.target.value }))}>
                <option value="">Select event…</option>
                <option value="Prom">Prom</option>
                <option value="Wedding">Wedding</option>
                <option value="Homecoming">Homecoming</option>
                <option value="Quinceañera">Quinceañera</option>
                <option value="Pageant">Pageant</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Event Date</label>
              <input type="date" className="input-luxury" style={{ fontSize: '1rem' }} value={customer.eventDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCustomer((c) => ({ ...c, eventDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('service')} style={{ flex: 1 }}>Back</button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 2 }}
              disabled={!customer.firstName || !customer.lastName || !customer.email || !customer.phone || !customer.eventType}
              onClick={() => setStep('time')}
            >
              Continue
            </button>
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
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
            min={new Date().toISOString().split('T')[0]}
            style={{ marginBottom: '1rem', fontSize: '1rem' }}
          />
          {slotsLoading && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Checking availability…</p>
          )}
          {!slotsLoading && availableSlots !== null && availableSlots.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>No slots available for this date — try another day.</p>
          )}
          {!slotsLoading && availableSlots && availableSlots.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {availableSlots.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  style={{
                    padding: '0.75rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${selectedTime === time ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: selectedTime === time ? 'var(--color-surface-glass-md)' : 'transparent',
                    color: selectedTime === time ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('customer')} style={{ flex: 1 }}>Back</button>
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
                ['Name', `${customer.firstName} ${customer.lastName}`],
                ['Email', customer.email],
                ['Event', `${customer.eventType}${customer.eventDate ? ` · ${new Date(customer.eventDate + 'T12:00:00').toLocaleDateString()}` : ''}`],
                ['Service', SERVICES.find((s) => s.id === serviceId)?.label ?? ''],
                ['Date', selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString() : ''],
                ['Time', selectedTime],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{label}</p>
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
