/**
 * User Journey Definitions
 *
 * Structured walkthroughs for each major flow in CLIQS.
 * Each journey has steps displayed as tabs on the Get Started page.
 */

import {
  Key,
  FileCode2,
  UserPlus,
  Send,
  Database,
  Search,
  Wallet,
  Users,
  Settings,
  PenTool,
  Radio,
  type LucideIcon,
} from "lucide-react";

export interface JourneyStep {
  title: string;
  description: string;
  details: string[];
  tip?: string;
}

export interface UserJourney {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  category: "create" | "transact" | "manage";
  estimatedTime: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  prerequisites: string[];
  steps: JourneyStep[];
  navigateTo?: string;
}

export const journeyCategories = [
  { id: "create" as const, label: "Create a Multisig", icon: Users },
  { id: "transact" as const, label: "Transactions", icon: Send },
  { id: "manage" as const, label: "Setup & Management", icon: Settings },
];

export const userJourneys: UserJourney[] = [
  // ── Create Flows ──────────────────────────────────────────────
  {
    id: "create-pubkey",
    title: "Create a PubKey Multisig",
    subtitle: "Traditional Cosmos SDK multisig",
    description:
      "The most secure option for cold storage and treasury management. Uses public keys to derive the multisig address. Ideal when members have hardware wallets.",
    icon: Key,
    category: "create",
    estimatedTime: "5-10 min",
    difficulty: "beginner",
    prerequisites: [
      "A connected wallet (Keplr or Ledger)",
      "Public keys or wallet addresses of all members",
      "At least 2 members for the multisig",
    ],
    steps: [
      {
        title: "Connect Your Wallet",
        description:
          "Start by connecting your wallet using Keplr browser extension or Ledger hardware wallet.",
        details: [
          "Click the Keplr or Ledger button in the sidebar to connect.",
          "Make sure you're on the correct chain — use the chain selector at the top of the sidebar.",
          "Your connected address will appear at the bottom of the sidebar once connected.",
        ],
        tip: "Ledger provides the highest security for signing. If you're managing significant funds, consider using a hardware wallet.",
      },
      {
        title: "Start Creating",
        description:
          'Navigate to "Create Multisig" in the sidebar, then select the PubKey tab.',
        details: [
          'Click "Create Multisig" in the left sidebar navigation.',
          "You'll see three multisig type cards — select PubKey.",
          "The PubKey creation form will appear with a tabbed interface.",
        ],
        tip: "PubKey multisigs are the classic Cosmos approach. The address is derived from the members' keys, meaning it changes if members change.",
      },
      {
        title: "Name Your CLIQ",
        description: "Give your multisig a memorable name and optional description.",
        details: [
          "Enter a name that helps you identify this multisig (e.g., 'Treasury', 'Dev Fund').",
          "Optionally add a description explaining the purpose of this multisig.",
          'Click "Next" to proceed to member setup.',
        ],
      },
      {
        title: "Add Members",
        description: "Add the wallet addresses or public keys of each member.",
        details: [
          "Enter each member's Cosmos address (bech32 format) or compressed secp256k1 public key.",
          "You can paste multiple addresses at once, separated by commas or spaces.",
          "The system will automatically fetch public keys from on-chain data when addresses are used.",
          "You need at least 2 members for a valid multisig.",
        ],
        tip: "If a member's address has never had an on-chain transaction, their public key won't be available. In that case, they'll need to provide their public key directly.",
      },
      {
        title: "Set Approval Threshold",
        description: "Choose how many signatures are required to authorize a transaction.",
        details: [
          "Use the slider to set the threshold (e.g., 2-of-3, 3-of-5).",
          "A higher threshold means more security but requires more signers to approve.",
          "Common patterns: 2-of-3 for small teams, 3-of-5 for DAOs, 4-of-7 for treasuries.",
        ],
        tip: "Consider what happens if a member loses access. A 2-of-3 is resilient to one lost key while still requiring consensus.",
      },
      {
        title: "Review & Create",
        description: "Review the multisig configuration and create it.",
        details: [
          "Double-check all member addresses and the threshold setting.",
          "The derived multisig address will be shown — save this address!",
          'Click "Create" to finalize. The multisig is stored in your database.',
          "You'll be redirected to the multisig dashboard where you can start creating transactions.",
        ],
        tip: "Bookmark the multisig address page for quick access. You can also find it later under 'My CLIQS'.",
      },
    ],
    navigateTo: "/create",
  },

  {
    id: "create-contract-fixed",
    title: "Create a Contract Fixed Multisig",
    subtitle: "CW3-Fixed smart contract multisig",
    description:
      "A guided wizard that uploads and deploys a CW3-Fixed contract for you. Provides a stable address that never changes, with weighted voting. No Code IDs or technical knowledge needed — just fill in the form.",
    icon: FileCode2,
    category: "create",
    estimatedTime: "5-10 min",
    difficulty: "intermediate",
    prerequisites: [
      "A connected Keplr wallet (Ledger can be used for instantiation after upload)",
      "Sufficient funds for gas (the wizard handles contract upload + instantiation)",
      "A chain that supports CosmWasm smart contracts",
    ],
    steps: [
      {
        title: "Connect Your Wallet",
        description:
          "Connect Keplr and select a CosmWasm-enabled chain.",
        details: [
          "Click the Keplr button in the sidebar to connect.",
          "Ensure you're on a chain that supports CosmWasm (e.g., Juno, Osmosis, Archway, Coreum).",
          "Keplr is needed for the upload step. You can optionally switch to a hardware wallet for instantiation later.",
        ],
        tip: "Not all chains support CosmWasm. If you don't see the Contract options, your selected chain may not have WASM enabled.",
      },
      {
        title: "Name Your CLIQ (Step 1 of 6)",
        description:
          "The wizard starts with naming your multisig.",
        details: [
          'Navigate to "Create Multisig" and select the Fixed tab.',
          "Enter a memorable name and optional description.",
          "The wizard auto-configures everything — no Code IDs needed by default.",
          "Advanced users can expand 'Advanced settings' to provide an existing Code ID, contract label, or admin address.",
        ],
        tip: "If you already have a CW3-Fixed Code ID deployed on this chain, enter it in advanced settings to skip the upload step and save gas.",
      },
      {
        title: "Add Weighted Members (Step 2)",
        description: "Add member addresses with individual voting weights.",
        details: [
          "Enter each member's wallet address.",
          "Assign a voting weight to each member (e.g., 1, 2, 5).",
          "Weights determine how much each member's vote counts toward the threshold.",
          "For equal voting power, give everyone weight 1. You need at least 2 members.",
        ],
        tip: "Weighted voting is powerful for organizations where some members should have more say. For example, a founding team might have weight 3 while advisors have weight 1.",
      },
      {
        title: "Set Threshold & Voting Period (Step 3)",
        description: "Configure the approval requirements and time limits.",
        details: [
          "Use the slider to set the weight threshold — proposals pass when votes meet this number.",
          "Set the voting period in days — proposals expire after this time.",
          "The threshold cannot exceed the total combined weight of all members.",
        ],
        tip: "If total weights are 10 and threshold is 6, you need members whose weights sum to at least 6 to approve a proposal.",
      },
      {
        title: "Review & Choose Contract Source (Step 4)",
        description: "Verify your configuration and decide where the contract comes from.",
        details: [
          "Review all settings — name, members, threshold, voting period.",
          "Choose your contract source: 'Bundled (recommended)' uses a pre-compiled, validated CW3-Fixed binary. 'Custom WASM' lets you upload your own.",
          "Optionally check 'Switch to hardware wallet after upload' to use Ledger for instantiation.",
          "The app validates the WASM binary against your chain's requirements (size limits, opcode compatibility) before uploading.",
        ],
        tip: "The bundled option works for most users. Choose 'Custom WASM' only if you've compiled your own contract variant.",
      },
      {
        title: "Deploy (Step 5-6)",
        description: "The wizard uploads the contract code and creates your multisig in one flow.",
        details: [
          "Click 'Upload & Create' — the wizard handles everything automatically.",
          "Phase 1: Uploads the WASM binary to the chain (approve in Keplr). You receive a fresh Code ID.",
          "Phase 2: If you opted for a wallet switch, disconnect and reconnect with your hardware wallet.",
          "Phase 3: Instantiates the contract with your configuration (approve in Keplr).",
          "Your new contract address is displayed. Download a backup JSON with all details.",
          "Server data is retained for a limited period — the backup is your permanent copy.",
        ],
        tip: "If you provided an existing Code ID, the upload step is skipped entirely — only instantiation is needed, saving gas and time.",
      },
    ],
    navigateTo: "/create",
  },

  {
    id: "create-flex",
    title: "Create a Flex Multisig",
    subtitle: "CW3-Flex + CW4-Group dynamic multisig",
    description:
      "A guided wizard that uploads and deploys both CW4-Group and CW3-Flex contracts. Members can be added or removed via proposals without changing the multisig address. The app handles all contract setup automatically.",
    icon: UserPlus,
    category: "create",
    estimatedTime: "10-15 min",
    difficulty: "advanced",
    prerequisites: [
      "A connected Keplr wallet (Ledger can be used for instantiation after upload)",
      "Sufficient funds for gas (the wizard uploads 2 contracts + instantiates both)",
      "A CosmWasm-enabled chain",
    ],
    steps: [
      {
        title: "Connect Your Wallet",
        description: "Connect Keplr and pick a CosmWasm-enabled chain.",
        details: [
          "Connect your Keplr wallet from the sidebar.",
          "Select a chain that supports CosmWasm smart contracts.",
          "Ensure you have enough tokens for gas — Flex requires 2 contract uploads and 2-3 instantiation transactions.",
        ],
        tip: "Flex costs more gas than Fixed because it deploys two contracts. Budget accordingly — on most chains this is still under $1.",
      },
      {
        title: "Name Your CLIQ (Step 1 of 6)",
        description: "Give your flex multisig an identity.",
        details: [
          'Navigate to "Create Multisig" and select the Flex tab.',
          "Enter a descriptive name and optional description.",
          "The wizard auto-configures both Code IDs — no technical knowledge needed.",
          "Advanced users can expand 'Advanced settings' to provide existing CW4-Group and CW3-Flex Code IDs, contract labels, or a multisig admin address.",
        ],
        tip: "If you already have CW4-Group and CW3-Flex Code IDs deployed on this chain, enter them in advanced settings to skip both uploads.",
      },
      {
        title: "Add Members with Weights (Step 2)",
        description: "Define the initial member set with voting weights.",
        details: [
          "Add each member's wallet address and assign a voting weight.",
          "Unlike Fixed, these members can be changed later via governance proposals.",
          "The initial member set is stored in the CW4-Group contract.",
          "You need at least 2 members.",
        ],
        tip: "Don't worry about getting membership perfect now — the whole point of Flex is that you can add or remove members later through proposals.",
      },
      {
        title: "Configure Governance (Step 3)",
        description: "Set voting rules and group admin.",
        details: [
          "Set the weight threshold — proposals pass when accumulated votes meet this number.",
          "Set the voting period in days — proposals expire after this time.",
          "Choose the Group Admin — who can manage membership:",
          "'Multisig controls membership' (recommended): the multisig governs itself via proposals.",
          "'Custom admin': a specific address has direct control over membership.",
          "'No admin': membership is permanent and can never be changed.",
        ],
        tip: "'Multisig controls membership' is the best choice for most teams. Adding or removing members requires a governance proposal, keeping everyone accountable.",
      },
      {
        title: "Review & Choose Contract Source (Step 4)",
        description: "Verify your configuration and decide where the contracts come from.",
        details: [
          "Review all settings — name, members, threshold, voting period, group admin type.",
          "Choose your contract source: 'Bundled (recommended)' uses pre-compiled, validated CW4-Group and CW3-Flex binaries. 'Custom WASM' lets you upload your own files for both.",
          "Optionally enable 'Switch to hardware wallet after upload' to use Ledger for instantiation.",
          "The transaction count is shown — the number of wallet approvals you'll need.",
          "The app validates each WASM binary against your chain's requirements before uploading.",
        ],
        tip: "The bundled option is thoroughly tested and works on all supported chains. Only use custom WASM if you've compiled specialized contract variants.",
      },
      {
        title: "Deploy (Step 5-6)",
        description:
          "The wizard uploads both contracts and deploys your Flex multisig in one flow.",
        details: [
          "Click 'Upload & Create Flex CLIQ' — the wizard handles all 4-5 transactions automatically.",
          "Phase 1: Uploads CW4-Group WASM (approve in Keplr) — you get a Code ID.",
          "Phase 2: Uploads CW3-Flex WASM (approve in Keplr) — you get a second Code ID.",
          "Phase 3 (optional): Switch to hardware wallet if you enabled it.",
          "Phase 4: Instantiates the CW4-Group with your member list (approve in Keplr).",
          "Phase 5: Instantiates the CW3-Flex contract linked to the group (approve in Keplr).",
          "Phase 6 (if applicable): Transfers group admin to the multisig (approve in Keplr).",
          "Both contract addresses are displayed. Download a backup JSON with all details and tx hashes.",
        ],
        tip: "If you provided existing Code IDs, the upload phases are skipped — saving gas and approvals. Don't close the browser during deployment.",
      },
    ],
    navigateTo: "/create",
  },

  // ── Transaction Flows ──────────────────────────────────────────
  {
    id: "create-sign-transaction",
    title: "Create & Sign a Transaction",
    subtitle: "For PubKey multisigs",
    description:
      "Walk through creating a new transaction on a PubKey multisig, collecting signatures from members, and broadcasting it to the chain.",
    icon: PenTool,
    category: "transact",
    estimatedTime: "5-15 min (per signer)",
    difficulty: "beginner",
    prerequisites: [
      "An existing PubKey multisig",
      "A connected wallet that is a member of the multisig",
      "Funds in the multisig for the transaction",
    ],
    steps: [
      {
        title: "Navigate to Your Multisig",
        description: "Open your multisig from the dashboard or by address.",
        details: [
          "Go to 'My CLIQS' in the sidebar to find your multisigs.",
          "Or use 'Find CLIQ' and enter the multisig address directly.",
          "Click on the multisig to open its dashboard.",
        ],
      },
      {
        title: "Create New Transaction",
        description: "Start a new transaction from the multisig dashboard.",
        details: [
          "Click 'New Transaction' on the multisig page.",
          "If there's already a pending transaction, you'll see a warning.",
          "Select the transaction type: Send, Delegate, Undelegate, Redelegate, Vote, IBC Transfer, and more.",
        ],
        tip: "Only one pending transaction can exist at a time per PubKey multisig. Complete or cancel existing transactions before creating new ones.",
      },
      {
        title: "Fill Transaction Details",
        description: "Enter the specific parameters for your transaction.",
        details: [
          "For Send: enter recipient address, amount, and denomination.",
          "For Delegate: select a validator and enter the amount.",
          "For Vote: select the proposal ID and your vote option.",
          "Each type has its own form with validation.",
        ],
      },
      {
        title: "Review & Submit",
        description: "Review the transaction details and submit to create it.",
        details: [
          "Verify all transaction parameters are correct.",
          "The transaction will be saved to the database with 'pending' status.",
          "An intent verification panel shows exactly what the transaction does.",
          "Share the transaction link with other multisig members for signing.",
        ],
      },
      {
        title: "Collect Signatures",
        description: "Each multisig member signs the transaction with their wallet.",
        details: [
          "Each member opens the transaction page and connects their wallet.",
          "They review the intent verification and click 'Sign'.",
          "The signature is stored in the database.",
          "The UI shows a progress tracker of collected signatures vs. threshold.",
        ],
        tip: "Members can sign in any order. The transaction can be broadcast as soon as the threshold number of signatures is collected.",
      },
      {
        title: "Broadcast",
        description: "Once enough signatures are collected, broadcast to the chain.",
        details: [
          "When the threshold is met, a 'Broadcast' button becomes available.",
          "Any member (or even a non-member) can broadcast the transaction.",
          "The transaction is assembled with all signatures and sent to the chain.",
          "Once confirmed, the status changes to 'broadcast' with the tx hash.",
        ],
      },
    ],
  },

  {
    id: "create-contract-proposal",
    title: "Create a Contract Proposal",
    subtitle: "For Contract (Fixed/Flex) multisigs",
    description:
      "Submit a proposal to your contract-based multisig. Members vote on-chain and the proposal executes automatically when the threshold is met.",
    icon: Radio,
    category: "transact",
    estimatedTime: "5-10 min",
    difficulty: "intermediate",
    prerequisites: [
      "An existing Contract Fixed or Flex multisig",
      "A connected Keplr wallet that is a member",
      "Funds for gas to submit the proposal transaction",
    ],
    steps: [
      {
        title: "Open Your Contract Multisig",
        description: "Navigate to your contract multisig from the dashboard.",
        details: [
          "Go to 'My CLIQS' or 'Find CLIQ' to locate your contract multisig.",
          "Contract multisigs show a different UI than PubKey ones.",
          "You'll see existing proposals and their voting status.",
        ],
      },
      {
        title: "Create a Proposal",
        description: "Start a new on-chain proposal.",
        details: [
          "Click 'New Transaction' (or 'New Proposal').",
          "Enter a title and description for your proposal.",
          "Choose the message type: Send Tokens or Custom JSON.",
          "For Send: enter recipient, amount, and denom.",
          "For Custom: paste the CosmWasm execute message JSON.",
        ],
        tip: "Proposals are on-chain transactions. Creating a proposal costs gas, unlike PubKey transactions which are stored off-chain until broadcast.",
      },
      {
        title: "Submit Proposal",
        description: "Submit the proposal transaction via Keplr.",
        details: [
          "Review the proposal details.",
          "Click Submit to create the on-chain proposal.",
          "Approve the transaction in Keplr.",
          "The proposal is now live and visible to all members.",
        ],
      },
      {
        title: "Members Vote",
        description: "Members cast their votes on the proposal.",
        details: [
          "Each member opens the multisig dashboard and sees the active proposal.",
          "They click Vote and choose Yes, No, or Abstain.",
          "Each vote is an on-chain transaction (costs gas).",
          "Votes are weighted according to each member's voting power.",
        ],
      },
      {
        title: "Execution",
        description: "The proposal executes when the threshold is met.",
        details: [
          "Once accumulated vote weight meets the threshold, the proposal can be executed.",
          "Execution sends the underlying message(s) to the chain.",
          "If the voting period expires before the threshold is met, the proposal fails.",
        ],
      },
    ],
  },

  // ── Setup & Management ──────────────────────────────────────────
  {
    id: "setup-byodb",
    title: "Set Up Your Own Database",
    subtitle: "Bring Your Own Database (BYODB)",
    description:
      "Configure your own MongoDB instance for complete data sovereignty. Your multisig data, transactions, and signatures are stored in your own database instead of the shared instance.",
    icon: Database,
    category: "manage",
    estimatedTime: "10-15 min",
    difficulty: "intermediate",
    prerequisites: [
      "A MongoDB instance (MongoDB Atlas free tier works great)",
      "The MongoDB connection string (URI)",
      "A connected wallet (for Level 2 security)",
    ],
    steps: [
      {
        title: "Get a MongoDB Instance",
        description: "Set up a MongoDB database if you don't have one.",
        details: [
          "MongoDB Atlas offers a free tier: visit mongodb.com/atlas and create an account.",
          "Create a new cluster (the free M0 tier is sufficient).",
          "Create a database user with read/write permissions.",
          "Whitelist your IP address (or use 0.0.0.0/0 for access from anywhere).",
          "Copy the connection string — it looks like: mongodb+srv://user:pass@cluster.mongodb.net/dbname",
        ],
        tip: "MongoDB Atlas free tier gives you 512MB of storage, which is more than enough for multisig management.",
      },
      {
        title: "Open Database Settings",
        description: "Navigate to the Settings page to configure your database.",
        details: [
          "Click 'Settings' in the sidebar navigation.",
          "Scroll down to the 'Database Configuration' section.",
          "You'll see options for configuring your own MongoDB connection.",
        ],
      },
      {
        title: "Choose Security Level",
        description: "Select how your database credentials are protected.",
        details: [
          "Level 0 (Base): Credentials stored encoded in localStorage. HTTPS provides transport security.",
          "Level 1 (Passphrase): Encrypted with AES-256-GCM using a passphrase you set. You'll need to enter the passphrase each session.",
          "Level 2 (Wallet Signature): Encrypted using a key derived from your wallet signature. Most secure — requires wallet to unlock.",
        ],
        tip: "Level 2 is recommended for production use. It ensures only your wallet can decrypt the database credentials.",
      },
      {
        title: "Enter Connection String",
        description: "Paste your MongoDB connection URI.",
        details: [
          "Paste the full MongoDB connection string.",
          "Click 'Test Connection' to verify connectivity.",
          "If the test passes, you'll see a success message.",
          "If it fails, check your credentials and IP whitelist.",
        ],
      },
      {
        title: "Provision Database",
        description: "Set up the required collections and indexes.",
        details: [
          "Click 'Provision Database' to create the necessary structure.",
          "This creates collections for multisigs, transactions, signatures, and nonces.",
          "Indexes are created for efficient querying.",
          "This step only needs to be done once.",
        ],
      },
      {
        title: "Start Using",
        description: "Your BYODB is now active. All data routes to your database.",
        details: [
          "All new multisigs, transactions, and signatures will be stored in your database.",
          "Existing data from the shared database won't be migrated automatically.",
          "You can export/import data using the database tools.",
          "To switch back to the shared database, remove your BYODB configuration in Settings.",
        ],
        tip: "Consider exporting your data periodically as a backup. The Settings page has export/import tools.",
      },
    ],
    navigateTo: "/settings#database-config",
  },

  {
    id: "find-join-multisig",
    title: "Find & Join a Multisig",
    subtitle: "Look up existing multisigs",
    description:
      "Find an existing multisig by its address, view its details, and add it to your dashboard for quick access.",
    icon: Search,
    category: "manage",
    estimatedTime: "2-5 min",
    difficulty: "beginner",
    prerequisites: [
      "The multisig address you want to find",
      "The correct chain selected",
    ],
    steps: [
      {
        title: "Navigate to Find CLIQ",
        description: "Open the Find CLIQ page from the sidebar.",
        details: [
          "Click 'Find CLIQ' in the sidebar navigation.",
          "Alternatively, go to the Dashboard and switch to the 'Find' tab.",
        ],
      },
      {
        title: "Enter the Multisig Address",
        description: "Paste or type the multisig address.",
        details: [
          "Enter the full bech32 address of the multisig.",
          "Make sure you're on the correct chain for this address.",
          "The system will look up the multisig in the database and on-chain.",
        ],
      },
      {
        title: "View Multisig Details",
        description: "Review the multisig configuration and activity.",
        details: [
          "See the member list and threshold configuration.",
          "View balances and recent transactions.",
          "Check if you're a member of this multisig.",
          "The multisig is automatically added to your 'My CLIQS' list for future access.",
        ],
        tip: "If the multisig was created off-platform, it may need to be imported first. The system will guide you through this process.",
      },
    ],
    navigateTo: "/dashboard?tab=find",
  },

  {
    id: "connect-wallet",
    title: "Connect Your Wallet",
    subtitle: "Keplr or Ledger setup",
    description:
      "Get started by connecting your Cosmos wallet. CLIQS supports both Keplr browser extension and Ledger hardware wallets for maximum flexibility and security.",
    icon: Wallet,
    category: "manage",
    estimatedTime: "2-5 min",
    difficulty: "beginner",
    prerequisites: [
      "Keplr browser extension installed, OR",
      "Ledger hardware wallet with Cosmos app installed",
    ],
    steps: [
      {
        title: "Install Keplr (if needed)",
        description: "Install the Keplr browser extension for easy wallet access.",
        details: [
          "Visit keplr.app and install the Chrome/Brave extension.",
          "Create a new wallet or import an existing one using your seed phrase.",
          "Set a strong password for the extension.",
          "The extension icon will appear in your browser toolbar.",
        ],
        tip: "For maximum security, consider using Keplr with a Ledger hardware wallet. This gives you the Keplr UI with hardware-level key security.",
      },
      {
        title: "Select Your Chain",
        description: "Choose the blockchain network you want to work on.",
        details: [
          "Use the chain selector in the sidebar (or header on mobile).",
          "Search for your chain by name or scroll through the list.",
          "Popular chains include Cosmos Hub, Osmosis, Juno, Coreum, and many more.",
          "Custom chains can be added if they're not in the default list.",
        ],
      },
      {
        title: "Connect",
        description: "Click connect and approve the connection in your wallet.",
        details: [
          "Click the Keplr or Ledger button in the sidebar.",
          "For Keplr: approve the connection request in the popup.",
          "For Ledger: ensure the Cosmos app is open on your device, then approve.",
          "Your address will appear at the bottom of the sidebar once connected.",
        ],
      },
      {
        title: "You're Ready!",
        description: "Start creating multisigs, signing transactions, or exploring.",
        details: [
          "Your wallet is now connected and ready to use.",
          "Navigate to 'Create Multisig' to set up a new CLIQ.",
          "Or go to 'My CLIQS' to see multisigs you're already part of.",
          "Check 'Operations' for any pending transactions that need your signature.",
        ],
      },
    ],
    navigateTo: "/account",
  },
];

export function getJourneyById(id: string): UserJourney | undefined {
  return userJourneys.find((j) => j.id === id);
}

export function getJourneysByCategory(category: UserJourney["category"]): UserJourney[] {
  return userJourneys.filter((j) => j.category === category);
}
