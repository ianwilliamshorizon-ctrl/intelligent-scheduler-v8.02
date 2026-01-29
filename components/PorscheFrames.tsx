import React from 'react';

// Traced from user-provided image of a Porsche 911 (top-down view)
const Porsche911TopView = () => (
    <svg viewBox="0 0 250 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <g fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Main Body */}
            <path d="M125 10 C 90 10, 50 40, 40 90 L 30 150 C 25 200, 25 300, 30 350 L 20 420 C 30 470, 80 490, 125 490 C 170 490, 220 470, 230 420 L 220 350 C 225 300, 225 200, 220 150 L 210 90 C 200 40, 160 10, 125 10 Z" />
            {/* Cabin/Greenhouse */}
            <path d="M75 60 L 175 60 C 195 90, 205 140, 200 250 C 195 300, 170 340, 125 340 C 80 340, 55 300, 50 250 C 45 140, 55 90, 75 60 Z" />
            {/* Windscreen */}
            <path d="M75 60 Q 125 45, 175 60" />
            <path d="M65 120 Q 125 110, 185 120" />
            {/* Rear Window */}
            <path d="M65 270 Q 125 260, 185 270" />
            <path d="M75 320 Q 125 330, 175 320" />
            {/* Engine Vents */}
            <line x1="85" y1="360" x2="165" y2="360" />
            <line x1="85" y1="370" x2="165" y2="370" />
            <line x1="85" y1="380" x2="165" y2="380" />
            <rect x="80" y="350" width="90" height="40" rx="5" />
            {/* Headlights */}
            <ellipse cx="50" cy="50" rx="10" ry="15" transform="rotate(-10 50 50)" />
            <ellipse cx="200" cy="50" rx="10" ry="15" transform="rotate(10 200 50)" />
        </g>
    </svg>
);

// Based on user-provided image of a Porsche Boxster
const PorscheConvertibleTopView = () => (
  <svg viewBox="0 0 250 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <g fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M125 10 C 90 10, 50 30, 30 80 L 20 150 C 15 200, 15 300, 20 350 L 30 420 C 50 470, 90 490, 125 490 C 160 490, 200 470, 220 420 L 230 350 C 235 300, 235 200, 230 150 L 220 80 C 200 30, 160 10, 125 10 Z" />
      <path d="M75 25 L 50 80 C 50 110, 70 140, 125 140 C 180 140, 200 110, 200 80 L 175 25 Z" />
      <ellipse cx="65" cy="80" rx="18" ry="30" />
      <ellipse cx="185" cy="80" rx="18" ry="30" />
      
      {/* Soft Top Area */}
      <path d="M45 150 L 205 150 L 195 280 L 55 280 Z" fill="#f5f5f5" strokeWidth="1" />
      <path d="M45 165 C 35 160, 30 170, 35 180 Z" />
      <path d="M205 165 C 215 160, 220 170, 215 180 Z" />
      
      {/* Roll Hoops */}
      <rect x="65" y="290" width="40" height="10" rx="3" fill="#d0d0d0" strokeWidth="1" />
      <rect x="145" y="290" width="40" height="10" rx="3" fill="#d0d0d0" strokeWidth="1" />
      
      {/* Rear Deck */}
      <path d="M40 310 L 210 310 L 210 380 Q 125 400, 40 380 Z" />
      
      {/* Lights */}
      <path d="M40 400 C 50 390, 80 390, 90 400 L 90 415 L 40 415 Z" />
      <path d="M210 400 C 200 390, 170 390, 160 400 L 160 415 L 210 415 Z" />
    </g>
  </svg>
);

// Generic estate/wagon based on user's Audi RS6 image
const EstateTopView = () => (
    <svg viewBox="0 0 250 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <g fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M125 10 C 90 10, 50 30, 30 80 L 25 140 L 20 160 L 20 400 C 20 450, 60 490, 125 490 C 190 490, 230 450, 230 400 L 230 160 L 225 140 L 220 80 C 200 30, 160 10, 125 10 Z" />
            <path d="M75 25 L 50 80 C 50 110, 70 130, 125 130 C 180 130, 200 110, 200 80 L 175 25 Z" />
            
            {/* Long Roof */}
            <path d="M45 145 L 205 145 L 210 410 L 40 410 Z" fill="#f9f9f9" strokeWidth="1" />
            
            {/* Roof Rails */}
            <line x1="40" y1="150" x2="40" y2="400" strokeWidth="2" stroke="#999" />
            <line x1="210" y1="150" x2="210" y2="400" strokeWidth="2" stroke="#999" />

            <line x1="125" y1="145" x2="125" y2="410" strokeDasharray="5,5" />
            <line x1="45" y1="250" x2="205" y2="250" strokeDasharray="5,5" />
        </g>
    </svg>
);

