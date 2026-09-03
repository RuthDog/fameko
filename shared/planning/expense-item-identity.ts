export type ExpenseItemIdentitySource = {
  company?: string;
  description?: string;
  name: string;
};

export type ExpenseItemPresentation = {
  brandLabel: string;
  company: string | null;
  description: string | null;
  primaryLabel: string;
};

export type NewExpenseItemIdentity = {
  company: string;
  description: string;
  name: string;
};

function normalizedOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createExpenseItemIdentity(
  companyValue: string,
  descriptionValue: string,
  fallbackName = "Ny kostnad",
): NewExpenseItemIdentity {
  const company = normalizedOptionalText(companyValue) ?? "";
  const description = normalizedOptionalText(descriptionValue) ?? "";

  return {
    company,
    description,
    name: company || fallbackName,
  };
}

export function getExpenseItemPresentation(
  item: ExpenseItemIdentitySource,
  legacyLabelOverride?: string,
): ExpenseItemPresentation {
  const company = normalizedOptionalText(item.company);
  const description = normalizedOptionalText(item.description);
  const name = item.name.trim();
  const legacyLabel = normalizedOptionalText(legacyLabelOverride);

  if (company) {
    return {
      brandLabel: company,
      company,
      description,
      primaryLabel: description ? `${company} ${description}` : company,
    };
  }

  return {
    brandLabel: name,
    company: null,
    description,
    primaryLabel: description ?? legacyLabel ?? name,
  };
}
