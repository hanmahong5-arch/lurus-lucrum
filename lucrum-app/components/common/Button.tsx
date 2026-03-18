/**
 * Button - Tactile button component matching design system
 */

import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { Colors, BorderRadius, Spacing } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Enable haptic feedback on press (default: true) */
  haptic?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  haptic = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "ghost" ? Colors.primary : Colors.textPrimary}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "ghost" && { color: Colors.primary },
            variant === "secondary" && { color: Colors.textPrimary },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: Colors.statusBlock,
  },
};
