/**
 * Screen - Base screen container with safe area and theme
 */

import { type ReactNode } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";

interface ScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Whether to add horizontal padding (default: true) */
  padded?: boolean;
  /** Background color override */
  backgroundColor?: string;
}

export function Screen({
  children,
  style,
  padded = true,
  backgroundColor = Colors.void,
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <View style={[styles.container, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.void,
  },
  padded: {
    paddingHorizontal: 16,
  },
});
