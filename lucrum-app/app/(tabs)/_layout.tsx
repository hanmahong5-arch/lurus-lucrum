/**
 * Bottom Tab Navigation Layout
 *
 * 5 tabs: Market | Strategy | Advisor | Portfolio | Profile
 */

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Platform } from "react-native";
import { Colors, FontSizes } from "@/constants/theme";

type TabIcon = React.ComponentProps<typeof Ionicons>["name"];

const TAB_CONFIG: {
  name: string;
  title: string;
  icon: TabIcon;
  iconFocused: TabIcon;
}[] = [
  { name: "market", title: "Market", icon: "trending-up-outline", iconFocused: "trending-up" },
  { name: "strategy", title: "Strategy", icon: "code-slash-outline", iconFocused: "code-slash" },
  { name: "advisor", title: "Advisor", icon: "chatbubble-ellipses-outline", iconFocused: "chatbubble-ellipses" },
  { name: "portfolio", title: "Portfolio", icon: "pie-chart-outline", iconFocused: "pie-chart" },
  { name: "profile", title: "Profile", icon: "person-outline", iconFocused: "person" },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: Platform.OS === "android" ? 60 : 85,
    paddingBottom: Platform.OS === "android" ? 8 : 28,
    paddingTop: 8,
    elevation: 0,
  },
  tabLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
  },
});
