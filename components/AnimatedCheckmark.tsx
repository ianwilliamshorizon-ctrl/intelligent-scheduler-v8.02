import React from 'react';

const AnimatedCheckmark: React.FC = () => (
    <svg 
        className="animated-checkmark-icon" 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 52 52"
    >
        <circle 
            className="animated-checkmark-circle" 
            cx="26" cy="26" r="23" 
            fill="none" 
            strokeWidth="3"
        />
        <path 
            className="animated-checkmark-check" 
            d="M14 27 l10 10 l15 -15" 
            fill="none" 
            strokeWidth="4"
            strokeLinecap="round"
        />
    </svg>
);

export default AnimatedCheckmark;