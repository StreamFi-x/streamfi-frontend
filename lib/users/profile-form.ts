import {
  JsonbContractError,
  prepareCreator,
  prepareSocialLinks,
  type Creator,
  type JsonbColumn,
  type SocialLinks,
} from "@/lib/db/jsonb-contracts";

function readJsonField(
  formData: FormData,
  field: string,
  column: JsonbColumn
): unknown {
  const raw = formData.get(field);
  if (
    raw === null ||
    raw === "" ||
    raw === "null" ||
    raw === "undefined" ||
    typeof raw !== "string"
  ) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new JsonbContractError(column, ["(root): not valid JSON"]);
  }
}

/**
 * Parse and validate the JSONB fields of the profile update form. An absent
 * field is returned as undefined so the caller leaves the stored value alone.
 * Throws JsonbContractError for malformed input.
 */
export function parseProfileJsonbFields(formData: FormData): {
  socialLinks?: SocialLinks;
  creator?: Creator;
} {
  const socialLinks = readJsonField(formData, "socialLinks", "sociallinks");
  const creator = readJsonField(formData, "creator", "creator");
  return {
    socialLinks:
      socialLinks === undefined ? undefined : prepareSocialLinks(socialLinks),
    creator: creator === undefined ? undefined : prepareCreator(creator),
  };
}
