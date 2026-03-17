/**
 * Stock Search Modal
 *
 * Full-screen search with debounce, pinyin support,
 * and one-tap add to watchlist.
 */

import { useState, useCallback, useRef } from "react";
import {
  View,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, MonoText } from "@/components/common";
import { useStockSearch } from "@/lib/hooks/use-market-data";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface StockSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (symbol: string, name: string) => void;
  /** Symbols already in watchlist — show checkmark */
  watchlistSymbols?: string[];
}

export function StockSearchModal({
  visible,
  onClose,
  onSelect,
  watchlistSymbols = [],
}: StockSearchModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<TextInput>(null);

  const { data: results, isLoading } = useStockSearch(debouncedQuery, 20);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 300);
  }, []);

  const handleClose = () => {
    setQuery("");
    setDebouncedQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={() => inputRef.current?.focus()}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Code, name, or pinyin..."
              placeholderTextColor={Colors.textDisabled}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => handleQueryChange("")}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={handleClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {/* Results */}
        {!debouncedQuery ? (
          <View style={styles.hint}>
            <Text variant="caption">Search by stock code, name, or pinyin initials</Text>
          </View>
        ) : (
          <FlatList
            data={results ?? []}
            keyExtractor={(item) => item.symbol}
            renderItem={({ item }) => {
              const inWatchlist = watchlistSymbols.includes(item.symbol);
              return (
                <Pressable
                  style={styles.resultRow}
                  onPress={() => onSelect(item.symbol, item.name)}
                >
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <View style={styles.resultMeta}>
                      <MonoText size="sm" color={Colors.textSecondary}>
                        {item.symbol}
                      </MonoText>
                      <View style={styles.matchBadge}>
                        <Text style={styles.matchText}>{item.matchType}</Text>
                      </View>
                    </View>
                  </View>
                  {inWatchlist ? (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color={Colors.textMuted} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.hint}>
                  <Text variant="caption">Searching...</Text>
                </View>
              ) : debouncedQuery.length > 0 ? (
                <View style={styles.hint}>
                  <Text variant="caption">No results found for &quot;{debouncedQuery}&quot;</Text>
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.void,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "500",
  },
  hint: {
    alignItems: "center",
    paddingTop: 60,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultInfo: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  matchBadge: {
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  matchText: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  listContent: {
    paddingBottom: 20,
  },
});
