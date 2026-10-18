import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Shield, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemeRefresh } from "../../theme/ThemeContext";
import { colors, createThemedStyles, radii, spacing } from "../../theme/tokens";
import {
  createTournamentInvite,
  listTournamentInvitations,
  listTournamentMembers,
  revokeTournamentInvite,
  revokeTournamentMember,
} from "./api";

export function ShareSheet({
  tournamentId,
  tournamentName,
  visible,
  onClose,
}: {
  tournamentId: string;
  tournamentName: string;
  visible: boolean;
  onClose: () => void;
}) {
  useThemeRefresh();
  const cache = useQueryClient();
  const [error, setError] = useState("");
  const invitations = useQuery({
    queryKey: ["invitations", tournamentId],
    queryFn: () => listTournamentInvitations(tournamentId),
    enabled: visible,
  });
  const members = useQuery({
    queryKey: ["members", tournamentId],
    queryFn: () => listTournamentMembers(tournamentId),
    enabled: visible,
  });
  const shareMutation = useMutation({
    mutationFn: createTournamentInvite,
    onSuccess: async (token) => {
      await cache.invalidateQueries({
        queryKey: ["invitations", tournamentId],
      });
      const url = `pitchpro://join/${token}`;
      try {
        await Share.share({
          message: `Join ${tournamentName} on PitchPro as a read-only member: ${url}`,
          url,
        });
      } catch (shareError) {
        setError(
          shareError instanceof Error
            ? shareError.message
            : "Invitation created, but the share sheet could not open.",
        );
      }
    },
  });
  const revokeInvite = useMutation({
    mutationFn: revokeTournamentInvite,
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["invitations", tournamentId] }),
  });
  const revokeMember = useMutation({
    mutationFn: (userId: string) =>
      revokeTournamentMember(tournamentId, userId),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["members", tournamentId] }),
  });
  const activeInvites = (invitations.data ?? []).filter(
    (invite) =>
      !invite.accepted_at &&
      !invite.revoked_at &&
      new Date(invite.expires_at) > new Date(),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>TOURNAMENT ACCESS</Text>
            <Text style={styles.title}>Share competition</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.close}
          >
            <X color={colors.text} size={19} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.readOnlyNote}>
            <Shield color={colors.accent} size={18} />
            <Text style={styles.noteText}>
              Invited users can view fixtures, results, standings, and activity.
              Only you can make changes.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={shareMutation.isPending}
            onPress={() => {
              setError("");
              shareMutation.mutate(tournamentId);
            }}
            style={[
              styles.inviteButton,
              shareMutation.isPending && styles.disabled,
            ]}
          >
            {shareMutation.isPending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Link2 color={colors.background} size={17} />
                <Text style={styles.inviteText}>Create 7-day invite link</Text>
              </>
            )}
          </Pressable>
          {error || shareMutation.error ? (
            <Text style={styles.error}>
              {error || shareMutation.error?.message}
            </Text>
          ) : null}
          <Text style={styles.sectionLabel}>MEMBERS</Text>
          {members.isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : null}
          {(members.data ?? []).map((member) => {
            const profile = member.profiles as unknown as {
              full_name: string;
            } | null;
            return (
              <View key={member.user_id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.initial}>
                    {profile?.full_name?.slice(0, 1).toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.name}>
                    {profile?.full_name ?? "PitchPro member"}
                  </Text>
                  <Text style={styles.sub}>
                    {member.role === "owner"
                      ? "Tournament owner"
                      : "Read-only member"}
                  </Text>
                </View>
                {member.role === "read_only" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${profile?.full_name ?? "member"}`}
                    onPress={() => revokeMember.mutate(member.user_id)}
                    style={styles.remove}
                  >
                    <X color={colors.muted} size={17} />
                  </Pressable>
                ) : (
                  <Shield color={colors.accent} size={16} />
                )}
              </View>
            );
          })}
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionLabel}>INVITATION LINKS</Text>
            <Text style={styles.expiry}>EXPIRE IN 7 DAYS</Text>
          </View>
          {invitations.isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : null}
          {activeInvites.map((invite) => (
            <View key={invite.id} style={styles.inviteRow}>
              <View style={styles.inviteIcon}>
                <Link2 color={colors.muted} size={15} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.name}>Pending invitation</Text>
                <Text style={styles.sub}>
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Revoke invitation"
                onPress={() => revokeInvite.mutate(invite.id)}
                style={styles.remove}
              >
                <X color={colors.muted} size={17} />
              </Pressable>
            </View>
          ))}
          {!activeInvites.length && !invitations.isLoading ? (
            <Text style={styles.empty}>No active invitation links.</Text>
          ) : null}
          {revokeInvite.error || revokeMember.error ? (
            <Text style={styles.error}>
              {revokeInvite.error?.message ?? revokeMember.error?.message}
            </Text>
          ) : null}
          <View style={styles.footerNote}>
            <Copy color={colors.dim} size={14} />
            <Text style={styles.footerText}>
              Invitation links are single-use and stored as hashes. Revoking a
              link prevents future joins.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kicker: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  close: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  readOnlyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1B2E23",
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noteText: { color: colors.muted, flex: 1, fontSize: 11, lineHeight: 17 },
  inviteButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  inviteText: { color: colors.background, fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, fontSize: 11, marginTop: spacing.sm },
  sectionLabel: {
    color: colors.dim,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expiry: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: spacing.xl,
  },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  initial: { color: colors.accent, fontSize: 13, fontWeight: "900" },
  rowCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 12, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 10, marginTop: 4 },
  remove: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inviteIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.elevated,
  },
  empty: { color: colors.muted, fontSize: 11, paddingVertical: spacing.md },
  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: spacing.xl,
  },
  footerText: { color: colors.dim, flex: 1, fontSize: 9, lineHeight: 14 },
  loader: { margin: spacing.md },
});
