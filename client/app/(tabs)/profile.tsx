import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { BagResponse, studentService } from "@/services/api";
import { useTranslation } from "react-i18next";

const BLOCKS = ["A", "B", "C", "D1", "D2", "E"] as const;
type Block = (typeof BLOCKS)[number];

export default function ProfileTab() {
  const { colorScheme } = useColorScheme();
  const { user, profile, logout, loading } = useAuth();
  const router = useRouter();
  const isDark = colorScheme === "dark";
  const { t, i18n } = useTranslation();

  const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "ta", label: "தமிழ்" },
    { code: "te", label: "తెలుగు" },
    { code: "hi", label: "हिंदी" },
  ];

  // ── QR / bag state ────────────────────────────────────────────────────────
  const [bag, setBag] = useState<BagResponse | null>(null);
  const [bagLoading, setBagLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rotating, setRotating] = useState(false);

  // ── Block state ───────────────────────────────────────────────────────────
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [savingBlock, setSavingBlock] = useState(false);
  const [isEditingBlock, setIsEditingBlock] = useState(false);

  const isStudent = user?.role === "student";

  // Fetch bag on mount (students only)
  const fetchBag = useCallback(async () => {
    if (!isStudent) return;
    setBagLoading(true);
    try {
      const data = await studentService.getMyBag();
      setBag(data); // null = no bag yet
      if (data?.block) setSelectedBlock(data.block as Block);
    } catch (e: any) {
      console.warn("bag fetch failed", e?.message);
    } finally {
      setBagLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    fetchBag();
  }, [fetchBag]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
  };

  const handleGenerateQR = async () => {
    setGenerating(true);
    try {
      const created = await studentService.initMyBag();
      setBag(created);
    } catch (e: any) {
      Alert.alert(t("common.error", "Error"), e?.response?.data || e?.message || t("profile.err_gen_qr", "Failed to generate QR"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveBlock = async () => {
    if (!selectedBlock) {
      Alert.alert(t("profile.block_req", "Block required"), t("profile.err_select_block", "Please select your hostel block."));
      return;
    }
    setSavingBlock(true);
    try {
      await studentService.updateMyBlock(selectedBlock);
      // Re-fetch to sync QR payload (block is embedded in it)
      await fetchBag();
      setIsEditingBlock(false);
      Alert.alert(t("common.saved", "Saved"), `${t("profile.block_set_to", "Block set to")} ${selectedBlock}`);
    } catch (e: any) {
      Alert.alert(t("common.error", "Error"), e?.response?.data || e?.message || t("profile.err_save_block", "Failed to save block"));
    } finally {
      setSavingBlock(false);
    }
  };

  const handleRotateQR = () => {
    Alert.alert(
      t("profile.rotate_qr", "Rotate QR Code"),
      t("profile.rotate_qr_desc", "This will invalidate your current QR code and generate a new one. Continue?"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.rotate", "Rotate"),
          style: "destructive",
          onPress: async () => {
            setRotating(true);
            try {
              const updated = await studentService.rotateMyQR();
              setBag(updated);
            } catch (e: any) {
              const msg = e?.response?.data || e?.message || t("profile.err_rotate", "Failed to rotate");
              Alert.alert(t("common.error", "Error"), msg);
            } finally {
              setRotating(false);
            }
          },
        },
      ]
    );
  };

  const handleViewFullQR = () => {
    if (!bag) return;
    router.push({
      pathname: "/qr-modal",
      params: {
        payload: bag.qr_payload,
        reg_no: bag.reg_no,
        name: bag.name,
        block: bag.block ?? "",
        version: String(bag.qr_version),
      },
    });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "student": return "Student";
      case "laundry_staff": return "Laundry Staff";
      default: return role;
    }
  };

  const getRoleIcon = (role: string): any => {
    switch (role) {
      case "student": return "school";
      case "laundry_staff": return "local-laundry-service";
      default: return "person";
    }
  };

  const profileName = profile?.name || "User";
  const profilePhone = user?.role === "laundry_staff" ? (profile as any)?.phone : null;
  const profileRegNo = user?.role === "student" ? (profile as any)?.reg_no : null;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          <Text className="text-3xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
            {t("tabs.profile", "Profile")}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            {t("profile.account_info", "Your account information")}
          </Text>

          {/* ── Profile Card ── */}
          <View className="mt-6 rounded-2xl bg-card p-6 dark:bg-card-dark">
            <View className="mb-5 flex-row items-center">
              <View className="mr-4 h-16 w-16 items-center justify-center rounded-full bg-primary-dark/10 dark:bg-primary/10">
                <MaterialIcons
                  name={getRoleIcon(user?.role || "person")}
                  size={32}
                  color="#293975"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-card-foreground dark:text-card-foreground-dark">
                  {profileName}
                </Text>
                <Text className="mt-0.5 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                  {getRoleLabel(user?.role || "")}
                </Text>
              </View>
            </View>

            <InfoRow label={t("profile.email", "Email") as string} value={user?.email ?? ""} />
            {profilePhone && <InfoRow label={t("profile.phone", "Phone") as string} value={profilePhone} />}
            {profileRegNo && <InfoRow label={t("profile.reg_no", "Reg No") as string} value={profileRegNo} />}
            <InfoRow label={t("profile.member_since", "Member Since") as string} value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"} />
          </View>

          {/* ── Block Picker (students only) ── */}
          {isStudent && (
            <View className="mt-5 rounded-2xl bg-card p-5 dark:bg-card-dark">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                  {t("profile.hostel_block", "Hostel Block")}
                </Text>
                {bag?.block && !isEditingBlock && (
                  <Pressable
                    onPress={() => setIsEditingBlock(true)}
                    className="flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5 dark:border-border-dark"
                    hitSlop={6}
                  >
                    <MaterialIcons
                      name="edit"
                      size={14}
                      color={isDark ? "#b7b5a9" : "#83827d"}
                    />
                    <Text className="text-xs font-bold text-muted-foreground dark:text-muted-foreground-dark">
                      {t("common.edit", "Edit")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {bag?.block && !isEditingBlock ? (
                <View className="flex-row items-center">
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-primary-dark/10 dark:bg-primary/10">
                    <MaterialIcons name="apartment" size={24} color="#293975" />
                  </View>
                  <View>
                    <Text className="text-sm font-medium text-muted-foreground dark:text-muted-foreground-dark">
                      {t("profile.current_block", "Your current block")}
                    </Text>
                    <Text className="text-xl font-extrabold text-card-foreground dark:text-card-foreground-dark">
                      {t("profile.hostel_block", "Block")} {bag.block}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    Set your block so laundry can be delivered correctly.
                  </Text>

                  <View className="flex-row flex-wrap gap-2">
                    {BLOCKS.map((b) => {
                      const active = selectedBlock === b;
                      return (
                        <Pressable
                          key={b}
                          onPress={() => setSelectedBlock(b)}
                          className={`rounded-full border-2 px-4 py-2 ${
                            active
                              ? "border-primary-dark bg-primary-dark/10 dark:border-primary dark:bg-primary/10"
                              : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                          }`}
                        >
                          <Text
                            className={`text-sm font-bold ${
                              active
                                ? "text-primary-dark dark:text-primary"
                                : "text-muted-foreground dark:text-muted-foreground-dark"
                            }`}
                          >
                            {b}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View className="mt-4 flex-row gap-2">
                    {bag?.block && isEditingBlock && (
                      <Pressable
                        onPress={() => {
                          setSelectedBlock(bag.block as Block);
                          setIsEditingBlock(false);
                        }}
                        disabled={savingBlock}
                        className="flex-1 items-center rounded-full bg-secondary py-3 active:opacity-85 dark:bg-secondary-dark disabled:opacity-50"
                      >
                        <Text className="font-bold text-secondary-foreground dark:text-secondary-foreground-dark">
                          {t("common.cancel", "Cancel")}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleSaveBlock}
                      disabled={savingBlock || !selectedBlock}
                      className="flex-1 items-center justify-center rounded-full bg-primary-dark py-3 active:opacity-85 dark:bg-primary disabled:opacity-50"
                    >
                      {savingBlock ? (
                        <ActivityIndicator color={isDark ? "#1a1f37" : "#f9f5ee"} size="small" />
                      ) : (
                        <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
                          {t("profile.save_block", "Save Block")}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── QR Card (students only) ── */}
          {isStudent && (
            <View className="mt-5 rounded-2xl bg-card p-5 dark:bg-card-dark">
              <View className="mb-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                    {t("profile.qr_card_title", "Laundry Bag QR")}
                  </Text>
                  {bag && (
                    <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {t("qr_modal.version", "Version")} {bag.qr_version}
                      {bag.is_revoked && "  ⚠ Revoked"}
                    </Text>
                  )}
                </View>
                {bag && (
                  <Pressable
                    onPress={handleRotateQR}
                    disabled={rotating}
                    className="flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5 dark:border-border-dark"
                    hitSlop={6}
                  >
                    {rotating ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <>
                        <MaterialIcons
                          name="refresh"
                          size={14}
                          color={isDark ? "#b7b5a9" : "#83827d"}
                        />
                        <Text className="text-xs font-bold text-muted-foreground dark:text-muted-foreground-dark">
                          {t("common.rotate", "Rotate")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {bagLoading ? (
                <View className="items-center py-10">
                  <ActivityIndicator />
                </View>
              ) : bag ? (
                <Pressable onPress={handleViewFullQR} className="items-center">
                  <View className="rounded-2xl bg-white p-5 shadow-sm">
                    <QRCode
                      value={bag.qr_payload}
                      size={180}
                      color="#111"
                      backgroundColor="#fff"
                      quietZone={8}
                    />
                  </View>
                  <View className="mt-3 flex-row items-center gap-1">
                    <Text className="text-xs font-medium text-muted-foreground dark:text-muted-foreground-dark">
                      {t("profile.tap_to_view", "Tap to view full screen")}
                    </Text>
                    <MaterialIcons
                      name="open-in-full"
                      size={12}
                      color={isDark ? "#b7b5a9" : "#83827d"}
                    />
                  </View>
                  <View className="mt-2 flex-row gap-2">
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {bag.reg_no}
                    </Text>
                    {bag.block && (
                      <>
                        <Text className="text-xs text-muted-foreground">·</Text>
                        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                          {t("profile.hostel_block", "Block")} {bag.block}
                        </Text>
                      </>
                    )}
                  </View>
                </Pressable>
              ) : (
                <View className="items-center py-8 gap-3">
                  <MaterialIcons
                    name="qr-code"
                    size={48}
                    color={isDark ? "#b7b5a9" : "#c5c3bc"}
                  />
                  <Text className="text-sm font-medium text-muted-foreground dark:text-muted-foreground-dark">
                    {t("profile.no_bag_title", "No QR code yet")}
                  </Text>
                  <Text className="text-xs text-center text-muted-foreground dark:text-muted-foreground-dark px-4">
                    {t("profile.no_bag_desc", "Generate a unique QR for your laundry bag.\nLaundry staff will scan this when collecting your clothes.")}
                  </Text>
                  <Pressable
                    onPress={handleGenerateQR}
                    disabled={generating}
                    className="mt-1 flex-row items-center gap-2 rounded-full bg-primary-dark px-6 py-3 active:opacity-85 dark:bg-primary disabled:opacity-50"
                  >
                    {generating ? (
                      <ActivityIndicator color={isDark ? "#1a1f37" : "#f9f5ee"} />
                    ) : (
                      <>
                        <MaterialIcons name="qr-code-2" size={18} color={isDark ? "#1a1f37" : "#f9f5ee"} />
                        <Text className="font-bold text-primary-foreground-dark dark:text-primary-foreground">
                          {t("profile.generate_qr", "Generate My QR")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* ── Language Switcher ── */}
          <View className="mt-5 rounded-2xl bg-card p-5 dark:bg-card-dark">
            <Text className="mb-4 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              {t("profile.language", "Language")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {LANGUAGES.map((lang) => {
                const active = i18n.language === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => i18n.changeLanguage(lang.code)}
                    className={`rounded-full border-2 px-4 py-2 ${
                      active
                        ? "border-primary-dark bg-primary-dark/10 dark:border-primary dark:bg-primary/10"
                        : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        active
                          ? "text-primary-dark dark:text-primary"
                          : "text-muted-foreground dark:text-muted-foreground-dark"
                      }`}
                    >
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Logout ── */}
          <Pressable
            onPress={handleLogout}
            className="mt-6 items-center rounded-full bg-destructive py-4 active:opacity-85 dark:bg-destructive-dark"
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="logout" size={20} color="#f9f5ee" />
              <Text className="font-bold text-destructive-foreground dark:text-destructive-foreground-dark">
                {t("profile.logout", "Log Out")}
              </Text>
            </View>
          </Pressable>

          <View className="mt-5 mb-4 rounded-xl bg-card/50 p-4 dark:bg-card-dark/50">
            <Text className="text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
              {t("profile.app_version", "WashOs v1.0.0")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-4">
      <Text className="mb-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground-dark">
        {label}
      </Text>
      <Text className="text-base font-medium text-card-foreground dark:text-card-foreground-dark">
        {value}
      </Text>
    </View>
  );
}
