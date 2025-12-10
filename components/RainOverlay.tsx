import React, { useMemo } from 'react';

const RainOverlay = React.memo(() => {
  const drops = useMemo(() => Array.from({ length: 60 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 0.8 + Math.random() * 0.4
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {drops.map((drop, i) => (
        <div
          key={i}
          className="absolute bg-blue-300"
          style={{
            left: `${drop.left}%`,
            top: '-50px',
            width: '2px',
            height: '50px',
            opacity: 0.6,
            animation: `rain-fall ${drop.duration}s linear infinite`,
            animationDelay: `-${drop.delay}s`
          }}
        />
      ))}
    </div>
  );
});

export default RainOverlay;
