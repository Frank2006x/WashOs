import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Index() {
  const { colorScheme: currentScheme } = useColorScheme();
  const router = useRouter();
  const [secureText, setSecureText] = useState(true);
  const [institutionId, setInstitutionId] = useState("");
  const [securityCode, setSecurityCode] = useState("");

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
          <View className="mb-14 items-center">
            <Text className="mb-3 text-xs font-bold uppercase tracking-[4px] text-primary-dark dark:text-primary">
              Wash Os
            </Text>
            <Text className="mb-2 text-4xl font-extrabold tracking-tight text-card-foreground dark:text-card-foreground-dark">
              Welcome Back
            </Text>
            <Text className="max-w-[320px] text-center text-sm font-medium leading-relaxed text-muted-foreground dark:text-muted-foreground-dark">
              Sign in to schedule and track your laundry in seconds.
            </Text>
          </View>

          <View className="w-full">
            <View className="mb-8">
              <Text className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                Institutional ID
              </Text>
              <View className="h-12 flex-row items-center border-b border-border dark:border-border-dark">
                <MaterialIcons
                  name="person"
                  size={20}
                  color={palette.inputIcon}
                />
                <TextInput
                  placeholder="Enter your student ID"
                  placeholderTextColor={palette.placeholder}
                  value={institutionId}
                  onChangeText={setInstitutionId}
                  className="ml-3 flex-1 text-base font-medium text-foreground dark:text-foreground-dark"
                />
              </View>
            </View>

            <View>
              <View className="mb-3 flex-row items-end justify-between">
                <Text className="text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground dark:text-muted-foreground-dark">
                  Security Code
                </Text>
                <Pressable>
                  <Text className="text-[11px] font-bold uppercase tracking-[1px] text-primary-dark dark:text-primary">
                    Lost Password?
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
                  placeholder="••••••••"
                  placeholderTextColor={palette.placeholder}
                  value={securityCode}
                  onChangeText={setSecurityCode}
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

            <View className="pt-10">
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                className="items-center rounded-full bg-primary-dark py-4 active:opacity-85 dark:bg-primary"
              >
                <Text className="text-base font-bold tracking-wide text-primary-foreground-dark dark:text-primary-foreground">
                  Sign In
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="items-center pt-12">
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
