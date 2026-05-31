// frontend/src/components/Dice.jsx
import React, { useState, useEffect } from 'react';

const DICE_FACES = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅',
};

// Dot positions for each face
const DOTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

export default function Dice({ value, rolling, danger }) {
  const [displayValue, setDisplayValue] = useState(value || 6);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (rolling) {
      setIsRolling(true);
      let counter = 0;
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
        counter++;
        if (counter > 12) {
          clearInterval(interval);
          setDisplayValue(value);
          setIsRolling(false);
        }
      }, 80);
      return () => clearInterval(interval);
    } else if (value) {
      setDisplayValue(value);
    }
  }, [rolling, value]);

  const dots = DOTS[displayValue] || DOTS[6];
  const isDangerous = displayValue === 1;

  return (
    <div style={{
      width: '120px',
      height: '120px',
      background: isDangerous && !isRolling
        ? 'linear-gradient(135deg, #7f1d1d, #ef4444)'
        : 'linear-gradient(135deg, #1e1e3a, #2a2a4a)',
      border: `3px solid ${isDangerous && !isRolling ? 'var(--danger2)' : 'var(--border)'}`,
      borderRadius: '20px',
      position: 'relative',
      boxShadow: isDangerous && !isRolling
        ? '0 0 30px rgba(239, 68, 68, 0.5), inset 0 0 20px rgba(239, 68, 68, 0.1)'
        : '0 8px 32px rgba(0,0,0,0.5)',
      animation: isRolling
        ? 'diceRoll 0.8s ease-in-out'
        : isDangerous
          ? 'shake 0.5s ease'
          : 'none',
      transition: 'all 0.3s ease',
    }}>
      {dots.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: isDangerous && !isRolling
              ? 'rgba(255,255,255,0.9)'
              : 'var(--text)',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: isDangerous && !isRolling
              ? '0 0 8px rgba(255,255,255,0.5)'
              : 'none',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}
