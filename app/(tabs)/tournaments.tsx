import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  AlertTriangle,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Trophy,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/src/components/AuthGate";
import { TeamCrest } from "@/src/components/TeamCrest";
import {
  deleteTournament,
  listTournaments,
  type TournamentSummary,
} from "@/src/features/tournaments/api";
import { useAuth } from "@/src/lib/auth";
import { useThemeRefresh } from "@/src/theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "@/src/theme/tokens";

export default function TournamentsScreen() {
  useThemeRefresh();
  return (
    <AuthGate>
      <TournamentsContent />
    </AuthGate>
  );
}

function TournamentsContent() {
  const { session, club } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TournamentSummary | null>(
    null,
  );
  const [status, setStatus] = useState<
    "all" | "active" | "completed" | "mine" | "shared"
  >("all");
  const query = useQuery({
    queryKey: ["tournaments", session?.user.id, club?.id],
    queryFn: () => listTournaments(club?.id ?? ""),
    enabled: Boolean(session && club),
  });
  const deleteMutation = useMutation({
    mutationFn: (tournamentId: string) => deleteTournament(tournamentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({
        queryKey: ["unread-notification-count"],
      });
      setDeleteTarget(null);
    },
  });
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter((item) => {
        const isOwner = item.owner_id === session?.user.id;
        const matchesFilter =
          status === "all" ||
          (status === "active" && item.status === "active") ||
          (status === "completed" && item.status === "completed") ||
          (status === "mine" && isOwner) ||
          (status === "shared" && !isOwner);
        const matchesSearch = item.name
          .toLowerCase()
          .includes(search.trim().toLowerCase());

        return matchesFilter && matchesSearch;
      }),
    [query.data, search, session?.user.id, status],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerActions}>
            <Text style={styles.title}>Tournaments</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create tournament"
              onPress={() => router.push("/create-tournament")}
              style={styles.add}
            >
              <Plus color={colors.background} size={20} />
            </Pressable>
          </View>
        </View>
        <View style={styles.search}>
          <Search color={colors.muted} size={17} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search competitions"
            placeholderTextColor={colors.dim}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.filters}>
          {(["all", "active", "completed", "mine", "shared"] as const).map(
            (value) => (
              <Pressable
                key={value}
                onPress={() => setStatus(value)}
                style={[styles.filter, status === value && styles.filterActive]}
              >
                <Text
                  style={[
                    styles.filterText,
                    status === value && styles.filterTextActive,
                  ]}
                >
                  {value === "all"
                    ? "All"
                    : value === "active"
                      ? "Active"
                      : value === "completed"
                        ? "Completed"
                        : value === "mine"
                          ? "Created by me"
                          : "Shared with me"}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        {query.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : null}
        {query.isError ? (
          <Pressable onPress={() => query.refetch()} style={styles.empty}>
            <Text style={styles.emptyTitle}>Couldn’t load tournaments</Text>
            <Text style={styles.emptyBody}>Tap to retry.</Text>
          </Pressable>
        ) : null}
        {!query.isLoading && !filtered.length ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Trophy color={colors.accent} size={22} />
            </View>
            <Text style={styles.emptyTitle}>No tournaments in this view</Text>
            <Text style={styles.emptyBody}>
              {query.data?.length
                ? "Adjust your filters or search."
                : "Start a competition and bring your teams together."}
            </Text>
            {!query.data?.length ? (
              <Pressable
                onPress={() => router.push("/create-tournament")}
                style={styles.create}
              >
                <Text style={styles.createText}>Create tournament</Text>
                <ChevronRight color={colors.background} size={16} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.list}>
          {filtered.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View
                  style={[
                    styles.dot,
                    item.status === "completed" && styles.dotComplete,
                  ]}
                />
                <Text style={styles.status}>{item.status.toUpperCase()}</Text>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                {item.owner_id === session?.user.id ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.name}`}
                    onPress={() => {
                      deleteMutation.reset();
                      setDeleteTarget(item);
                    }}
                    style={styles.deleteIcon}
                  >
                    <Trash2 color={colors.danger} size={16} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/tournament/[id]",
                    params: { id: item.id },
                  })
                }
                style={styles.cardMain}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.description} numberOfLines={2}>
                  {item.description ||
                    "Double round-robin league · final to follow"}
                </Text>
                <View style={styles.cardFoot}>
                  <View style={styles.teamRow}>
                    {item.teams.slice(0, 5).map((team, index) => (
                      <TeamCrest
                        key={team.id}
                        name={team.name}
                        logoPath={team.logo_path}
                        size={25}
                        style={{
                          marginLeft: index ? -6 : 0,
                          borderWidth: 2,
                          borderColor: colors.surface,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={styles.teamCount}>{item.teams.length} teams</Text>
                  <ChevronRight color={colors.dim} size={17} />
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmPanel}>
            <AlertTriangle color={colors.danger} size={24} />
            <Text style={styles.confirmTitle}>Delete tournament?</Text>
            <Text style={styles.confirmBody}>
              “{deleteTarget?.name}” and its teams-in-tournament, fixtures,
              results, and updates will be permanently deleted. Your teams will
              remain in your club.
            </Text>
            {deleteMutation.error ? (
              <Text style={styles.deleteError}>
                {deleteMutation.error.message}
              </Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deleteMutation.isPending}
                onPress={() => setDeleteTarget(null)}
                style={styles.confirmCancel}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleteMutation.isPending || !deleteTarget}
                onPress={() => {
                  if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                }}
                style={styles.confirmDelete}
              >
                <Text style={styles.confirmDeleteText}>
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    alignItems: "stretch",
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.text, fontSize: 29, fontWeight: "900" },
  add: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  filters: { flexDirection: "row", gap: 8, marginVertical: spacing.md },
  filter: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  filterActive: { backgroundColor: "#22362A", borderColor: "#3D8052" },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: colors.accent },
  list: { gap: 9 },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  deleteIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
  },
  cardMain: { marginTop: -3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  dotComplete: { backgroundColor: colors.gold },
  status: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  date: { color: colors.dim, marginLeft: "auto", fontSize: 10 },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 11,
  },
  description: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.lg,
  },
  teamRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  crest: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: colors.elevated,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.text, fontSize: 9, fontWeight: "900" },
  teamCount: { color: colors.muted, fontSize: 11 },
  empty: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.xl,
    gap: 8,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#21372B",
    borderRadius: 15,
    marginBottom: 5,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  emptyBody: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
  create: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    marginTop: 5,
    minHeight: 42,
    paddingHorizontal: 13,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  createText: { color: colors.background, fontWeight: "900", fontSize: 11 },
  confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  confirmPanel: {
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  confirmTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  confirmBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  deleteError: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmCancel: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  confirmCancelText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  confirmDelete: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
  },
  confirmDeleteText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
});
