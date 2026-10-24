// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Operator-issued content commitments. No claim about physical appliance execution.
contract ShiftReceipt is Ownable2Step {
    struct Receipt {
        bool exists;
        bytes32 planHash;
        bytes32 methodHash;
        uint64 commitBefore;
        uint64 committedAt;
        bool isDemo;
        address initialIssuer;
        uint32 latestRevision;
        bytes32 latestResultHash;
    }

    mapping(bytes32 => Receipt) private receipts;

    error ZeroDigest();
    error ReceiptAlreadyExists();
    error InvalidCutoff();
    error ReceiptNotFound();
    error InvalidRevision();
    error PreviousHashMismatch();
    error RepeatedResultHash();

    event PlanCommitted(bytes32 indexed receiptId, bytes32 planHash, bytes32 methodHash,
        uint64 commitBefore, uint64 committedAt, bool isDemo, address issuer);
    event ResultAppended(bytes32 indexed receiptId, uint32 indexed revision,
        bytes32 previousResultHash, bytes32 resultHash, address issuer);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function commitPlan(bytes32 receiptId, bytes32 planHash, bytes32 methodHash,
        uint64 commitBefore, bool isDemo) external onlyOwner {
        if (receiptId == bytes32(0) || planHash == bytes32(0) || methodHash == bytes32(0)) revert ZeroDigest();
        if (receipts[receiptId].exists) revert ReceiptAlreadyExists();
        if (isDemo ? commitBefore != 0 : commitBefore <= block.timestamp) revert InvalidCutoff();
        uint64 committedAt = uint64(block.timestamp);
        receipts[receiptId] = Receipt(true, planHash, methodHash, commitBefore, committedAt,
            isDemo, msg.sender, 0, bytes32(0));
        emit PlanCommitted(receiptId, planHash, methodHash, commitBefore, committedAt, isDemo, msg.sender);
    }

    function appendResult(bytes32 receiptId, uint32 revision, bytes32 previousResultHash,
        bytes32 resultHash) external onlyOwner {
        Receipt storage receipt = receipts[receiptId];
        if (!receipt.exists) revert ReceiptNotFound();
        if (resultHash == bytes32(0)) revert ZeroDigest();
        // Widen before addition so the exhausted uint32 sequence fails with a deliberate error.
        if (uint256(revision) != uint256(receipt.latestRevision) + 1) revert InvalidRevision();
        if (previousResultHash != receipt.latestResultHash) revert PreviousHashMismatch();
        if (resultHash == receipt.latestResultHash) revert RepeatedResultHash();
        receipt.latestRevision = revision;
        receipt.latestResultHash = resultHash;
        emit ResultAppended(receiptId, revision, previousResultHash, resultHash, msg.sender);
    }

    function getReceipt(bytes32 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }
}
