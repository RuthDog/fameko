export const adultRegistrationAttestation = "adult-confirmed-v1";

export function mayProvisionWorkosIdentity(
  identityAlreadyExists: boolean,
  callbackState: string | undefined,
): boolean {
  return identityAlreadyExists || callbackState === adultRegistrationAttestation;
}
