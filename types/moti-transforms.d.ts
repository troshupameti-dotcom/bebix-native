/**
 * React Native 0.88 (Expo SDK 58) nuk i eksporton më tipet e transformimeve që i importon Moti. Pa to, tipet e
 * Moti bëhen `any` dhe çdo `transition={{ type: "timing", ... }}` del gabim. Këtu kthehen siç ishin te RN 0.86.
 */
import "react-native";

declare module "react-native" {
  interface PerspectiveTransform {
    perspective: number;
  }
  interface RotateTransform {
    rotate: string;
  }
  interface RotateXTransform {
    rotateX: string;
  }
  interface RotateYTransform {
    rotateY: string;
  }
  interface RotateZTransform {
    rotateZ: string;
  }
  interface ScaleTransform {
    scale: number;
  }
  interface ScaleXTransform {
    scaleX: number;
  }
  interface ScaleYTransform {
    scaleY: number;
  }
  interface TranslateXTransform {
    translateX: number | `${number}%`;
  }
  interface TranslateYTransform {
    translateY: number | `${number}%`;
  }
  interface SkewXTransform {
    skewX: string;
  }
  interface SkewYTransform {
    skewY: string;
  }
}
