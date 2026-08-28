import React from 'react';

interface AvatarProps {
  name: string;
  className?: string;
}

export function Avatar({ name, className = '' }: AvatarProps) {
  // Hash name to hue (0-360) deterministically
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const hue = Math.abs(hash) % 360;
  
  // Use HSL with fixed saturation and lightness for nice colored avatar backgrounds
  const bgColor = `hsl(${hue}, 70%, 50%)`;
  
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div 
      className={`flex items-center justify-center rounded-full text-white font-bold shrink-0 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  );
}
