// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {VairifyEscrow} from "../src/VairifyEscrow.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @notice Malicious token that tries to re-enter createPayment during the
/// test transfer inside createPayment. It records the attempt; the guard must
/// make the inner call revert.
contract ReentrantToken is ERC20 {
    VairifyEscrow public escrow;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    constructor() ERC20("Evil", "EVIL") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setEscrow(address e) external { escrow = VairifyEscrow(e); }
    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        if (address(escrow) != address(0) && !reentryAttempted) {
            reentryAttempted = true;
            try escrow.createPayment(to, amount, 1, block.timestamp + 1 days) {
                reentrySucceeded = true;
            } catch {}
        }
        return ok;
    }
}

/// @notice Minimal ERC-1271 wallet: validates a signature if it recovers to owner.
contract ERC1271Wallet {
    address public owner;
    bytes4 internal constant MAGIC = 0x1626ba7e;
    constructor(address _owner) { owner = _owner; }
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        return ECDSA.recover(hash, signature) == owner ? MAGIC : bytes4(0xffffffff);
    }
}

contract VairifyEscrowTest is Test {
    using ECDSA for bytes32;

    MockUSDC usdc;
    VairifyEscrow escrow;
    address sender = address(0xA11CE);
    uint256 recipientKey = 0xBEEF;
    address recipient;
    uint256 constant TOTAL = 5_000_000_000; // 5,000 USDC, 6 decimals
    uint256 constant TEST_AMT = 10_000; // 0.01 USDC
    uint256 constant EXPIRY = 7 days;

    function setUp() public {
        recipient = vm.addr(recipientKey);
        usdc = new MockUSDC();
        escrow = new VairifyEscrow(address(usdc));
        usdc.mint(sender, 1_000_000_000_000);
        vm.prank(sender);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(sender);
        id = escrow.createPayment(recipient, TOTAL, TEST_AMT, block.timestamp + EXPIRY);
    }

    function _sign(uint256 id) internal view returns (bytes memory sig) {
        VairifyEscrow.Payment memory p = escrow.getPayment(id);
        bytes32 digest = escrow.receiptDigest(p);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(recipientKey, digest);
        sig = abi.encodePacked(r, s, v);
    }

    function testDepositAndTestPayment() public {
        uint256 beforeRecipient = usdc.balanceOf(recipient);
        uint256 id = _create();
        VairifyEscrow.Payment memory p = escrow.getPayment(id);
        assertEq(uint8(p.state), uint8(VairifyEscrow.PaymentState.AwaitingRecipient));
        assertEq(p.remainingAmount, TOTAL - TEST_AMT);
        assertEq(usdc.balanceOf(recipient), beforeRecipient + TEST_AMT);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL - TEST_AMT);
        assertEq(p.totalAmount, TOTAL);
        assertEq(p.testAmount, TEST_AMT);
    }

    function testRecipientConfirmationAndSenderRelease() public {
        uint256 id = _create();
        escrow.confirmReceipt(id, _sign(id));
        assertEq(uint8(escrow.getPayment(id).state), uint8(VairifyEscrow.PaymentState.AwaitingSender));
        uint256 beforeRecipient = usdc.balanceOf(recipient);
        vm.prank(sender);
        escrow.releasePayment(id);
        assertEq(uint8(escrow.getPayment(id).state), uint8(VairifyEscrow.PaymentState.Released));
        assertEq(usdc.balanceOf(recipient), beforeRecipient + TOTAL - TEST_AMT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testWrongWalletSignatureRejected() public {
        uint256 id = _create();
        VairifyEscrow.Payment memory p = escrow.getPayment(id);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEAD, escrow.receiptDigest(p));
        vm.expectRevert(VairifyEscrow.InvalidSignature.selector);
        escrow.confirmReceipt(id, abi.encodePacked(r, s, v));
    }

    function testReplayPrevention() public {
        uint256 id = _create();
        bytes memory sig = _sign(id);
        escrow.confirmReceipt(id, sig);
        vm.expectRevert(
            abi.encodeWithSelector(
                VairifyEscrow.InvalidState.selector,
                VairifyEscrow.PaymentState.AwaitingSender
            )
        );
        escrow.confirmReceipt(id, sig);
    }

    function testCrossPaymentReplayRejected() public {
        uint256 id1 = _create();
        uint256 id2 = _create();
        bytes memory sig1 = _sign(id1);
        vm.expectRevert(VairifyEscrow.InvalidSignature.selector);
        escrow.confirmReceipt(id2, sig1);
        // Correct signature still works for payment 1 afterwards.
        escrow.confirmReceipt(id1, sig1);
    }

    function testCrossChainReplayRejected() public {
        uint256 id = _create();
        bytes memory sig = _sign(id);
        vm.chainId(999);
        vm.expectRevert(VairifyEscrow.InvalidSignature.selector);
        escrow.confirmReceipt(id, sig);
    }

    function testDuplicateReleasePrevention() public {
        uint256 id = _create();
        escrow.confirmReceipt(id, _sign(id));
        vm.prank(sender);
        escrow.releasePayment(id);
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(
                VairifyEscrow.InvalidState.selector,
                VairifyEscrow.PaymentState.Released
            )
        );
        escrow.releasePayment(id);
    }

    function testOnlySenderCanRelease() public {
        uint256 id = _create();
        escrow.confirmReceipt(id, _sign(id));
        vm.prank(recipient);
        vm.expectRevert(VairifyEscrow.NotSender.selector);
        escrow.releasePayment(id);
    }

    function testCancelBeforeRecipientApproval() public {
        uint256 id = _create();
        uint256 beforeSender = usdc.balanceOf(sender);
        vm.prank(sender);
        escrow.cancelPayment(id);
        assertEq(uint8(escrow.getPayment(id).state), uint8(VairifyEscrow.PaymentState.Cancelled));
        assertEq(usdc.balanceOf(sender), beforeSender + TOTAL - TEST_AMT);
    }

    function testCancelAfterRecipientApproval() public {
        uint256 id = _create();
        escrow.confirmReceipt(id, _sign(id));
        uint256 beforeSender = usdc.balanceOf(sender);
        vm.prank(sender);
        escrow.cancelPayment(id);
        assertEq(usdc.balanceOf(sender), beforeSender + TOTAL - TEST_AMT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testOnlySenderCanCancel() public {
        uint256 id = _create();
        vm.prank(recipient);
        vm.expectRevert(VairifyEscrow.NotSender.selector);
        escrow.cancelPayment(id);
    }

    function testExpirationAndRefund() public {
        uint256 id = _create();
        vm.warp(block.timestamp + EXPIRY + 1);
        uint256 beforeSender = usdc.balanceOf(sender);
        escrow.expirePayment(id);
        assertEq(uint8(escrow.getPayment(id).state), uint8(VairifyEscrow.PaymentState.Cancelled));
        assertEq(usdc.balanceOf(sender), beforeSender + TOTAL - TEST_AMT);
    }

    function testExpireBeforeDeadlineReverts() public {
        uint256 id = _create();
        vm.expectRevert(VairifyEscrow.NotExpired.selector);
        escrow.expirePayment(id);
    }

    function testSignatureExpiration() public {
        uint256 id = _create();
        bytes memory sig = _sign(id);
        vm.warp(block.timestamp + EXPIRY + 1);
        vm.expectRevert(VairifyEscrow.SignatureExpired.selector);
        escrow.confirmReceipt(id, sig);
    }

    function testInvalidTokenConfig() public {
        vm.expectRevert(VairifyEscrow.ZeroAddress.selector);
        new VairifyEscrow(address(0));
    }

    function testInsufficientAllowance() public {
        address poor = address(0x999);
        usdc.mint(poor, TOTAL);
        vm.prank(poor);
        usdc.approve(address(escrow), TOTAL - 1);
        vm.prank(poor);
        vm.expectRevert();
        escrow.createPayment(recipient, TOTAL, TEST_AMT, block.timestamp + EXPIRY);
    }

    function testInvalidAmountAndAddressAndDeadline() public {
        vm.prank(sender);
        vm.expectRevert(VairifyEscrow.ZeroAmount.selector);
        escrow.createPayment(recipient, 0, TEST_AMT, block.timestamp + EXPIRY);

        vm.prank(sender);
        vm.expectRevert(VairifyEscrow.InvalidTestAmount.selector);
        escrow.createPayment(recipient, TOTAL, TOTAL, block.timestamp + EXPIRY);

        vm.prank(sender);
        vm.expectRevert(VairifyEscrow.ZeroAddress.selector);
        escrow.createPayment(address(0), TOTAL, TEST_AMT, block.timestamp + EXPIRY);

        vm.prank(sender);
        vm.expectRevert(VairifyEscrow.InvalidExpiration.selector);
        escrow.createPayment(recipient, TOTAL, TEST_AMT, block.timestamp);
    }

    function testConcurrentEscrowAccounting() public {
        uint256 id1 = _create();
        address recipient2 = address(0x2222);
        uint256 total2 = 1_000_000_000;
        vm.prank(sender);
        uint256 id2 = escrow.createPayment(recipient2, total2, TEST_AMT, block.timestamp + EXPIRY);
        assertEq(usdc.balanceOf(address(escrow)), (TOTAL - TEST_AMT) + (total2 - TEST_AMT));
        // Release only the first payment; the second must stay escrowed.
        escrow.confirmReceipt(id1, _sign(id1));
        vm.prank(sender);
        escrow.releasePayment(id1);
        assertEq(usdc.balanceOf(address(escrow)), total2 - TEST_AMT);
        assertEq(uint8(escrow.getPayment(id2).state), uint8(VairifyEscrow.PaymentState.AwaitingRecipient));
    }

    function testERC1271ContractWalletRecipient() public {
        uint256 ownerKey = 0xC0FFEE;
        ERC1271Wallet wallet = new ERC1271Wallet(vm.addr(ownerKey));
        vm.prank(sender);
        uint256 id = escrow.createPayment(address(wallet), TOTAL, TEST_AMT, block.timestamp + EXPIRY);
        VairifyEscrow.Payment memory p = escrow.getPayment(id);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, escrow.receiptDigest(p));
        escrow.confirmReceipt(id, abi.encodePacked(r, s, v));
        assertEq(uint8(escrow.getPayment(id).state), uint8(VairifyEscrow.PaymentState.AwaitingSender));
    }

    function testERC1271WrongOwnerRejected() public {
        ERC1271Wallet wallet = new ERC1271Wallet(address(0x1234));
        vm.prank(sender);
        uint256 id = escrow.createPayment(address(wallet), TOTAL, TEST_AMT, block.timestamp + EXPIRY);
        VairifyEscrow.Payment memory p = escrow.getPayment(id);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEAD, escrow.receiptDigest(p));
        vm.expectRevert(VairifyEscrow.InvalidSignature.selector);
        escrow.confirmReceipt(id, abi.encodePacked(r, s, v));
    }

    function testReentrancyAttemptBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        VairifyEscrow evilEscrow = new VairifyEscrow(address(evil));
        evil.setEscrow(address(evilEscrow));
        evil.mint(sender, TOTAL);
        vm.prank(sender);
        evil.approve(address(evilEscrow), type(uint256).max);
        vm.prank(sender);
        uint256 id = evilEscrow.createPayment(recipient, TOTAL, TEST_AMT, block.timestamp + EXPIRY);
        assertTrue(evil.reentryAttempted());
        assertFalse(evil.reentrySucceeded());
        assertEq(evilEscrow.getPayment(id).remainingAmount, TOTAL - TEST_AMT);
    }

    function testFuzzAmounts(uint256 total) public {
        total = bound(total, TEST_AMT + 1, 900_000_000_000); // below the 1e12 minted to sender in setUp
        vm.prank(sender);
        uint256 id = escrow.createPayment(recipient, total, TEST_AMT, block.timestamp + EXPIRY);
        VairifyEscrow.Payment memory p = escrow.getPayment(id);
        assertEq(p.totalAmount, total);
        assertEq(p.remainingAmount, total - TEST_AMT);
        assertEq(usdc.balanceOf(address(escrow)), total - TEST_AMT);
        escrow.confirmReceipt(id, _sign(id));
        vm.prank(sender);
        escrow.releasePayment(id);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
