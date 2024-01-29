// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Executor} from "./base/Executor.sol";
import {OwnerManager} from "./base/OwnerManager.sol";
import {FallbackManager} from "./base/FallbackManager.sol";
import {NativeCurrencyPaymentFallback} from "./common/NativeCurrencyPaymentFallback.sol";
import {Singleton} from "./common/Singleton.sol";
import {SignatureDecoder} from "./common/SignatureDecoder.sol";
import {SecuredTokenTransfer} from "./common/SecuredTokenTransfer.sol";
import {StorageAccessible} from "./common/StorageAccessible.sol";
import {Enum} from "./common/Enum.sol";
import {ISignatureValidator, ISignatureValidatorConstants} from "./interfaces/ISignatureValidator.sol";
import {SafeMath} from "./external/SafeMath.sol";

/**
 * @title Safe - A multisignature wallet with support for confirmations using signed messages based on EIP-712.
 * @dev Most important concepts:
 *      - Threshold: Number of required confirmations for a Safe transaction.
 *      - Owners: List of addresses that control the Safe. They are the only ones that can add/remove owners, change the threshold and
 *        approve transactions. Managed in `OwnerManager`.
 *      - Transaction Hash: Hash of a transaction is calculated using the EIP-712 typed structured data hashing scheme.
 *      - Nonce: Each transaction should have a different nonce to prevent replay attacks.
 *      - Signature: A valid signature of an owner of the Safe for a transaction hash.
 *      - Fallback: Fallback handler is a contract that can provide additional read-only functional for Safe. Managed in `FallbackManager`.
 *      Note: This version of the implementation contract doesn't emit events for the sake of gas efficiency and therefore requires a tracing node for indexing/
 *      For the events-based implementation see `SafeL2.sol`.
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract NXV is
    Singleton,
    NativeCurrencyPaymentFallback,
    Executor,
    OwnerManager,
    SignatureDecoder,
    ISignatureValidatorConstants,
    FallbackManager,
    StorageAccessible
{
    using SafeMath for uint256;

    string public constant VERSION = "1.0.0";

    /*
     *  Constants
     */
    // bytes32 public DOMAIN_SEPARATOR;
    bytes32 private constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant TRANSACTION_TYPEHASH = keccak256("Transaction(address to,uint256 value,bytes data,uint8 operation,uint256 nonce)");

    /*
     *  Events
     */
    event NXVSetup(address indexed initiator, address[] owners, uint256 threshold, address fallbackHandler);
    event ExecutionSuccess(bytes32 indexed txHash, uint256 indexed nonce);
    // event ExecutionFailure(uint indexed transactionId);

    /*
     *  Storage
     */
    mapping(bytes32 => bool) public txExists;
    mapping(uint256 => bool) public txNonces;

    // Mapping to keep track of all message hashes that have been approved by ALL REQUIRED owners
    mapping(bytes32 => uint256) public signedMessages;

    // This constructor ensures that this contract can only be used as a singleton for Proxy contracts
    constructor() {
        /**
         * By setting the threshold it is not possible to call setup anymore,
         * so we create a Safe with 0 owners and threshold 1.
         * This is an unusable Safe, perfect for the singleton
         */
        threshold = 1;
    }

    /**
     * @notice Sets an initial storage of the Safe contract.
     * @dev This method can only be called once.
     *      If a proxy was created without setting up, anyone can call setup and claim the proxy.
     * @param _owners List of Safe owners.
     * @param _threshold Number of required confirmations for a Safe transaction.
     * @param fallbackHandler Handler for fallback calls to this contract
     */
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address fallbackHandler
    ) external {
        // setupOwners checks if the Threshold is already set, therefore preventing that this method is called twice
        setupOwners(_owners, _threshold);
        if (fallbackHandler != address(0)) internalSetFallbackHandler(fallbackHandler);
        emit NXVSetup(msg.sender, _owners, _threshold, fallbackHandler);
    }

    /** @notice Executes a `operation` {0: Call, 1: DelegateCall}} transaction to `to` with `value` (Native Currency)
     *          and pays `gasPrice` * `gasLimit` in `gasToken` token to `refundReceiver`.
     * @dev The fees are always transferred, even if the user transaction fails.
     *      This method doesn't perform any sanity check of the transaction, such as:
     *      - if the contract at `to` address has code or not
     *      - if the `gasToken` is a contract or not
     *      It is the responsibility of the caller to perform such checks.
     * @param to to address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param nonce Transaction nonce
     * @param signatures Signature data that should be verified.
     *                   Can be packed ECDSA signature ({bytes32 r}{bytes32 s}{uint8 v}), contract signature (EIP-1271) or approved hash.
     * @return success Boolean indicating transaction's success.
     */
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 nonce,
        bytes memory signatures
    ) public payable virtual returns (bool success) {
        // require(signatures.length >= threshold, "invalid signature data length");

        // "txHash" is the unique hash of transaction data
        bytes32 txHash = getTransactionHash(to, value, data, operation, nonce);
        require(!txExists[txHash], "tx-exist");

        // two identical nonce only allow one to be executed
        // uint256 nonce = nonce;
        require(!txNonces[nonce], "tx-nonce-exist");

        checkSignatures(txHash, "", signatures);

        txNonces[nonce] = true;
        txExists[txHash] = true;

        success = execute(to, value, data, operation, (gasleft() - 2500));
        require(success, "call-failed");

        emit ExecutionSuccess(txHash, nonce);
    }

    /**
     * @notice Checks whether the signature provided is valid for the provided data and hash. Reverts otherwise.
     * @param txHash Hash of the data (could be either a message hash or transaction hash)
     * @param data That should be signed (this is passed to an external validator contract)
     * @param signatures Signature data that should be verified.
     *                   Can be packed ECDSA signature ({bytes32 r}{bytes32 s}{uint8 v}), contract signature (EIP-1271) or approved hash.
     */
    function checkSignatures(bytes32 txHash, bytes memory data, bytes memory signatures) public view {
        // Load threshold to avoid multiple storage loads
        uint256 _threshold = threshold;
        // Check that a threshold is set
        require(_threshold > 0, "Threshold needs defined");
        checkNSignatures(txHash, data, signatures, _threshold);
    }

    /**
     * @notice Checks whether the signature provided is valid for the provided data and hash. Reverts otherwise.
     * @dev Since the EIP-1271 does an external call, be mindful of reentrancy attacks.
     * @param txHash Hash of the data (could be either a message hash or transaction hash)
     * @param signatures Signature data that should be verified.
     *                   Can be packed ECDSA signature ({bytes32 r}{bytes32 s}{uint8 v}), contract signature (EIP-1271) or approved hash.
     * @param requiredSignatures Amount of required valid signatures.
     */
    function checkNSignatures(bytes32 txHash, bytes memory /* data */, bytes memory signatures, uint256 requiredSignatures) public view {
        // Check that the provided signature data is not too short
        require(signatures.length >= requiredSignatures * 65, "invalid sig length");
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 i;
        for(i = 0; i < requiredSignatures; i++) {
            (v, r, s) = signatureSplit(signatures, i);
            currentOwner = ecrecover(txHash, v, r, s);
            // to save gas, need signature sorted
            require(currentOwner > lastOwner && owners[currentOwner] != address(0) && currentOwner != SENTINEL_OWNERS, "error-sig");
            lastOwner = currentOwner;
        }
    }

    /**
     * @notice Returns the ID of the chain the contract is currently deployed on.
     * @return The ID of the current chain as a uint256.
     */
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }

    /**
     * @dev Returns the domain separator for this contract, as defined in the EIP-712 standard.
     * @return bytes32 The domain separator hash.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256("NXVWallet"), // name
                getChainId(),
                address(this)
            )
        );
    }

    /**
     * @notice Returns the pre-image of the transaction hash (see getTransactionHash).
     * @param to to address.
     * @param value Ether value.
     * @param data Data payload.
     * @param operation Operation type.
     * @param _nonce Transaction nonce.
     * @return Transaction hash bytes.
     */
    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 _nonce
    ) private view returns (bytes memory) {
        bytes32 txHash = keccak256(
            abi.encode(
                TRANSACTION_TYPEHASH,
                to,
                value,
                keccak256(data),
                operation,
                _nonce
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), txHash);
    }

    /**
     * @notice Returns transaction hash to be signed by owners.
     * @param to to address.
     * @param value Ether value.
     * @param data Data payload.
     * @param operation Operation type.
     * @param _nonce Transaction nonce.
     * @return Transaction hash.
     */
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 _nonce
    ) public view returns (bytes32) {
        return keccak256(encodeTransactionData(to, value, data, operation, _nonce));
    }
}
