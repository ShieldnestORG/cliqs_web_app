import { Validator } from "cosmjs-types/cosmos/staking/v1beta1/staking";

export interface ValidatorEditDescriptionFields {
  moniker: string;
  identity: string;
  website: string;
  securityContact: string;
  details: string;
}

export interface ValidatorEditEnabledFields {
  moniker: boolean;
  identity: boolean;
  website: boolean;
  securityContact: boolean;
  details: boolean;
  commissionRate: boolean;
  minSelfDelegation: boolean;
}

export interface ValidatorEditSeedData {
  description: ValidatorEditDescriptionFields;
  commissionRate: string;
  minSelfDelegation: string;
}

export const emptyValidatorEditDescription = (): ValidatorEditDescriptionFields => ({
  moniker: "",
  identity: "",
  website: "",
  securityContact: "",
  details: "",
});

export const emptyValidatorEditSeedData = (): ValidatorEditSeedData => ({
  description: emptyValidatorEditDescription(),
  commissionRate: "",
  minSelfDelegation: "",
});

export function getValidatorEditSeedData(validator?: Validator | null): ValidatorEditSeedData {
  if (!validator) {
    return emptyValidatorEditSeedData();
  }

  return {
    description: {
      moniker: validator.description?.moniker || "",
      identity: validator.description?.identity || "",
      website: validator.description?.website || "",
      securityContact: validator.description?.securityContact || "",
      details: validator.description?.details || "",
    },
    commissionRate: validator.commission?.commissionRates?.rate || "",
    minSelfDelegation: validator.minSelfDelegation || "",
  };
}

export function buildEditValidatorDescription(
  enabledFields: ValidatorEditEnabledFields,
  editedDescription: ValidatorEditDescriptionFields,
  currentDescription: ValidatorEditDescriptionFields,
): ValidatorEditDescriptionFields {
  return {
    moniker: enabledFields.moniker ? editedDescription.moniker : currentDescription.moniker,
    identity: enabledFields.identity ? editedDescription.identity : currentDescription.identity,
    website: enabledFields.website ? editedDescription.website : currentDescription.website,
    securityContact: enabledFields.securityContact
      ? editedDescription.securityContact
      : currentDescription.securityContact,
    details: enabledFields.details ? editedDescription.details : currentDescription.details,
  };
}
