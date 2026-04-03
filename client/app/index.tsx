import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../types/auth";

type UserType = 'student' | 'warden' | 'staff';

export default function Index() {
  const { colorScheme: currentScheme } = useColorScheme();
  const router = useRouter();
  const { login } = useAuth();
  
  const [selectedType, setSelectedType] = useState<UserType>('student');
  const [secureText, setSecureText] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const resolvedScheme = currentScheme ?? "light";
  const palette =
    resolvedScheme === "dark"
      ? {
          inputIcon: "#b7b5a9",
          placeholder: "#b7b5a9",
        }
      : {
          inputIcon: "#83827d",
          placeholder: "#83827d",
        };

  const userTypes = [
    { id: 'student' as UserType, label: 'Student', icon: 'school' },
    { id: 'warden' as UserType, label: 'Warden', icon: 'admin-panel-settings' },
    { id: 'staff' as UserType, label: 'Laundry Staff', icon: 'local-laundry-service' },
  ];

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholderEmail = () => {
    switch (selectedType) {
      case 'student': return 'student1@washos.com';
      case 'warden': return 'warden1@washos.com';
      case 'staff': return 'laundry1@washos.com';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />

      <View className="absolute -right-24 -top-10 h-72 w-72 rounded-full bg-accent/20 dark:bg-accent-dark/30" />
      <View className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-primary/20 dark:bg-primary-dark/30" />

      <ScrollView
        contentContainerClassName="flex-grow justify-center px-8 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md self-center">
          <View className="mb-12 items-center">
            <Text className="mb-3 text-xs font-bold uppercase tracking-[4px] text-primary-dark dark:text-primary">
              Wash Os
            </Text>
            <Text className="mb-2 text-4xl font-extrabold tracking-tight text-card-foreground dark:text-card-foreground-dark">
              Welcome Back
            </Text>
            <Text className="max-w-[320px] text-center text-sm font-medium leading-relaxed text-muted-foreground dark:text-muted-foreground-dark">
              Sign in to schedule and track your laundry
            </Text>
          </View>

          {/* User Type Selector */}
          <View className="mb-8">
            <Text className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
              Login As
            </Text>
            <View className="flex-row gap-2">
              {userTypes.map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => setSelectedType(type.id)}
                  className={`flex-1 items-center rounded-xl border-2 py-3 ${
                    selectedType === type.id
                      ? 'border-primary-dark bg-primary-dark/10 dark:border-primary dark:bg-primary/10'
                      : 'border-border bg-card dark:border-border-dark dark:bg-card-dark'
                  }`}
                >
                  <MaterialIcons
                    name={type.icon as any}
                    size={24}
                    color={selectedType === type.id ? (resolvedScheme === 'dark' ? '#91aee6' : '#293975') : palette.inputIcon}
                  />
                  <Text
                    className={`mt-1 text-xs font-bold ${
                      selectedType === type.id
                        ? 'text-primary-dark dark:text-primary'
                        : 'text-muted-foreground dark:text-muted-foreground-dark'
                    }`}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="w-full">
            <View className="mb-6">
              <Text className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                Email
              </Text>
              <View className="h-12 flex-row items-center border-b border-border dark:border-border-dark">
                <MaterialIcons
                  name="email"
                  size={20}
                  color={palette.inputIcon}
                />
                <TextInput
                  placeholder={getPlaceholderEmail()}
                  placeholderTextColor={palette.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="ml-3 flex-1 text-base font-medium text-foreground dark:text-foreground-dark"
                />
              </View>
            </View>

            <View className="mb-6">
              <View className="mb-3 flex-row items-end justify-between">
                <Text className="text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                  Password
                </Text>
                <Pressable>
                  <Text className="text-[11px] font-bold uppercase tracking-[1px] text-primary-dark dark:text-primary">
                    Forgot Password?
                  </Text>
                </Pressable>
              </View>

              <View className="h-12 flex-row items-center border-b border-border dark:border-border-dark">
                <MaterialIcons
                  name="lock"
                  size={20}
                  color={palette.inputIcon}
                />
                <TextInput
                  secureTextEntry={secureText}
                  placeholder="password123"
                  placeholderTextColor={palette.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  className="ml-3 flex-1 text-base font-medium text-foreground dark:text-foreground-dark"
                />
                <Pressable
                  onPress={() => setSecureText((previous) => !previous)}
                  className="pl-3"
                >
                  <MaterialIcons
                    name={secureText ? "visibility" : "visibility-off"}
                    size={22}
                    color={palette.inputIcon}
                  />
                </Pressable>
              </View>
            </View>

            <View className="pt-6">
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                className="items-center rounded-full bg-primary-dark py-4 active:opacity-85 dark:bg-primary"
              >
                {loading ? (
                  <ActivityIndicator color={resolvedScheme === 'dark' ? '#1a1f37' : '#f9f5ee'} />
                ) : (
                  <Text className="text-base font-bold tracking-wide text-primary-foreground-dark dark:text-primary-foreground">
                    Sign In
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View className="items-center pt-8">
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
              Test Credentials: password123
            </Text>
          </View>

          <View className="items-center pt-8">
            <View className="flex-row gap-1.5">
              <View className="h-2 w-2 rounded-full bg-primary-dark/25 dark:bg-primary/25" />
              <View className="h-2 w-10 rounded-full bg-primary-dark dark:bg-primary" />
              <View className="h-2 w-2 rounded-full bg-primary-dark/25 dark:bg-primary/25" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
