import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { COLORS } from '../theme';
import { GeneratorIcon } from './icons/GeneratorIcon';

type Props = {
  live: boolean;
  // The gas plant is needed: its icon replaces the green dot (while live).
  plantNeeded?: boolean;
};

const SIZE = 10;
const PLANT_SIZE = 26;

export function LiveDot({ live, plantNeeded = false }: Props) {
  const showPlant = live && plantNeeded;
  const ripple = useRef(new Animated.Value(0)).current;

  // The ripple only runs while live; stale state is a static red dot.
  useEffect(() => {
    if (!live || showPlant) return;
    const loop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      ripple.setValue(0);
    };
  }, [live, showPlant, ripple]);

  const scale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const opacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  if (showPlant) {
    return (
      <View style={styles.plantWrap} accessible accessibilityLabel="Planta necesaria" pointerEvents="none">
        <GeneratorIcon size={PLANT_SIZE} />
      </View>
    );
  }

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={live ? 'Datos en vivo, actualizados ahora' : 'Sin conexión'}
      pointerEvents="none"
    >
      {live ? (
        <Animated.View
          style={[styles.dot, styles.ripple, { backgroundColor: COLORS.green, opacity, transform: [{ scale }] }]}
        />
      ) : null}
      <View style={[styles.dot, { backgroundColor: live ? COLORS.green : COLORS.red }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 15, left: '50%', marginLeft: -SIZE / 2, width: SIZE, height: SIZE },
  // Centered on the dot's center (top 15 + SIZE / 2).
  plantWrap: {
    position: 'absolute',
    top: 20 - PLANT_SIZE / 2,
    left: '50%',
    marginLeft: -PLANT_SIZE / 2,
    width: PLANT_SIZE,
    height: PLANT_SIZE,
  },
  dot: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  ripple: { position: 'absolute', top: 0, left: 0 },
});
