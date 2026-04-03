import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { Pressable, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

export default function QRModal() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const { payload, reg_no, name, block, version } = useLocalSearchParams<{
    payload: string;
    reg_no: string;
    name: string;
    block?: string;
    version: string;
  }>();

  const isDark = colorScheme === "dark";

  const handleShare = async () => {
    try {
      await Share.share({
        message: `WashOs Laundry Bag QR\n${name} · ${reg_no}${block ? ` · Block ${block}` : ""} · v${version}`,
      });
    } catch (_) {}
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <View className="flex-row items-center px-6 py-4">
        <Pressable
          onPress={() => router.back()}
          className="mr-4 rounded-full bg-card p-2 dark:bg-card-dark"
          hitSlop={8}
        >
          <MaterialIcons
            name="arrow-back"
            size={22}
            color={isDark ? "#f0ede4" : "#1a1a18"}
          />
        </Pressable>
        <Text className="text-xl font-extrabold tracking-tight text-card-foreground dark:text-card-foreground-dark">
          My Laundry QR
        </Text>
        <Pressable onPress={handleShare} className="ml-auto" hitSlop={8}>
          <MaterialIcons
            name="share"
            size={22}
            color={isDark ? "#f0ede4" : "#1a1a18"}
          />
        </Pressable>
      </View>

      {/* QR Card */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-full items-center rounded-3xl bg-white p-8 shadow-lg">
          {payload ? (
            <QRCode
              value={payload}
              size={260}
              color="#111"
              backgroundColor="#fff"
              quietZone={12}
            />
          ) : (
            <View className="h-64 w-64 items-center justify-center rounded-2xl bg-gray-100">
              <Text className="text-muted-foreground">No QR data</Text>
            </View>
          )}

          {/* Info below QR */}
          <View className="mt-6 items-center gap-1">
            <Text className="text-lg font-extrabold text-gray-900">{name}</Text>
            <Text className="text-sm font-bold text-gray-500">{reg_no}</Text>
            {block ? (
              <Text className="text-sm text-gray-500">Block {block}</Text>
            ) : null}
            <View className="mt-2 rounded-full bg-primary-dark/10 px-3 py-1">
              <Text className="text-xs font-bold tracking-wider text-primary-dark">
                VERSION {version}
              </Text>
            </View>
          </View>
        </View>

        <Text className="mt-6 text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
          Show this QR when dropping off your laundry bag.{"\n"}
          Rotate if you think your QR has been compromised.
        </Text>
      </View>
    </SafeAreaView>
  );
}
