import * as fontkitNs from "@pdf-lib/fontkit";

type FontkitLike = {
  create: (data: Uint8Array, postscriptName?: string) => unknown;
};

const candidate = fontkitNs as unknown as FontkitLike & { default?: FontkitLike };

const fontkit: FontkitLike = typeof candidate.create === "function" ? candidate : (candidate.default as FontkitLike);

export default fontkit;
