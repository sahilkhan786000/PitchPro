import { File as ExpoFile } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

type ReadableImageFile = {
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export function getImageAssetFile(
  asset: ImagePickerAsset,
): ReadableImageFile {
  if (Platform.OS === "web") {
    if (!asset.file) {
      throw new Error("Could not read the selected image. Please choose it again.");
    }
    return asset.file;
  }

  return new ExpoFile(asset.uri);
}
