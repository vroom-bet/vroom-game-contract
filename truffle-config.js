require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  contracts_directory: './contracts',
  networks: {
    test: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      websockets: true,
    },
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      websockets: true,
    },
    sepolia: {
      provider: () =>
        new HDWalletProvider(process.env.MNEMONIC, process.env.SEPOLIA_RPC_URL),
      network_id: "11155111",
      gas: 4465030,
    },
    arbitrum: {
      provider: () =>
        new HDWalletProvider(process.env.MNEMONIC, process.env.ARBITRUM_RPC_URL),
      network_id: "42161",
      gas: 4465030,
    },
  },
  compilers: {
    solc: {
      version: "^0.8.0",
    },
  },
};
