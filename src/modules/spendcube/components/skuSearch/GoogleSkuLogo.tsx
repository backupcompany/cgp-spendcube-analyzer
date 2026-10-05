import React from 'react';

export const GoogleSkuLogo: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 56 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 drop-shadow-xs ${className}`}
  >
    {/* Magnifying Glass Outer Rim */}
    <circle cx="32" cy="32" r="23" stroke="#1e293b" strokeWidth="4.5" fill="#ffffff" />
    
    {/* 3D Isometric Cardboard Box inside lens */}
    {/* Box Left Face */}
    <polygon points="21,30 32,36 32,47 21,41" fill="#f59e0b" stroke="#1e293b" strokeWidth="2.5" strokeLinejoin="round" />
    {/* Box Right Face */}
    <polygon points="32,36 43,30 43,41 32,47" fill="#d97706" stroke="#1e293b" strokeWidth="2.5" strokeLinejoin="round" />
    {/* Box Top Face */}
    <polygon points="32,24 43,30 32,36 21,30" fill="#fef3c7" stroke="#1e293b" strokeWidth="2.5" strokeLinejoin="round" />
    {/* Box Tape Stripe on Top Face */}
    <polygon points="29,25.5 35,29 35,34.5 29,31" fill="#b45309" opacity="0.85" />

    {/* Magnifying Glass Handle */}
    <path
      d="M49 49L63 63"
      stroke="#1e293b"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <path
      d="M52 52L61 61"
      stroke="#f59e0b"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);
