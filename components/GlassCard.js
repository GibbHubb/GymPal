import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';

export default function GlassCard({ children, style, ...props }) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface, // Or Theme.colors.transparentLight
    borderRadius: Theme.borderRadius.l,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    padding: Theme.spacing.m,
    marginVertical: Theme.spacing.s,
    // Add glass glow if needed
    ...Theme.shadows.glass,
  },
});
