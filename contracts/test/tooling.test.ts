import assert from "node:assert/strict";
import { test } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

test("M01 tooling: pinned compiler, OpenZeppelin, local EVM and viem interoperate", async () => {
  const connection = await network.create("hardhat");
  try {
    const { viem } = connection;
    const [owner, other] = await viem.getWalletClients();
    assert.ok(owner && other);
    const probe = await viem.deployContract("ToolingProbe", [owner.account.address]);
    const reportedOwner = await probe.read.owner();
    assert.ok(typeof reportedOwner === "string");
    assert.equal(getAddress(reportedOwner), getAddress(owner.account.address));
    await probe.write.setValue([7n]);
    assert.equal(await probe.read.value(), 7n);
    await assert.rejects(probe.write.setValue([9n], { account: other.account }), /OwnableUnauthorizedAccount/);
    assert.equal(await probe.read.value(), 7n);
  } finally { await connection.close(); }
});