// Traced from user-provided generic saloon image
const GenericSaloonTopView = () => (
    <svg viewBox="0 0 250 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <g fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M125 10 C 90 10, 50 30, 30 80 L 25 140 L 20 160 L 20 340 L 25 360 L 30 420 C 50 470, 90 490, 125 490 C 160 490, 200 470, 220 420 L 225 360 L 230 340 L 230 160 L 225 140 L 220 80 C 200 30, 160 10, 125 10 Z" />
            <path d="M75 25 L 50 80 C 50 110, 70 130, 125 130 C 180 130, 200 110, 200 80 L 175 25 Z" />
            
            {/* Cabin */}
            <path d="M45 145 L 205 145 L 210 355 L 40 355 Z" fill="#f9f9f9" strokeWidth="1" />
            
            {/* Boot */}
            <path d="M50 370 L 200 370 L 190 450 L 60 450 Z" />
            
            <line x1="125" y1="145" x2="125" y2="355" strokeDasharray="5,5"/>
            <line x1="45" y1="250" x2="205" y2="250" strokeDasharray="5,5"/>
        </g>
    </svg>
);

const SuvTopView = () => (
    <svg viewBox="0 0 250 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <g fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M125 10 C 80 10, 40 40, 30 90 L 20 150 L 20 350 L 30 410 C 40 460, 80 490, 125 490 C 170 490, 210 460, 220 410 L 230 350 L 230 150 L 220 90 C 210 40, 170 10, 125 10 Z" />
            <path d="M60 20 L 40 90 L 210 90 L 190 20 Z" />
            
            {/* Large Cabin */}
            <path d="M35 110 L 215 110 L 220 400 L 30 400 Z" fill="#f9f9f9" strokeWidth="1" />
            
            <line x1="125" y1="110" x2="125" y2="400" strokeDasharray="5,5" />
            <line x1="35" y1="250" x2="215" y2="250" strokeDasharray="5,5" />
        </g>
    </svg>
);

const VanTopView = () => (
    <svg viewBox="0 0 250 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <g fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Boxy Body */}
            <rect x="20" y="80" width="210" height="400" rx="10" />
            {/* Short Front */}
            <path d="M40 80 L 210 80 L 200 20 L 50 20 Z" />
            
            {/* Cabin */}
            <path d="M30 90 L 220 90 L 220 180 L 30 180 Z" fill="#f9f9f9" strokeWidth="1"/>
            
            <line x1="125" y1="90" x2="125" y2="470" strokeDasharray="5,5" />
            <line x1="20" y1="180" x2="230" y2="180" />
        </g>
    </svg>
);

const getVehicleType = (model?: string): '911' | 'convertible' | 'estate' | 'saloon' | 'suv' | 'van' => {
    if (!model) return 'saloon';
    const m = model.toLowerCase();

    if (m.includes('boxster') || m.includes('convertible') || m.includes('cabrio') || m.includes('spider') || m.includes('spyder') || m.includes('718') || m.includes('mx-5') || m.includes('z4')) return 'convertible';
    if (m.includes('911') || m.includes('cayman') || m.includes('coupe') || m.includes('gt3') || m.includes('gt2') || m.includes('carrera') || m.includes('targa') || m.includes('tt') || m.includes('r8')) return '911';
    if (m.includes('avant') || m.includes('estate') || m.includes('touring') || m.includes('wagon') || m.includes('shooting brake') || m.includes('sport turismo')) return 'estate';
    if (m.includes('suv') || m.includes('cayenne') || m.includes('macan') || m.includes('q5') || m.includes('q7') || m.includes('q8') || m.includes('x3') || m.includes('x5') || m.includes('tiguan') || m.includes('touareg')) return 'suv';
    if (m.includes('transporter') || m.includes('transit') || m.includes('van') || m.includes('caddy') || m.includes('sprinter') || m.includes('vivaro') || m.includes('boxer') || m.includes('berlingo')) return 'van';
    
    return 'saloon';
};


interface PorscheFramesProps {
  vehicleModel?: string;
  view: 'top' | 'side' | 'front' | 'rear';
}

const PorscheFrames: React.FC<PorscheFramesProps> = ({ vehicleModel, view }) => {
  const vehicleType = getVehicleType(vehicleModel);

  // The damage report primarily uses the 'top' view.
  // We will return the appropriate top-down SVG for each vehicle type.
  switch (vehicleType) {
    case '911': return <Porsche911TopView />;
    case 'convertible': return <PorscheConvertibleTopView />;
    case 'estate': return <EstateTopView />;
    case 'van': return <VanTopView />;
    case 'suv': return <SuvTopView />;
    case 'saloon':
    default:
        return <GenericSaloonTopView />;
  }
};

export default PorscheFrames;