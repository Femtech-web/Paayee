// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/// @notice Registry for Paayee-owned app-managed confidential assets.
contract PaayeeConfidentialRegistry is Ownable2Step {
  using ERC165Checker for address;

  struct ConfidentialAsset {
    address token;
    bool erc7984;
    bool enabled;
    string symbol;
    string underlyingSymbol;
  }

  mapping(address => ConfidentialAsset) public assets;

  event ConfidentialAssetRegistered(address indexed token, string symbol, string underlyingSymbol, bool erc7984);
  event ConfidentialAssetStatusChanged(address indexed token, bool enabled);

  constructor(address initialOwner) Ownable(initialOwner) {
    require(initialOwner != address(0), "PAAYEE_OWNER_REQUIRED");
  }

  function registerAsset(
    address token,
    string calldata symbol,
    string calldata underlyingSymbol,
    bool erc7984
  ) external onlyOwner {
    require(token != address(0), "PAAYEE_TOKEN_REQUIRED");
    require(bytes(symbol).length > 0, "PAAYEE_SYMBOL_REQUIRED");
    require(bytes(underlyingSymbol).length > 0, "PAAYEE_UNDERLYING_REQUIRED");

    assets[token] = ConfidentialAsset({
      token: token,
      erc7984: erc7984,
      enabled: true,
      symbol: symbol,
      underlyingSymbol: underlyingSymbol
    });

    emit ConfidentialAssetRegistered(token, symbol, underlyingSymbol, erc7984);
  }

  function registerDetectedAsset(
    address token,
    string calldata symbol,
    string calldata underlyingSymbol,
    bytes4 interfaceId
  ) external onlyOwner {
    require(token != address(0), "PAAYEE_TOKEN_REQUIRED");
    require(bytes(symbol).length > 0, "PAAYEE_SYMBOL_REQUIRED");
    require(bytes(underlyingSymbol).length > 0, "PAAYEE_UNDERLYING_REQUIRED");
    require(token.supportsInterface(interfaceId), "PAAYEE_INTERFACE_UNSUPPORTED");

    assets[token] = ConfidentialAsset({
      token: token,
      erc7984: true,
      enabled: true,
      symbol: symbol,
      underlyingSymbol: underlyingSymbol
    });

    emit ConfidentialAssetRegistered(token, symbol, underlyingSymbol, true);
  }

  function setAssetEnabled(address token, bool enabled) external onlyOwner {
    require(assets[token].token != address(0), "PAAYEE_ASSET_NOT_REGISTERED");
    assets[token].enabled = enabled;
    emit ConfidentialAssetStatusChanged(token, enabled);
  }

  function isConfidentialAsset(address token) external view returns (bool) {
    return assets[token].enabled && assets[token].token != address(0);
  }
}
