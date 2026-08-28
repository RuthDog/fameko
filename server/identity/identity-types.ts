export type UserStatus = "invited" | "active" | "disabled";
export type HouseholdRole = "owner" | "member";

export type FamekoUser = {
  created_at: string;
  display_name: string | null;
  id: string;
  status: UserStatus;
  updated_at: string;
};

export type AuthIdentity = {
  created_at: string;
  email: string | null;
  id: string;
  provider: string;
  provider_subject: string;
  updated_at: string;
  user_id: string;
};

export type Household = {
  created_at: string;
  id: string;
  name: string | null;
  updated_at: string;
};

export type HouseholdMember = {
  created_at: string;
  household_id: string;
  role: HouseholdRole;
  user_id: string;
};

export type AuthorizedPilotContext = {
  household: Household;
  identity: AuthIdentity;
  membership: HouseholdMember;
  user: FamekoUser;
};
