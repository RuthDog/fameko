export type RecentAuthChecker = (options: {
  maxAge: number;
}) => Promise<{ isStale: boolean }>;

export async function needsAccountDeleteReauthentication(
  checkRecentAuth: RecentAuthChecker,
): Promise<boolean> {
  try {
    const recent = await checkRecentAuth({ maxAge: 300 });
    return recent.isStale !== false;
  } catch {
    return true;
  }
}
