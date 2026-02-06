"use client";

import Image from "next/image";

export default function ImmersiveBackground({
  imageSrc,
  overlayClassName = "bg-black/55",
  imageClassName,
  imageStyle,
  imageContainerClassName,
}: {
  imageSrc: string;
  overlayClassName?: string;
  imageClassName?: string;
  imageStyle?: React.CSSProperties;
  imageContainerClassName?: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-50 bg-black" aria-hidden="true">
      <div className={imageContainerClassName ?? "absolute inset-0"}>
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="100vw"
          className={["object-cover", imageClassName].filter(Boolean).join(" ")}
          style={imageStyle}
          loading="lazy"
        />
      </div>
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  );
}
