import { acceptCurrentLegalTerms } from "../../../../../server/legal/legal-acceptance-http.ts";

export async function POST(request: Request) {
  return acceptCurrentLegalTerms(request, process.env);
}
