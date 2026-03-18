/**
 * Loading indicators
 */

import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "./Text";
import { Colors } from "@/constants/theme";

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = false }: LoadingProps) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {message && <Text variant="caption" style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.void,
  },
  message: {
    marginTop: 12,
  },
});
