import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../types/auth";
import { useTranslation } from "react-i18next";

type AuthMode = "signin" | "signup";

export default function Index() {
  const { colorScheme } = useColorScheme();
  const { login, signup } = useAuth();
  const { t } = useTranslation();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [role, setRole] = useState<UserRole>("student");
  const [secureText, setSecureText] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const isDark = colorScheme === "dark";
  const identifierLabel = role === "student" ? t("login.email", "Email") : t("login.phone", "Phone");
  const identifierPlaceholder =
    role === "student" ? t("login.email_example", "student1@washos.com") : t("login.phone_example", "+91-7777777701");

  const resetForm = () => {
    setName("");
    setRegNo("");
    setIdentifier("");
    setPassword("");
  };

  const validate = (): boolean => {
    const valTitle = t("common.validation", "Validation");
    if (!identifier.trim() || !password) {
      Alert.alert(valTitle, t("login.err_required_both", { identifier: identifierLabel }));
      return false;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        Alert.alert(valTitle, t("login.err_required_name", "Name is required"));
        return false;
      }
      if (role === "student" && !regNo.trim()) {
        Alert.alert(valTitle, t("login.err_required_regno", "Reg No is required for student signup"));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login(role, identifier, password);
        return;
      }

      if (role === "student") {
        await signup("student", {
          name: name.trim(),
          reg_no: regNo.trim().toUpperCase(),
          email: identifier.trim().toLowerCase(),
          password,
        });
      } else {
        await signup("laundry_staff", {
          name: name.trim(),
          phone: identifier.trim(),
          password,
        });
      }

      Alert.alert(t("common.success", "Success"), t("login.success_signup", "Account created. Please sign in."));
      setMode("signin");
      resetForm();
    } catch (error: any) {
      Alert.alert(t("login.err_auth_failed", "Auth Failed"), error.message || t("login.err_try_again", "Please try again"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <StatusBar style={isDark ? "light" : "dark"} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerClassName="flex-grow justify-center px-8 py-10"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            automaticallyAdjustKeyboardInsets
          >
            <View className="w-full max-w-md self-center">
              <Text className="mb-2 text-center text-xs font-bold uppercase tracking-[4px] text-primary-dark dark:text-primary">
                {t("login.app_name", "Wash Os")}
              </Text>
              <Text className="text-center text-4xl font-extrabold tracking-tight text-card-foreground dark:text-card-foreground-dark">
                {mode === "signin" ? t("login.welcome") : t("login.signup")}
              </Text>

              <View className="mt-8 flex-row rounded-full bg-card p-1 dark:bg-card-dark">
                <Pressable
                  onPress={() => setMode("signin")}
                  className={`flex-1 rounded-full py-2 ${mode === "signin" ? "bg-primary-dark dark:bg-primary" : ""}`}
                >
                  <Text
                    className={`text-center text-sm font-bold ${mode === "signin" ? "text-primary-foreground-dark dark:text-primary-foreground" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
                  >
                    {t("login.signin_tab", "Sign In")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode("signup")}
                  className={`flex-1 rounded-full py-2 ${mode === "signup" ? "bg-primary-dark dark:bg-primary" : ""}`}
                >
                  <Text
                    className={`text-center text-sm font-bold ${mode === "signup" ? "text-primary-foreground-dark dark:text-primary-foreground" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
                  >
                    {t("login.signup_tab", "Sign Up")}
                  </Text>
                </Pressable>
              </View>

              <View className="mt-6 flex-row gap-2">
                <Pressable
                  onPress={() => setRole("student")}
                  className={`flex-1 items-center rounded-xl border-2 py-3 ${role === "student" ? "border-primary-dark bg-primary-dark/10 dark:border-primary dark:bg-primary/10" : "border-border bg-card dark:border-border-dark dark:bg-card-dark"}`}
                >
                  <MaterialIcons
                    name="school"
                    size={22}
                    color={role === "student" ? "#4194d7" : "#83827d"}
                  />
                  <Text
                    className={`mt-1 text-xs font-bold ${role === "student" ? "text-primary-dark dark:text-primary" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
                  >
                    {t("login.role_student", "Student")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setRole("laundry_staff")}
                  className={`flex-1 items-center rounded-xl border-2 py-3 ${role === "laundry_staff" ? "border-primary-dark bg-primary-dark/10 dark:border-primary dark:bg-primary/10" : "border-border bg-card dark:border-border-dark dark:bg-card-dark"}`}
                >
                  <MaterialIcons
                    name="local-laundry-service"
                    size={22}
                    color={role === "laundry_staff" ? "#4194d7" : "#83827d"}
                  />
                  <Text
                    className={`mt-1 text-xs font-bold ${role === "laundry_staff" ? "text-primary-dark dark:text-primary" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
                  >
                    {t("login.role_staff", "Laundry Staff")}
                  </Text>
                </Pressable>
              </View>

              <View className="mt-8">
                {mode === "signup" && (
                  <View className="mb-4">
                    <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                      {t("login.name_label", "Name")}
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={t("login.name_placeholder", "Your full name")}
                      placeholderTextColor={isDark ? "#b7b5a9" : "#83827d"}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
                    />
                  </View>
                )}

                {mode === "signup" && role === "student" && (
                  <View className="mb-4">
                    <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                      {t("login.regno_label", "Reg No")}
                    </Text>
                    <TextInput
                      value={regNo}
                      onChangeText={setRegNo}
                      placeholder={t("login.regno_example", "REG001")}
                      autoCapitalize="characters"
                      placeholderTextColor={isDark ? "#b7b5a9" : "#83827d"}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
                    />
                  </View>
                )}

                <View className="mb-4">
                  <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                    {identifierLabel}
                  </Text>
                  <TextInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    keyboardType={
                      role === "student" ? "email-address" : "phone-pad"
                    }
                    placeholder={identifierPlaceholder}
                    placeholderTextColor={isDark ? "#b7b5a9" : "#83827d"}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
                  />
                </View>

                <View>
                  <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                    {t("login.password_label", "Password")}
                  </Text>
                  <View className="flex-row items-center rounded-xl border border-border bg-card px-4 dark:border-border-dark dark:bg-card-dark">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={secureText}
                      placeholder={t("login.password_example", "password123")}
                      placeholderTextColor={isDark ? "#b7b5a9" : "#83827d"}
                      className="flex-1 py-3 text-foreground dark:text-foreground-dark"
                    />
                    <Pressable onPress={() => setSecureText((prev) => !prev)}>
                      <MaterialIcons
                        name={secureText ? "visibility" : "visibility-off"}
                        size={22}
                        color={isDark ? "#b7b5a9" : "#83827d"}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                className="mt-8 items-center rounded-full bg-primary-dark py-4 active:opacity-85 dark:bg-primary"
              >
                {submitting ? (
                  <ActivityIndicator color={isDark ? "#1a1f37" : "#f9f5ee"} />
                ) : (
                  <Text className="text-base font-bold tracking-wide text-primary-foreground-dark dark:text-primary-foreground">
                    {mode === "signin" ? t("login.login_button") : t("login.signup")}
                  </Text>
                )}
              </Pressable>

              <Text className="mt-6 text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
                {t("login.footer_info", "Session is managed with JWT validation and auto-timeout at 30 days.")}
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
