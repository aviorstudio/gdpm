export type SemverTriplet = {
  major: number;
  minor: number;
  patch: number;
};

const MAX_INT2 = 32767;

export const parseSemverTriplet = (value: string): SemverTriplet | null => {
  let input = value.trim();
  if (input.startsWith('v') || input.startsWith('V')) {
    input = input.slice(1);
  }

  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(input);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (!Number.isSafeInteger(major) || major < 0 || major > MAX_INT2) return null;
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_INT2) return null;
  if (!Number.isSafeInteger(patch) || patch < 0 || patch > MAX_INT2) return null;

  return { major, minor, patch };
};

export const formatSemverTriplet = (value: { major: number; minor: number; patch: number }) =>
  `${value.major}.${value.minor}.${value.patch}`;

export const formatSemverTripletFromNullable = (value: {
  major: number | null;
  minor: number | null;
  patch: number | null;
}) => {
  if (value.major == null || value.minor == null || value.patch == null) return '';
  return formatSemverTriplet({ major: value.major, minor: value.minor, patch: value.patch });
};
