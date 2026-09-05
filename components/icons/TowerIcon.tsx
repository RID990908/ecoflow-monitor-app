import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Torre de alta tensión a color, calcada de la referencia del usuario
// (vector Flaticon de pilón eléctrico): cuerpo gris-acero con degradé,
// alas navy en 2 niveles terminando en aisladores celestes, base oscura.
// A diferencia del resto de íconos (UsbIcon, BatteryIcon) usa paleta fija
// en vez de currentColor — decisión consciente del usuario de sacrificar
// la reactividad al estado (gris/verde/rojo) a cambio de fidelidad visual
// a la foto de referencia. Reemplaza el emoji 🔌 en los nodos AC/CA del
// diagrama y en el "Cargando por" (source-emoji).
export function TowerIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="towerGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#c2d0d8" />
          <Stop offset="1" stopColor="#7c8f9c" />
        </LinearGradient>
        <LinearGradient id="wingGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4a6072" />
          <Stop offset="1" stopColor="#1e2a35" />
        </LinearGradient>
        <LinearGradient id="insulatorGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9df0fb" />
          <Stop offset="1" stopColor="#1fa8c2" />
        </LinearGradient>
      </Defs>
      <Rect x="3.5" y="21" width="17" height="1.8" rx="0.9" fill="#12161b" />
      <Rect x="3.5" y="21" width="17" height="0.6" rx="0.3" fill="#333b43" opacity={0.7} />
      <Path
        d="M12,1.6 L7.2,21 M12,1.6 L16.8,21"
        stroke="url(#towerGrad)"
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.3,8.6 L14.7,8.6 M9.3,8.6 L14.7,14 M14.7,8.6 L9.3,14 M8.3,14 L15.7,14 M8.3,14 L11.6,21 M15.7,14 L12.4,21"
        stroke="url(#towerGrad)"
        strokeWidth={1.1}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.6,7.6 Q7.5,7.8 5,9.3 Q7.6,8.3 9.8,8.5 Z" fill="url(#wingGrad)" />
      <Path d="M14.4,7.6 Q16.5,7.8 19,9.3 Q16.4,8.3 14.2,8.5 Z" fill="url(#wingGrad)" />
      <Path d="M9,12.6 Q6.3,12.9 4,14.7 Q6.9,13.4 9.2,13.6 Z" fill="url(#wingGrad)" />
      <Path d="M15,12.6 Q17.7,12.9 20,14.7 Q17.1,13.4 14.8,13.6 Z" fill="url(#wingGrad)" />
      <Path
        d="M5,9.3 L5,10.3 M19,9.3 L19,10.3 M4,14.7 L4,15.7 M20,14.7 L20,15.7"
        stroke="#9aa8b0"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Ellipse cx="5" cy="11" rx="1.5" ry="1" fill="url(#insulatorGrad)" />
      <Ellipse cx="19" cy="11" rx="1.5" ry="1" fill="url(#insulatorGrad)" />
      <Ellipse cx="4" cy="16.4" rx="1.5" ry="1" fill="url(#insulatorGrad)" />
      <Ellipse cx="20" cy="16.4" rx="1.5" ry="1" fill="url(#insulatorGrad)" />
    </Svg>
  );
}
