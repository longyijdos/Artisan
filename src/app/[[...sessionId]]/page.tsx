"use client";

import dynamic from "next/dynamic";

const ArtisanPage = dynamic(() => import("./ArtisanPage"), { ssr: false });

export default function Page() {
  return <ArtisanPage />;
}
