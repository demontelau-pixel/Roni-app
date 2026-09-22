import Image from "next/image";

interface RoniAvatarProps {
  size?: number;
  className?: string;
}

/** The official RONI mascot (a friendly pug), used wherever Roni "speaks". */
export function RoniAvatar({ size = 40, className }: RoniAvatarProps) {
  return (
    <Image
      src="/roni-logo.webp"
      alt="Roni the pug"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: "9999px", display: "block", flex: "none" }}
      priority
    />
  );
}
