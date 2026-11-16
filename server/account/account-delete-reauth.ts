type SignInUrlFactory = (options: {
  maxAge: number;
  returnTo: string;
}) => Promise<string>;

export async function startAccountDeleteReauthentication(
  request: Request,
  createSignInUrl: SignInUrlFactory,
): Promise<Response> {
  try {
    const url = await createSignInUrl({
      maxAge: 300,
      returnTo: "/app/account/delete",
    });
    return new Response(null, {
      headers: {
        "Cache-Control": "no-store",
        Location: url,
        "Referrer-Policy": "no-referrer",
      },
      status: 303,
    });
  } catch {
    return new Response(null, {
      headers: {
        "Cache-Control": "no-store",
        Location: new URL("/auth/error", request.url).toString(),
      },
      status: 303,
    });
  }
}
