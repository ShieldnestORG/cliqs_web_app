import {
  buildEditValidatorDescription,
  emptyValidatorEditDescription,
  getValidatorEditSeedData,
} from "@/lib/validatorEdit";
import { Validator } from "cosmjs-types/cosmos/staking/v1beta1/staking";

describe("validatorEdit helpers", () => {
  const validator = Validator.fromPartial({
    operatorAddress: "corevaloper1test",
    description: {
      moniker: "Original Moniker",
      identity: "original-id",
      website: "https://validator.example",
      securityContact: "security@example.com",
      details: "Original details",
    },
    commission: {
      commissionRates: {
        rate: "0.180000000000000000",
      },
    },
    minSelfDelegation: "123456789",
  });

  it("hydrates current validator values from staking data", () => {
    expect(getValidatorEditSeedData(validator)).toEqual({
      description: {
        moniker: "Original Moniker",
        identity: "original-id",
        website: "https://validator.example",
        securityContact: "security@example.com",
        details: "Original details",
      },
      commissionRate: "0.180000000000000000",
      minSelfDelegation: "123456789",
    });
  });

  it("returns empty seed data when validator is missing", () => {
    expect(getValidatorEditSeedData(null)).toEqual({
      description: emptyValidatorEditDescription(),
      commissionRate: "",
      minSelfDelegation: "",
    });
  });

  it("preserves unchanged validator fields while applying the edited one", () => {
    const description = buildEditValidatorDescription(
      {
        moniker: false,
        identity: false,
        website: false,
        securityContact: false,
        details: false,
        commissionRate: true,
        minSelfDelegation: false,
      },
      {
        moniker: "",
        identity: "",
        website: "",
        securityContact: "",
        details: "",
      },
      getValidatorEditSeedData(validator).description,
    );

    expect(description).toEqual({
      moniker: "Original Moniker",
      identity: "original-id",
      website: "https://validator.example",
      securityContact: "security@example.com",
      details: "Original details",
    });
  });

  it("uses the new value for fields explicitly being edited", () => {
    const description = buildEditValidatorDescription(
      {
        moniker: false,
        identity: false,
        website: true,
        securityContact: false,
        details: false,
        commissionRate: false,
        minSelfDelegation: false,
      },
      {
        moniker: "",
        identity: "",
        website: "https://new.example",
        securityContact: "",
        details: "",
      },
      getValidatorEditSeedData(validator).description,
    );

    expect(description).toEqual({
      moniker: "Original Moniker",
      identity: "original-id",
      website: "https://new.example",
      securityContact: "security@example.com",
      details: "Original details",
    });
  });
});
