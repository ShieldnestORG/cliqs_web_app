"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const math_1 = require("@cosmjs/math");
const tx_1 = require("cosmjs-types/cosmos/staking/v1beta1/tx");
console.log("🔍 DECIMAL DEBUG: Testing Decimal conversion for commission rates");
// Test the commission rate values from the logs
const rateInput = "0.200000000000000000";
const maxRateInput = "0.200000000000000000";
const maxChangeRateInput = "0.010000000000000000";
console.log("Input values:");
console.log("rate:", rateInput);
console.log("maxRate:", maxRateInput);
console.log("maxChangeRate:", maxChangeRateInput);
const rateAtomics = math_1.Decimal.fromUserInput(rateInput, 18).atomics;
const maxRateAtomics = math_1.Decimal.fromUserInput(maxRateInput, 18).atomics;
const maxChangeRateAtomics = math_1.Decimal.fromUserInput(maxChangeRateInput, 18).atomics;
console.log("\nAtomic string values:");
console.log("rateAtomics:", rateAtomics, typeof rateAtomics);
console.log("maxRateAtomics:", maxRateAtomics, typeof maxRateAtomics);
console.log("maxChangeRateAtomics:", maxChangeRateAtomics, typeof maxChangeRateAtomics);
// Test creating protobuf message
const msgValue = tx_1.MsgCreateValidator.fromPartial({
    description: {
        moniker: "Test",
        identity: "",
        website: "",
        securityContact: "",
        details: ""
    },
    commission: {
        rate: rateAtomics,
        maxRate: maxRateAtomics,
        maxChangeRate: maxChangeRateAtomics
    },
    minSelfDelegation: "20000000000",
    delegatorAddress: "test",
    validatorAddress: "test",
    pubkey: {
        type: "/cosmos.crypto.ed25519.PubKey",
        key: new Uint8Array()
    },
    value: { denom: "ucore", amount: "20300000000" }
});
console.log("\nProtobuf message created");
console.log("msgValue.commission:", msgValue.commission);
// Test JSON conversion
const jsonValue = tx_1.MsgCreateValidator.toJSON(msgValue);
console.log("\nJSON conversion result:");
console.log("jsonValue.commission:", jsonValue.commission);
console.log("jsonValue.commission.rate type:", typeof jsonValue.commission.rate);
console.log("jsonValue.commission.maxRate type:", typeof jsonValue.commission.maxRate);
console.log("jsonValue.commission.maxChangeRate type:", typeof jsonValue.commission.maxChangeRate);
// Test parsing back from JSON
try {
    const parsedValue = tx_1.MsgCreateValidator.fromJSON(jsonValue);
    console.log("\n✅ Parsed back from JSON successfully");
    console.log("parsedValue.commission:", parsedValue.commission);
}
catch (error) {
    console.error("\n❌ Error parsing back from JSON:", error);
}
// Test the specific values that might be causing issues
console.log("\nTesting individual commission values:");
const testValues = [
    { name: "rate", value: jsonValue.commission.rate },
    { name: "maxRate", value: jsonValue.commission.maxRate },
    { name: "maxChangeRate", value: jsonValue.commission.maxChangeRate }
];
testValues.forEach(({ name, value }) => {
    try {
        console.log(`\nTesting ${name}:`);
        console.log(`  Raw value: ${value}`);
        console.log(`  Type: ${typeof value}`);
        const testDecimal = math_1.Decimal.fromAtomics(value, 18);
        console.log(`  ✅ fromAtomics success: ${testDecimal.toString()}`);
    }
    catch (error) {
        console.error(`  ❌ ${name} fromAtomics error:`, error);
    }
});
