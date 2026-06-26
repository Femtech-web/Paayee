import Svg, { Path, Rect } from 'react-native-svg';

type PaayeeMarkProps = {
  size?: number;
  color?: string;
  accent?: string;
};

export function PaayeeMark({ size = 34, color = '#F47B20', accent = '#FFD55A' }: PaayeeMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect width="64" height="64" rx="20" fill="#FFF4D7" />
      <Path
        d="M17 18.5C17 16.567 18.567 15 20.5 15H38.25C45.153 15 50.75 20.597 50.75 27.5C50.75 34.403 45.153 40 38.25 40H29V48.5C29 50.433 27.433 52 25.5 52H20.5C18.567 52 17 50.433 17 48.5V18.5Z"
        fill={color}
      />
      <Path
        d="M29 24H37.75C39.959 24 41.75 25.791 41.75 28C41.75 30.209 39.959 32 37.75 32H29V24Z"
        fill="#FAF7F0"
      />
      <Path
        d="M45.5 45.5C49.366 45.5 52.5 42.366 52.5 38.5C52.5 34.634 49.366 31.5 45.5 31.5C41.634 31.5 38.5 34.634 38.5 38.5C38.5 42.366 41.634 45.5 45.5 45.5Z"
        fill={accent}
      />
    </Svg>
  );
}
