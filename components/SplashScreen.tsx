import LottieView from "lottie-react-native";

import sp from "@/assets/images/lotties/SplashScreen.json";

export default function SplashScreen({ onFinish = (isCancelled) => {} } : { onFinish?: (isCancelled: boolean) => void }) {
  return (
    <LottieView
      source={sp}
      onAnimationFinish={onFinish}
      autoPlay
      resizeMode="cover"
      loop={false}
      style={{
        flex: 1,
        width: "100%"
      }}
    />   
  )
}