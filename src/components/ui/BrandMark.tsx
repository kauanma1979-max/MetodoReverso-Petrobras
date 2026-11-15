export function BrandMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
      <circle cx="16" cy="16" r="8.5" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.75" />
      <path
        d="M21.5 11.5C19.8 9.6 17.1 8.8 14.5 9.5C11.1 10.4 9 13.8 9.8 17.2C10.6 20.6 14 22.8 17.5 22C19.8 21.5 21.5 19.9 22.3 17.9"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19.5 8.5L22.5 11.5L18.5 12.5"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.25" fill="#5EEAD4" />
    </svg>
  );
}
