"use client";

import Image from "next/image";

export default function ImmersiveBackground({
  imageSrc,
  overlayClassName = "bg-black/55",
}: {
  imageSrc: string;
  overlayClassName?: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-50" aria-hidden="true">
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        loading="lazy"
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  );
}
