import fs from "node:fs";
import path from "node:path";
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

const OFFICIAL_TOKENS: Record<string, { USDC: string; USDT: string }> = {
  sepolia: {
    USDC: process.env.SEPOLIA_USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    USDT: process.env.SEPOLIA_USDT_ADDRESS || "0x93C5d30a7509E60871B77A3548a5BD913334cd35"
  }
};

const LOCAL_CHAIN_IDS = new Set([31337, 1337]);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, getOrNull } = hre.deployments;
  const chainId = hre.network.config.chainId ?? Number(await hre.getChainId());
  const officialTokens = OFFICIAL_TOKENS[hre.network.name];
  let usdcAddress = officialTokens?.USDC ?? process.env.PAAYEE_USDC_ADDRESS;
  let usdtAddress = officialTokens?.USDT ?? process.env.PAAYEE_USDT_ADDRESS;

  if (!usdcAddress || !usdtAddress) {
    if (!LOCAL_CHAIN_IDS.has(chainId)) {
      throw new Error("PAAYEE_TOKEN_UNDERLYING_REQUIRED: set PAAYEE_USDC_ADDRESS and PAAYEE_USDT_ADDRESS");
    }

    const mockUSDC = await deploy("MockUSDC", {
      contract: "MockERC20",
      from: deployer,
      args: ["USD Coin", "USDC", hre.ethers.parseUnits("1000000", 6), 6, deployer],
      log: true
    });
    const mockUSDT = await deploy("MockUSDT", {
      contract: "MockERC20",
      from: deployer,
      args: ["Tether USD", "USDT", hre.ethers.parseUnits("1000000", 6), 6, deployer],
      log: true
    });

    usdcAddress = mockUSDC.address;
    usdtAddress = mockUSDT.address;
  }

  const registry = await deploy("PaayeeConfidentialRegistry", {
    from: deployer,
    args: [deployer],
    log: true
  });
  const cUSDC = await deploy("PaayeeConfidentialUSDC", {
    from: deployer,
    args: [usdcAddress],
    log: true
  });
  const cUSDT = await deploy("PaayeeConfidentialUSDT", {
    from: deployer,
    args: [usdtAddress],
    log: true
  });

  const registryContract = await hre.ethers.getContractAt("PaayeeConfidentialRegistry", registry.address);

  if (!(await registryContract.isConfidentialAsset(cUSDC.address))) {
    await (await registryContract.registerAsset(cUSDC.address, "cUSDC", "USDC", true)).wait();
  }
  if (!(await registryContract.isConfidentialAsset(cUSDT.address))) {
    await (await registryContract.registerAsset(cUSDT.address, "cUSDT", "USDT", true)).wait();
  }

  const mockUSDC = await getOrNull("MockUSDC");
  const mockUSDT = await getOrNull("MockUSDT");
  const output = {
    network: hre.network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    privacyMode: "app_managed",
    underlyingTokens: {
      USDC: usdcAddress,
      USDT: usdtAddress
    },
    mockTokens: {
      USDC: mockUSDC?.address ?? usdcAddress,
      USDT: mockUSDT?.address ?? usdtAddress
    },
    confidentialTokens: {
      cUSDC: cUSDC.address,
      cUSDT: cUSDT.address
    },
    registry: registry.address,
    activeRail: "app_managed"
  };

  const outputPath = path.join(__dirname, "..", `paayee-confidential-assets.${hre.network.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`Paayee cUSDC: ${cUSDC.address}`);
  console.log(`Paayee cUSDT: ${cUSDT.address}`);
  console.log(`Paayee confidential registry: ${registry.address}`);
  console.log(`Paayee deployment output: ${outputPath}`);
};

export default func;
func.id = "deploy_paayee_confidential_assets";
func.tags = ["PaayeeConfidentialAssets"];
