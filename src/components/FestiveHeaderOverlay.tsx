import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type ParticleType =
  | 'cherry'   // 🌸 Hoa đào Tết
  | 'apricot'  // 🌼 Hoa mai vàng Tết
  | 'snow'     // ❄️ Tuyết Noel
  | 'confetti' // 🎉 Pháo giấy / Ruy băng lễ hội / FPT Day
  | 'stars'    // ✨ Sao lấp lánh (mặc định)
  | 'none';

interface FestiveHeaderOverlayProps {
  particleType?: ParticleType;
  count?: number;
}

const PARTICLE_GLYPHS: Record<ParticleType, string[]> = {
  cherry: ['🌸', '🌺', '🌸', '💮'],
  apricot: ['🌼', '🏵️', '🌼', '✨'],
  snow: ['❄️', '❅', '❆', '•'],
  confetti: ['🎉', '🎊', '🎈', '✨'],
  stars: ['✨', '⭐', '🌟', '•'],
  none: [],
};

const SCREEN_WIDTH = Dimensions.get('window').width || 380;
const HEADER_HEIGHT = 190;

interface SingleParticleProps {
  glyph: string;
  startX: number;
  delay: number;
  duration: number;
  size: number;
}

const SingleParticle: React.FC<SingleParticleProps> = ({
  glyph,
  startX,
  delay,
  duration,
  size,
}) => {
  const animY = useRef(new Animated.Value(-30)).current;
  const animSway = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const startFalling = () => {
      if (!isMounted) return;

      animY.setValue(-30);
      animOpacity.setValue(0);
      animRotate.setValue(0);

      // Animation rơi từ trên xuống
      const fallAnim = Animated.timing(animY, {
        toValue: HEADER_HEIGHT + 20,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      // Animation mờ dần rồi hiện rõ và mờ dần lúc chạm đáy
      const opacityAnim = Animated.sequence([
        Animated.timing(animOpacity, {
          toValue: 0.85,
          duration: duration * 0.25,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 0.85,
          duration: duration * 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: duration * 0.25,
          useNativeDriver: true,
        }),
      ]);

      // Animation lắc lư trái phải (sway)
      const swayAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(animSway, {
            toValue: 1,
            duration: duration * 0.35,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animSway, {
            toValue: -1,
            duration: duration * 0.35,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      // Animation xoay cánh hoa
      const rotateAnim = Animated.timing(animRotate, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      swayAnim.start();
      Animated.parallel([fallAnim, opacityAnim, rotateAnim]).start(({ finished }) => {
        if (finished && isMounted) {
          startFalling();
        }
      });
    };

    const timer = setTimeout(() => {
      startFalling();
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [delay, duration]);

  const swayDistance = animSway.interpolate({
    inputRange: [-1, 1],
    outputRange: [-18, 18],
  });

  const rotateDeg = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: startX,
          opacity: animOpacity,
          transform: [
            { translateY: animY },
            { translateX: swayDistance },
            { rotate: rotateDeg },
          ],
        },
      ]}
    >
      <Text style={{ fontSize: size }}>{glyph}</Text>
    </Animated.View>
  );
};

export const FestiveHeaderOverlay: React.FC<FestiveHeaderOverlayProps> = ({
  particleType = 'none',
  count = 14,
}) => {
  if (particleType === 'none') return null;

  const glyphs = PARTICLE_GLYPHS[particleType] || PARTICLE_GLYPHS.stars;
  if (glyphs.length === 0) return null;

  // Tạo các hạt với tọa độ ngẫu nhiên nhưng ổn định
  const particles = Array.from({ length: count }, (_, i) => {
    const glyph = glyphs[i % glyphs.length];
    const startX = ((i + 0.5) / count) * SCREEN_WIDTH * 0.9 + (Math.random() * 20 - 10);
    const delay = (i * 380) % 3500;
    const duration = 4500 + ((i * 530) % 3000);
    const size = particleType === 'snow' ? 12 + (i % 6) : 14 + (i % 8);

    return { id: i, glyph, startX, delay, duration, size };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p) => (
        <SingleParticle
          key={p.id}
          glyph={p.glyph}
          startX={p.startX}
          delay={p.delay}
          duration={p.duration}
          size={p.size}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
});
