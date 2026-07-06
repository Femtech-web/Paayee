import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

type TestContract = any;

async function deployFixture() {
  const [deployer, alice, bob] = await ethers.getSigners();
  const initialSupply = ethers.parseUnits("1000000", 6);
  const shieldAmount = ethers.parseUnits("250", 6);

  const mockUSDC = (await ethers.deployContract("MockERC20", [
    "USD Coin",
    "USDC",
    initialSupply,
    6,
    deployer.address
  ])) as unknown as TestContract;
  const mockUSDT = (await ethers.deployContract("MockERC20", [
    "Tether USD",
    "USDT",
    initialSupply,
    6,
    deployer.address
  ])) as unknown as TestContract;
  const registry = (await ethers.deployContract("PaayeeConfidentialRegistry", [
    deployer.address
  ])) as unknown as TestContract;
  const cUSDC = (await ethers.deployContract("PaayeeConfidentialUSDC", [
    await mockUSDC.getAddress()
  ])) as unknown as TestContract;
  const cUSDT = (await ethers.deployContract("PaayeeConfidentialUSDT", [
    await mockUSDT.getAddress()
  ])) as unknown as TestContract;

  await registry.registerAsset(await cUSDC.getAddress(), "cUSDC", "USDC", true);
  await registry.registerAsset(await cUSDT.getAddress(), "cUSDT", "USDT", true);
  await mockUSDC.transfer(alice.address, shieldAmount);
  await mockUSDT.transfer(alice.address, shieldAmount);

  return {
    deployer,
    alice,
    bob,
    mockUSDC,
    mockUSDT,
    registry,
    cUSDC,
    cUSDT,
    shieldAmount
  };
}

async function decryptBalance(token: TestContract, owner: string, signer: HardhatEthersSigner): Promise<bigint> {
  const tokenAddress = await token.getAddress();
  const handle = await token.confidentialBalanceOf(owner);
  const clear = await fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, signer);
  return BigInt(clear);
}

describe("Paayee confidential stablecoins", function () {
  before(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    await fhevm.initializeCLIApi();
  });

  it("registers Paayee app-managed confidential assets", async function () {
    const fixture = await deployFixture();

    expect(await fixture.registry.isConfidentialAsset(await fixture.cUSDC.getAddress())).to.equal(true);
    expect(await fixture.registry.isConfidentialAsset(await fixture.cUSDT.getAddress())).to.equal(true);
  });

  it("shields local USDC and USDT into Paayee confidential balances", async function () {
    const fixture = await deployFixture();

    await fixture.mockUSDC.connect(fixture.alice).approve(await fixture.cUSDC.getAddress(), fixture.shieldAmount);
    await fixture.mockUSDT.connect(fixture.alice).approve(await fixture.cUSDT.getAddress(), fixture.shieldAmount);

    await fixture.cUSDC.connect(fixture.alice).wrap(fixture.alice.address, fixture.shieldAmount);
    await fixture.cUSDT.connect(fixture.alice).wrap(fixture.alice.address, fixture.shieldAmount);

    expect(await fixture.mockUSDC.balanceOf(await fixture.cUSDC.getAddress())).to.equal(fixture.shieldAmount);
    expect(await fixture.mockUSDT.balanceOf(await fixture.cUSDT.getAddress())).to.equal(fixture.shieldAmount);
    expect(await decryptBalance(fixture.cUSDC, fixture.alice.address, fixture.alice)).to.equal(fixture.shieldAmount);
    expect(await decryptBalance(fixture.cUSDT, fixture.alice.address, fixture.alice)).to.equal(fixture.shieldAmount);
    expect(await fixture.cUSDC.underlyingToken()).to.equal(await fixture.mockUSDC.getAddress());
    expect(await fixture.cUSDT.underlyingToken()).to.equal(await fixture.mockUSDT.getAddress());
  });

  it("mints local underlying USDC, shields it, and decrypts the confidential cUSDC balance", async function () {
    const fixture = await deployFixture();
    const mintAmount = ethers.parseUnits("125", 6);

    await fixture.mockUSDC.mint(fixture.bob.address, mintAmount);
    await fixture.mockUSDC.connect(fixture.bob).approve(await fixture.cUSDC.getAddress(), mintAmount);
    await fixture.cUSDC.connect(fixture.bob).wrap(fixture.bob.address, mintAmount);

    expect(await fixture.mockUSDC.balanceOf(await fixture.cUSDC.getAddress())).to.equal(mintAmount);
    expect(await decryptBalance(fixture.cUSDC, fixture.bob.address, fixture.bob)).to.equal(mintAmount);
  });

  it("privately transfers cUSDC between Paayee users and decrypts final balances", async function () {
    const fixture = await deployFixture();
    const transferAmount = ethers.parseUnits("40", 6);

    await fixture.mockUSDC.connect(fixture.alice).approve(await fixture.cUSDC.getAddress(), fixture.shieldAmount);
    await fixture.cUSDC.connect(fixture.alice).wrap(fixture.alice.address, fixture.shieldAmount);

    const encryptedInput = await fhevm
      .createEncryptedInput(await fixture.cUSDC.getAddress(), fixture.alice.address)
      .add64(transferAmount)
      .encrypt();

    await fixture.cUSDC
      .connect(fixture.alice)
      ["confidentialTransfer(address,bytes32,bytes)"](
        fixture.bob.address,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

    expect(await decryptBalance(fixture.cUSDC, fixture.alice.address, fixture.alice)).to.equal(
      fixture.shieldAmount - transferAmount
    );
    expect(await decryptBalance(fixture.cUSDC, fixture.bob.address, fixture.bob)).to.equal(transferAmount);
  });
});
