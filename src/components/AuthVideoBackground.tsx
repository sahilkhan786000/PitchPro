import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import type { ComponentRef, RefObject } from "react";
import { StyleSheet, View } from "react-native";

const footballVideo = require("../../footballVideo.mp4");

export function AuthVideoBackground({
  blurTargetRef,
}: {
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
}) {
  const player = useVideoPlayer(footballVideo, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <BlurTargetView
      ref={blurTargetRef}
      pointerEvents="none"
      style={styles.container}
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        playsInline
      />
      <LinearGradient
        colors={[
          "rgba(8,12,17,0.34)",
          "rgba(8,12,17,0.48)",
          "rgba(8,12,17,0.66)",
        ]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#080C11",
  },
  video: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
});
