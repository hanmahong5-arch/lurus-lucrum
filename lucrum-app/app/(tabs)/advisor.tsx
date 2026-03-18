/**
 * Advisor Tab - AI investment advisor with SSE streaming
 *
 * Features:
 * - Real-time SSE streaming responses
 * - Chat mode selection (quick/deep)
 * - Suggested follow-up questions
 * - Session history management
 * - Typing indicator during streaming
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Screen, Text } from "@/components/common";
import { useStreamingChat, type ChatMode, type ChatMessage } from "@/lib/hooks/use-streaming-chat";
import { useConversationStore } from "@/lib/stores/conversation-store";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";

const MODES: { value: ChatMode; label: string; icon: string }[] = [
  { value: "quick", label: "Quick", icon: "flash-outline" },
  { value: "deep", label: "Deep", icon: "analytics-outline" },
];

export default function AdvisorScreen() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("quick");
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    isStreaming,
    error,
    currentResponse,
    suggestedQuestions,
    sendMessage,
    stopStreaming,
    clearMessages,
    setMessages,
  } = useStreamingChat();

  const {
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    addMessage,
    deleteSession,
  } = useConversationStore();

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0 || currentResponse) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, currentResponse]);

  // Sync messages with active session
  const syncToSession = useCallback(
    (msg: ChatMessage) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession();
      }
      addMessage(sessionId, msg);
    },
    [activeSessionId, createSession, addMessage],
  );

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;

    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await sendMessage(msg, {
      mode,
      onComplete: (fullResponse, questions) => {
        // Save both messages to session
        syncToSession({
          id: `user-${Date.now()}`,
          role: "user",
          content: msg,
          timestamp: Date.now(),
          mode,
        });
        syncToSession({
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: fullResponse,
          timestamp: Date.now(),
          mode,
        });
      },
    });
  };

  const handleRestoreSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveSession(sessionId);
      setMessages(session.messages);
      setShowHistory(false);
    }
  };

  const handleNewChat = () => {
    clearMessages();
    setActiveSession(null);
    setShowHistory(false);
  };

  // Build display data: messages + streaming partial
  const displayData: (ChatMessage | { id: string; role: "streaming"; content: string })[] = [
    ...messages,
    ...(currentResponse
      ? [{ id: "streaming", role: "streaming" as const, content: currentResponse }]
      : []),
  ];

  return (
    <Screen padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={styles.headerTitle}>AI Advisor</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setShowHistory(!showHistory)} style={styles.headerBtn}>
            <Ionicons
              name="time-outline"
              size={20}
              color={showHistory ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>
          <Pressable onPress={handleNewChat} style={styles.headerBtn}>
            <Ionicons name="create-outline" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Session History Drawer */}
      {showHistory ? (
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Chat History</Text>
            <Text variant="caption">{sessions.length} sessions</Text>
          </View>
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.historyItem,
                  item.id === activeSessionId && styles.historyItemActive,
                ]}
                onPress={() => handleRestoreSession(item.id)}
                onLongPress={() => deleteSession(item.id)}
              >
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItemTitle} numberOfLines={1}>
                    {item.starred && "* "}
                    {item.title}
                  </Text>
                  <Text variant="caption">
                    {item.messages.length} msgs | {new Date(item.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyHistory}>
                <Text variant="caption">No chat history yet</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
        >
          {/* Mode Selector */}
          <View style={styles.modeRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.value}
                style={[styles.modeBtn, mode === m.value && styles.modeBtnActive]}
                onPress={() => setMode(m.value)}
              >
                <Ionicons
                  name={m.icon as any}
                  size={14}
                  color={mode === m.value ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.modeText,
                    mode === m.value && styles.modeTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={displayData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.role === "streaming") {
                return <StreamingBubble content={item.content} />;
              }
              return <ChatBubble message={item as ChatMessage} />;
            }}
            ListEmptyComponent={
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIcon}>
                  <Ionicons name="sparkles" size={32} color={Colors.ai} />
                </View>
                <Text style={styles.welcomeTitle}>AI Investment Advisor</Text>
                <Text variant="caption" style={styles.welcomeDesc}>
                  Ask about stocks, strategies, market analysis, or portfolio optimization
                </Text>
              </View>
            }
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {/* Error */}
          {error && (
            <View style={styles.errorBar}>
              <Ionicons name="warning" size={14} color={Colors.statusBlock} />
              <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
            </View>
          )}

          {/* Suggested Questions */}
          {suggestedQuestions.length > 0 && !isStreaming && (
            <View style={styles.suggestionsRow}>
              {suggestedQuestions.slice(0, 3).map((q, i) => (
                <Pressable
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(q)}
                >
                  <Text style={styles.suggestionText} numberOfLines={1}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about stocks, strategies..."
              placeholderTextColor={Colors.textDisabled}
              multiline
              maxLength={5000}
              editable={!isStreaming}
              onSubmitEditing={() => handleSend()}
              blurOnSubmit={false}
            />
            {isStreaming ? (
              <Pressable style={styles.stopBtn} onPress={stopStreaming}>
                <Ionicons name="stop" size={20} color={Colors.statusBlock} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                onPress={() => handleSend()}
                disabled={!input.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={input.trim() ? Colors.primary : Colors.textDisabled}
                />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

// ============================================================
// Chat Bubble Components
// ============================================================

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={14} color={Colors.ai} />
        </View>
      )}
      <View
        style={[
          styles.bubbleContent,
          isUser ? styles.bubbleContentUser : styles.bubbleContentAI,
        ]}
      >
        <Text style={styles.bubbleText}>{message.content}</Text>
        <Text style={styles.bubbleTime}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

function StreamingBubble({ content }: { content: string }) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.bubble, styles.bubbleAI]}>
      <Animated.View style={[styles.aiAvatar, { opacity: pulseAnim }]}>
        <Ionicons name="sparkles" size={14} color={Colors.ai} />
      </Animated.View>
      <View style={[styles.bubbleContent, styles.bubbleContentAI]}>
        <Text style={styles.bubbleText}>
          {content}
          <Text style={{ color: Colors.ai }}>|</Text>
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: 20 },
  headerActions: { flexDirection: "row", gap: Spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // History Panel
  historyPanel: { flex: 1, paddingHorizontal: Spacing.lg },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  historyTitle: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyItemActive: { backgroundColor: `${Colors.primary}10` },
  historyItemContent: { flex: 1, gap: 2 },
  historyItemTitle: { fontSize: 14, fontWeight: "500", color: Colors.textPrimary },
  emptyHistory: { alignItems: "center", paddingTop: 60 },

  // Chat Area
  chatArea: { flex: 1 },
  modeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtnActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  modeText: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: "500" },
  modeTextActive: { color: Colors.primary },

  // Messages
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },

  // Welcome
  welcomeContainer: { alignItems: "center", paddingTop: 80, gap: Spacing.sm },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.aiBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  welcomeTitle: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary },
  welcomeDesc: { textAlign: "center", maxWidth: 280 },

  // Bubbles
  bubble: { flexDirection: "row", gap: Spacing.sm },
  bubbleUser: { justifyContent: "flex-end" },
  bubbleAI: { justifyContent: "flex-start" },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.aiBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  bubbleContent: { maxWidth: "78%", borderRadius: BorderRadius.lg, padding: Spacing.md },
  bubbleContentUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleContentAI: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
  bubbleTime: { fontSize: 10, color: Colors.textDisabled, marginTop: 4, textAlign: "right" },

  // Error
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: `${Colors.statusBlock}15`,
    borderRadius: BorderRadius.sm,
  },
  errorText: { fontSize: 12, color: Colors.statusBlock, flex: 1 },

  // Suggestions
  suggestionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  suggestionChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.aiBorder,
    borderRadius: BorderRadius.lg,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
  },
  suggestionText: { fontSize: 11, color: Colors.ai, textAlign: "center" },

  // Input Bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.void,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${Colors.statusBlock}15`,
  },
});
