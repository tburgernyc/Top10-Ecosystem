/// <reference types="@types/google.maps" />
'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import Link from 'next/link';
import type { tenants } from '@toptenprom/database';

type Tenant = typeof tenants.$inferSelect;

interface Props {
  locations: Tenant[];
}

export default function LocatorMap({ locations }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = locations.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({ apiKey, version: 'beta', libraries: ['maps', 'marker'] });

    void loader.load().then(async () => {
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

      const map = new Map(mapRef.current!, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        mapId: 'TOP10PROM_MAP',
        disableDefaultUI: true,
        zoomControl: true,
        backgroundColor: '#0B0A0E',
      });

      locations.forEach((location) => {
        if (!location.location_data) return;
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: location.location_data.lat, lng: location.location_data.lng },
          title: location.name,
        });

        marker.addListener('click', () => {
          setSelectedLocation(location);
          map.panTo({ lat: location.location_data!.lat, lng: location.location_data!.lng });
        });
      });
    });
  }, [locations]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: 'calc(100dvh - 12rem)' }}>
      {/* List panel */}
      <div
        style={{
          background: 'var(--color-bg-elevated)',
          borderRight: '1px solid var(--color-surface-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search — font-size 1rem mandatory for iOS auto-zoom prevention */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-surface-border)' }}>
          <input
            id="locator-search"
            type="search"
            className="input-luxury"
            placeholder="Search by city or state…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search boutique locations"
            style={{ fontSize: '1rem' }}
          />
        </div>

        {/* Results list */}
        <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', padding: '0.75rem' }}>
          {filtered.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                onClick={() => setSelectedLocation(location)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedLocation?.id === location.id ? 'var(--color-brand-primary)' : 'transparent'}`,
                  background: selectedLocation?.id === location.id
                    ? 'var(--color-surface-glass-md)'
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  marginBottom: '0.5rem',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  {location.name}
                </p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  {location.city}, {location.state}
                </p>
                {selectedLocation?.id === location.id && (
                  <Link
                    href={`/book?location=${location.id}`}
                    className="btn-primary"
                    style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
                  >
                    Book at This Location
                  </Link>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Map canvas */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} aria-label="Boutique locations map" />
    </div>
  );
}
