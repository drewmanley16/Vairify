// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title VairifyEscrow
/// @notice Escrows USDC for a two-party verified transfer. The sender deposits
/// the full amount, a small test payment is sent to the recipient immediately,
/// the recipient confirms receipt with an EIP-712 signature, and only then can
/// the original sender release the remaining balance.
/// @dev This contract is unaudited. Do not use it with real funds without an
/// independent security review.
/// @dev ERC-1271 revocation limitation: for contract wallets, SignatureChecker
/// validates the signature at the moment confirmReceipt is executed. If a
/// contract wallet revokes a signer before that call, validation fails and the
/// payment is not confirmed. However, once a receipt has been confirmed on
/// chain, later revocation cannot undo that confirmation. For EOAs, a
/// signature cannot be revoked after it is created; its protection comes from
/// the payment-specific, chain-specific, contract-specific and expiry-bound
/// digest, plus the one-time state transition from AwaitingRecipient.
contract VairifyEscrow is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PaymentState {
        AwaitingRecipient,
        AwaitingSender,
        Released,
        Cancelled
    }

    struct Payment {
        uint256 paymentId;
        address sender;
        address recipient;
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 testAmount;
        uint256 expiration;
        PaymentState state;
    }

    IERC20 public immutable usdc;
    uint256 public nextPaymentId;

    mapping(uint256 => Payment) private _payments;

    event PaymentCreated(
        uint256 indexed paymentId,
        address indexed sender,
        address indexed recipient,
        uint256 totalAmount,
        uint256 testAmount,
        uint256 expiration
    );
    event ReceiptConfirmed(uint256 indexed paymentId, address indexed recipient);
    event PaymentReleased(uint256 indexed paymentId, uint256 amount);
    event PaymentCancelled(uint256 indexed paymentId, address indexed sender, uint256 refunded);
    event PaymentExpired(uint256 indexed paymentId, uint256 refunded);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidTestAmount();
    error InvalidExpiration();
    error PaymentNotFound();
    error InvalidState(PaymentState state);
    error NotSender();
    error NotExpired();
    error SignatureExpired();
    error InvalidSignature();

    constructor(address usdcAddress) EIP712("VairifyEscrow", "1") {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
        nextPaymentId = 1;
    }

    function createPayment(
        address recipient,
        uint256 totalAmount,
        uint256 testAmount,
        uint256 expiration
    ) external nonReentrant returns (uint256 paymentId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (totalAmount == 0) revert ZeroAmount();
        if (testAmount == 0 || testAmount >= totalAmount) revert InvalidTestAmount();
        if (expiration <= block.timestamp) revert InvalidExpiration();

        paymentId = nextPaymentId++;

        // Pull the full amount first, then send the test payment. The test
        // payment counts toward the total, it is not charged on top of it.
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);
        usdc.safeTransfer(recipient, testAmount);

        _payments[paymentId] = Payment({
            paymentId: paymentId,
            sender: msg.sender,
            recipient: recipient,
            totalAmount: totalAmount,
            remainingAmount: totalAmount - testAmount,
            testAmount: testAmount,
            expiration: expiration,
            state: PaymentState.AwaitingRecipient
        });

        emit PaymentCreated(paymentId, msg.sender, recipient, totalAmount, testAmount, expiration);
    }

    function receiptDigest(Payment memory payment) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Receipt(uint256 paymentId,address escrow,uint256 chainId,address sender,address recipient,uint256 totalAmount,uint256 testAmount,uint256 expiration)"
                ),
                payment.paymentId,
                address(this),
                block.chainid,
                payment.sender,
                payment.recipient,
                payment.totalAmount,
                payment.testAmount,
                payment.expiration
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function confirmReceipt(uint256 paymentId, bytes calldata signature) external nonReentrant {
        Payment storage payment = _payments[paymentId];
        if (payment.sender == address(0)) revert PaymentNotFound();
        if (payment.state != PaymentState.AwaitingRecipient) revert InvalidState(payment.state);
        if (block.timestamp > payment.expiration) revert SignatureExpired();

        bytes32 digest = receiptDigest(payment);
        // SignatureChecker handles both EOA (ECDSA) and contract wallets
        // (ERC-1271) transparently.
        if (!SignatureChecker.isValidSignatureNow(payment.recipient, digest, signature)) {
            revert InvalidSignature();
        }

        payment.state = PaymentState.AwaitingSender;
        emit ReceiptConfirmed(paymentId, payment.recipient);
    }

    function releasePayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = _payments[paymentId];
        if (payment.sender == address(0)) revert PaymentNotFound();
        if (msg.sender != payment.sender) revert NotSender();
        if (payment.state != PaymentState.AwaitingSender) revert InvalidState(payment.state);

        uint256 amount = payment.remainingAmount;
        payment.state = PaymentState.Released;
        payment.remainingAmount = 0;
        usdc.safeTransfer(payment.recipient, amount);
        emit PaymentReleased(paymentId, amount);
    }

    function cancelPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = _payments[paymentId];
        if (payment.sender == address(0)) revert PaymentNotFound();
        if (msg.sender != payment.sender) revert NotSender();
        if (
            payment.state != PaymentState.AwaitingRecipient &&
            payment.state != PaymentState.AwaitingSender
        ) revert InvalidState(payment.state);

        uint256 refund = payment.remainingAmount;
        payment.state = PaymentState.Cancelled;
        payment.remainingAmount = 0;
        if (refund > 0) usdc.safeTransfer(payment.sender, refund);
        emit PaymentCancelled(paymentId, payment.sender, refund);
    }

    function expirePayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = _payments[paymentId];
        if (payment.sender == address(0)) revert PaymentNotFound();
        if (block.timestamp <= payment.expiration) revert NotExpired();
        if (
            payment.state != PaymentState.AwaitingRecipient &&
            payment.state != PaymentState.AwaitingSender
        ) revert InvalidState(payment.state);

        uint256 refund = payment.remainingAmount;
        payment.state = PaymentState.Cancelled;
        payment.remainingAmount = 0;
        if (refund > 0) usdc.safeTransfer(payment.sender, refund);
        emit PaymentExpired(paymentId, refund);
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        Payment memory payment = _payments[paymentId];
        if (payment.sender == address(0)) revert PaymentNotFound();
        return payment;
    }
}
