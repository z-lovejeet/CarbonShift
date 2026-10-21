// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @dev M01 local-tool compatibility fixture. This is not the CarbonShift registry.
contract ToolingProbe is Ownable2Step {
    uint256 public value;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setValue(uint256 nextValue) external onlyOwner {
        value = nextValue;
    }
}
