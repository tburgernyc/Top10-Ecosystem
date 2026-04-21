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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LocatorMap({ locations }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nearestId, setNearestId] = useState<string | null>(null);
  const hasMapKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  const filtered = locations.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const { latitude, longitude } = coords;
      let nearest: Tenant | null = null;
      let minDist = Infinity;
      for (const loc of locations) {
        if (!loc.location_data) continue;
        const d = haversineKm(latitude, longitude, loc.location_data.lat, loc.location_data.lng);
        if (d < minDist) { minDist = d; nearest = loc; }
      }
      if (nearest) {
        setNearestId(nearest.id);
        setSelectedLocation(nearest);
        if (mapInstanceRef.current && nearest.location_data) {
          mapInstanceRef.current.panTo({ lat: nearest.location_data.lat, lng: nearest.location_data.lng });
          mapInstanceRef.current.setZoom(10);
        }
      }
    }, () => {/* permission denied — silent */});
  }, [locations]);

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

      mapInstanceRef.current = map;

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
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: 'calc(100dvh - 14rem)', minHeight: '600px' }}>
      {/* List panel */}
      <div
        style={{
          background: 'var(--color-bg-elevated)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search — font-size 1rem mandatory for iOS auto-zoom prevention */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border)' }}>
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
                  border: `1px solid ${selectedLocation?.id === location.id ? 'var(--color-primary)' : 'transparent'}`,
                  background: selectedLocation?.id === location.id
                    ? 'var(--color-surface-glass-md)'
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>{location.name}</p>
                  {nearestId === location.id && (
                    <span style={{ fontSize: '0.65rem', background: 'var(--color-brand-accent)', color: '#000', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-pill)', fontWeight: 700, letterSpacing: '0.04em' }}>
                      NEAREST
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
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
      {hasMapKey ? (
        <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '600px' }} aria-label="Boutique locations map" />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            background: 'var(--color-bg-elevated)',
            minHeight: '600px',
          }}
          aria-label="Map unavailable"
        >
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Map preview unavailable
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
            Configure <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the map.
          </p>
        </div>
      )}
    </div>
  );
}
