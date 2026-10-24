// Generated from the pinned compiler artifact by pnpm proof:artifacts. Do not edit.
export const SHIFT_RECEIPT_ABI_V1 = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "initialOwner",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "InvalidCutoff",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidRevision",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PreviousHashMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReceiptAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReceiptNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RepeatedResultHash",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroDigest",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "receiptId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "planHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "methodHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "commitBefore",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "committedAt",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isDemo",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "issuer",
        "type": "address"
      }
    ],
    "name": "PlanCommitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "receiptId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "revision",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "previousResultHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "resultHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "issuer",
        "type": "address"
      }
    ],
    "name": "ResultAppended",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "acceptOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "receiptId",
        "type": "bytes32"
      },
      {
        "internalType": "uint32",
        "name": "revision",
        "type": "uint32"
      },
      {
        "internalType": "bytes32",
        "name": "previousResultHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "resultHash",
        "type": "bytes32"
      }
    ],
    "name": "appendResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "receiptId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "planHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "methodHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint64",
        "name": "commitBefore",
        "type": "uint64"
      },
      {
        "internalType": "bool",
        "name": "isDemo",
        "type": "bool"
      }
    ],
    "name": "commitPlan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "receiptId",
        "type": "bytes32"
      }
    ],
    "name": "getReceipt",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bool",
            "name": "exists",
            "type": "bool"
          },
          {
            "internalType": "bytes32",
            "name": "planHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "methodHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint64",
            "name": "commitBefore",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "committedAt",
            "type": "uint64"
          },
          {
            "internalType": "bool",
            "name": "isDemo",
            "type": "bool"
          },
          {
            "internalType": "address",
            "name": "initialIssuer",
            "type": "address"
          },
          {
            "internalType": "uint32",
            "name": "latestRevision",
            "type": "uint32"
          },
          {
            "internalType": "bytes32",
            "name": "latestResultHash",
            "type": "bytes32"
          }
        ],
        "internalType": "struct ShiftReceipt.Receipt",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pendingOwner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
