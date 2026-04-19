'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { dresses } from '@toptenprom/database';

type Dress = typeof dresses.$inferSelect;

interface Props {
  dresses: Dress[];
  designers: string[];
  occasions: string[];
}

function FilterPill({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: string;
  current: string;
  onSelect: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      style={{
        padding: '0.5rem 1.25rem',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${current === value ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: current === value ? 'rgba(242,75,154,0.12)' : 'transparent',
        color: current === value ? 'var(--color-primary)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: current === value ? 600 : 400,
        whiteSpace: 'nowrap',
        transition: `all 0.2s var(--ease-luxury)`,
      }}
    >
      {label}
    </button>
  );
}

export default function CatalogGrid({ dresses, designers, occasions }: Props) {
  const [selectedOccasion, setSelectedOccasion] = useState<string>('all');
  const [selectedDesigner, setSelectedDesigner] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<string>('all');

  const filtered = useMemo(() => {
    return dresses.filter((d) => {
      if (selectedOccasion !== 'all' && d.occasion !== selectedOccasion) return false;
      if (selectedDesigner !== 'all' && d.designer !== selectedDesigner) return false;
      if (selectedColor !== 'all') {
        const colors = (d.available_colors as Array<{ name: string }>) ?? [];
        if (!colors.some((c) => c.name.toLowerCase() === selectedColor.toLowerCase())) return false;
      }
      return true;
    });
  }, [dresses, selectedOccasion, selectedDesigner, selectedColor]);

  // All unique colors across catalog — photography-based color filter
  const allColors = useMemo(() => {
    const colorMap = new Map<string, string>(); // name -> image_url
    dresses.forEach((d) => {
      const colors = (d.available_colors as Array<{ name: string; swatch_image_url: string }>) ?? [];
      colors.forEach((c) => {
        if (!colorMap.has(c.name)) {
          colorMap.set(c.name, c.swatch_image_url);
        }
      });
    });
    return colorMap;
  }, [dresses]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
      {/* Filter Bar */}
      <div
        style={{
          padding: '2rem 0',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Occasion filter */}
        <div>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Occasion</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <FilterPill label="All" value="all" current={selectedOccasion} onSelect={setSelectedOccasion} />
            {occasions.map((o) => (
              <FilterPill key={o} label={o.charAt(0).toUpperCase() + o.slice(1)} value={o} current={selectedOccasion} onSelect={setSelectedOccasion} />
            ))}
          </div>
        </div>

        {/* Designer filter */}
        <div>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Designer</p>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <FilterPill label="All Designers" value="all" current={selectedDesigner} onSelect={setSelectedDesigner} />
            {designers.map((d) => (
              <FilterPill key={d} label={d} value={d} current={selectedDesigner} onSelect={setSelectedDesigner} />
            ))}
          </div>
        </div>

        {/* Color filter — PHOTOGRAPHY-BASED. No CSS color swatches. */}
        {allColors.size > 0 && (
          <div>
            <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Color</p>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setSelectedColor('all')}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: `2px solid ${selectedColor === 'all' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: 'var(--color-bg-glass)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  transition: `border-color 0.2s var(--ease-luxury)`,
                  flexShrink: 0,
                }}
                title="All Colors"
                aria-label="Show all colors"
              >
                ✦
              </button>
              {Array.from(allColors.entries()).map(([colorName, imageUrl]) => (
                <button
                  key={colorName}
                  type="button"
                  onClick={() => setSelectedColor(colorName === selectedColor ? 'all' : colorName)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: `2px solid ${selectedColor === colorName ? 'var(--color-primary)' : 'transparent'}`,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    flexShrink: 0,
                    padding: 0,
                    // HIGH-RESOLUTION PHOTOGRAPHY — never CSS color values
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: `border-color 0.2s var(--ease-luxury)`,
                  }}
                  title={colorName}
                  aria-label={`Filter by ${colorName}`}
                  aria-pressed={selectedColor === colorName}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {filtered.length} {filtered.length === 1 ? 'style' : 'styles'} found
        </p>
      </div>

      {/* Dress Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
          padding: '2rem 0 4rem',
        }}
      >
        {filtered.map((dress) => {
          const images = dress.image_urls as { hero: string; gallery: string[] };
          const colors = (dress.available_colors as Array<{ name: string; swatch_image_url: string }>) ?? [];

          return (
            <article
              key={dress.id}
              className="glass-card"
              style={{ overflow: 'hidden', position: 'relative' }}
            >
              {/* Hero photography */}
              <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden' }}>
                <Image
                  src={images.hero ?? 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'}
                  alt={`${dress.name} by ${dress.designer}`}
                  fill
                  style={{
                    objectFit: 'cover',
                    transition: `transform 0.6s var(--ease-luxury)`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />

                {/* Exclusive badge */}
                {dress.is_exclusive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '1rem',
                      background: 'var(--color-brand-secondary)',
                      color: 'var(--color-text-inverse)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Exclusive
                  </div>
                )}

                {/* Quick actions overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '1.5rem 1rem 1rem',
                    background: 'linear-gradient(to top, rgba(11,10,14,0.9) 0%, transparent 100%)',
                    opacity: 0,
                    transition: `opacity 0.3s var(--ease-luxury)`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      href={`/try-on?dress_id=${dress.id}`}
                      className="btn-primary"
                      style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    >
                      Try On
                    </Link>
                    <Link
                      href={`/book?dress=${dress.id}`}
                      className="btn-ghost"
                      style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    >
                      Book
                    </Link>
                  </div>
                </div>
              </div>

              {/* Card metadata */}
              <div style={{ padding: '1.25rem' }}>
                <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>
                  {dress.occasion} · {dress.designer}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {dress.name}
                </h3>

                {/* Color photography strip — NO CSS swatches */}
                {colors.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {colors.slice(0, 5).map((color) => (
                      <div
                        key={color.name}
                        title={color.name}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '1px solid var(--color-border)',
                          backgroundImage: `url(${color.swatch_image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          flexShrink: 0,
                        }}
                        aria-label={color.name}
                      />
                    ))}
                    {colors.length > 5 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>
                        +{colors.length - 5}
                      </span>
                    )}
                  </div>
                )}

                <p style={{ color: 'var(--color-brand-secondary)', fontWeight: 700, fontSize: '1.0625rem' }}>
                  ${Number(dress.retail_price).toFixed(0)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
