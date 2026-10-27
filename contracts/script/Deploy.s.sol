// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VairifyEscrow} from "../src/VairifyEscrow.sol";

/// @notice Deploy VairifyEscrow to the active chain.
/// Usage: VAIRIFY_USDC_ADDRESS=0x... forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
/// The deployer private key must come from the environment / keystore, never
/// committed to this repository.
contract Deploy is Script {
    function run() external returns (VairifyEscrow escrow) {
        address usdc = vm.envAddress("VAIRIFY_USDC_ADDRESS");
        require(usdc != address(0), "VAIRIFY_USDC_ADDRESS is not set");
        vm.startBroadcast();
        escrow = new VairifyEscrow(usdc);
        vm.stopBroadcast();
        console.log("VairifyEscrow deployed at:", address(escrow));
        console.log("USDC:", usdc);
    }
}
