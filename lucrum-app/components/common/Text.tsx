/**
 * Themed Text components
 *
 * Provides consistent typography matching the design system.
 * Financial data MUST use <MonoText> with tabularNums.
 */

import {
  Text as RNText,
  StyleSheet,
  Platform,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";
import { Colors, FontSizes } from "@/constants/theme";

// Platform-safe monospace font (no custom font loading required)
const MONO_FONT = Platform.select({
  android: "monospace",
  ios: "Menlo",
  default: "monospace",
});

interface TextProps extends RNTextProps {
  variant?: "body" | "caption" | "heading" | "label";
  color?: string;
}

export function Text({
  variant = "body",
  color,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      style={[
        styles.base,
        variantStyles[variant],
        color ? { color } : undefined,
        style,
      ]}
      {...props}
    />
  );
}

interface MonoTextProps extends RNTextProps {
  size?: keyof typeof FontSizes;
  color?: string;
}

/**
 * Monospace text for financial data
 * Automatically applies tabular-nums equivalent
 */
export function MonoText({
  size = "base",
  color = Colors.textPrimary,
  style,
  ...props
}: MonoTextProps) {
  return (
    <RNText
      style={[
        {
          fontFamily: MONO_FONT,
          fontSize: FontSizes[size],
          color,
          fontVariant: ["tabular-nums"],
        },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: Colors.textPrimary,
    fontSize: FontSizes.base,
  },
});

const variantStyles: Record<string, TextStyle> = {
  body: {
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.5,
  },
  caption: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: FontSizes.sm * 1.4,
  },
  heading: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    lineHeight: FontSizes.xl * 1.3,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
};
