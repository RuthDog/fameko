import {
  isSameOriginFormRequest,
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "./public-auth-http.ts";
import { adultRegistrationAttestation } from "./registration.ts";

type WorkosSignUpUrlFactory = (options: {
  returnTo: string;
  state: string;
}) => Promise<string>;

function redirect(location: string): Response {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      Location: location,
      "Referrer-Policy": "no-referrer",
    },
    status: 303,
  });
}

export async function startWorkosSignUp(
  request: Request,
  environment: Record<string, string | undefined>,
  createSignUpUrl: WorkosSignUpUrlFactory,
): Promise<Response> {
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    return publicAuthUnavailableResponse(gate.status);
  }
  if (!isSameOriginFormRequest(request)) {
    return publicAuthUnavailableResponse(404);
  }

  const form = await request.formData();
  if (form.get("adult-confirmation") !== "confirmed") {
    return redirect(new URL("/sign-up?error=adult-required", request.url).toString());
  }

  try {
    const url = await createSignUpUrl({
      returnTo: "/app",
      state: adultRegistrationAttestation,
    });
    return redirect(url);
  } catch {
    return redirect(new URL("/auth/error", request.url).toString());
  }
}
