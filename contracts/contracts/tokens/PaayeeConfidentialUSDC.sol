// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
  ERC7984,
  ERC7984ERC20Wrapper
} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice Paayee app-managed ERC-7984 confidential wrapper for USDC.
/// @dev Public USDC remains locked in this wrapper while cUSDC represents private Paayee value.
contract PaayeeConfidentialUSDC is ERC7984ERC20Wrapper, ZamaEthereumConfig {
  constructor(
    IERC20 usdc
  ) ERC7984ERC20Wrapper(usdc) ERC7984("Paayee Confidential USDC", "cUSDC", "ipfs://paayee/confidential-usdc") {}

  function underlyingToken() external view returns (address) {
    return address(underlying());
  }
}
