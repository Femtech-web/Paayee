// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Local-only ERC-20 used to model USDC/USDT in Hardhat tests and dev deployments.
contract MockERC20 is ERC20, Ownable {
  uint8 private immutable _customDecimals;

  constructor(
    string memory name_,
    string memory symbol_,
    uint256 initialSupply,
    uint8 decimals_,
    address initialOwner
  ) ERC20(name_, symbol_) Ownable(initialOwner) {
    require(initialOwner != address(0), "PAAYEE_OWNER_REQUIRED");
    _customDecimals = decimals_;
    _mint(initialOwner, initialSupply);
  }

  function decimals() public view override returns (uint8) {
    return _customDecimals;
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }
}
