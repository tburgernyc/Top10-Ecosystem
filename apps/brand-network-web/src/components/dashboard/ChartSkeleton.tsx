export default function ChartSkeleton() {
  return (
    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', padding: '1rem 0' }}>
      {[65, 80, 45, 90, 55, 70, 85].map((height, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${height}%`,
            background: 'var(--color-surface-glass-md)',
            borderRadius: 'var(--radius-sm)',
            animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
