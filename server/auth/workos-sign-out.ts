import { redirect, unstable_rethrow } from "next/navigation.js";

type WorkosSignOut = () => Promise<void>;

export async function completeWorkosSignOut(signOut: WorkosSignOut): Promise<never> {
  try {
    await signOut();
  } catch (error) {
    unstable_rethrow(error);
    redirect("/auth/error");
  }

  redirect("/auth/error");
}
