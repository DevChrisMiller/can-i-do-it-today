export function HeroMark() {
  return (
    <svg
      viewBox="0 0 120 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="h-20 w-auto"
    >
      <defs>
        <linearGradient id="sun-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Sun */}
      <circle cx="34" cy="34" r="14" fill="url(#sun-grad)" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 34 + Math.cos(rad) * 18;
        const y1 = 34 + Math.sin(rad) * 18;
        const x2 = 34 + Math.cos(rad) * 23;
        const y2 = 34 + Math.sin(rad) * 23;
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#f59e0b"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        );
      })}

      {/* Cloud */}
      <g fill="#ffffff" stroke="#2d3b4a" stroke-width="2" stroke-linejoin="round">
        <path d="M 58 44
                 Q 58 34, 68 34
                 Q 72 26, 82 28
                 Q 92 26, 94 36
                 Q 104 38, 102 48
                 Q 100 54, 92 54
                 L 64 54
                 Q 56 54, 58 44 Z" />
      </g>

      {/* Raindrops */}
      <g fill="#3b82f6">
        <path d="M 70 60 Q 70 64, 72 66 Q 74 64, 74 60 Q 72 58, 70 60 Z" />
        <path d="M 82 64 Q 82 68, 84 70 Q 86 68, 86 64 Q 84 62, 82 64 Z" />
        <path d="M 94 60 Q 94 64, 96 66 Q 98 64, 98 60 Q 96 58, 94 60 Z" />
      </g>

      {/* Thermometer */}
      <g>
        <rect
          x="14"
          y="52"
          width="6"
          height="20"
          rx="3"
          fill="#ffffff"
          stroke="#2d3b4a"
          stroke-width="2"
        />
        <circle
          cx="17"
          cy="72"
          r="5"
          fill="#ef4444"
          stroke="#2d3b4a"
          stroke-width="2"
        />
        <rect x="15.5" y="60" width="3" height="10" fill="#ef4444" />
      </g>
    </svg>
  );
}
