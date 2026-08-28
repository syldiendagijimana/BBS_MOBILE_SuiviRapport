import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme';

export default function GradientHeader({ children, style }) {
  return (
    <View style={[styles.header, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
});